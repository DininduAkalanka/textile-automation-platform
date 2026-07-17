import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { VerificationChannel } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { normalizeLkPhone } from '../common/phone.util';
import { VerificationService } from '../verification/verification.service';

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type SessionUser = {
  id: string;
  email: string | null;
  role: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  phoneVerified: boolean;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private verificationService: VerificationService,
  ) {}

  async register(dto: RegisterDto, userAgent?: string) {
    const email = dto.email?.trim().toLowerCase() || null;
    // DTO @IsLkPhone already validated format; normalize to the canonical
    // +947XXXXXXXX so the unique constraint treats "0771…"/"+9477…" as one.
    const phone = dto.phone ? normalizeLkPhone(dto.phone) : null;

    if (!email && !phone) {
      throw new BadRequestException({
        code: 'CONTACT_REQUIRED',
        message: 'Provide an email or a phone number to register.',
      });
    }

    // "email OR phone already taken" — findUnique can't express an OR, so
    // build the OR from only the contacts actually provided.
    const orConditions: { email?: string; phone?: string }[] = [];
    if (email) orConditions.push({ email });
    if (phone) orConditions.push({ phone });
    const existing = await this.prisma.user.findFirst({
      where: { OR: orConditions },
    });
    if (existing) {
      throw new ConflictException(
        'An account with that email or phone number already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone,
      },
    });

    // Auto-send the first verification code (email preferred, else SMS).
    // Best-effort: a delivery/rate-limit hiccup must never fail registration.
    const channel = email ? VerificationChannel.EMAIL : VerificationChannel.SMS;
    try {
      await this.verificationService.sendCode(user.id, channel);
    } catch (err) {
      this.logger.warn(
        `Initial verification code not sent for ${user.id}: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }

    return this.issueSession(user, userAgent);
  }

  async login(dto: LoginDto, userAgent?: string) {
    const user = await this.findByIdentifier(dto.identifier);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Note: NO verification gate here (unlike an email-only design). Contact
    // verification is enforced at checkout, so login stays low-friction.
    return this.issueSession(user, userAgent);
  }

  /** Resolve a login identifier that may be an email or an LK phone number. */
  private async findByIdentifier(identifier: string) {
    const trimmed = identifier.trim();
    if (trimmed.includes('@')) {
      return this.prisma.user.findUnique({
        where: { email: trimmed.toLowerCase() },
      });
    }
    const phone = normalizeLkPhone(trimmed);
    if (!phone) return null; // neither a valid email nor a valid LK mobile
    return this.prisma.user.findUnique({ where: { phone } });
  }

  /**
   * Rotate a refresh token. Presenting an already-revoked token means the
   * session family is compromised (the legitimate client already rotated it),
   * so every active token for that user is revoked (token-reuse detection).
   */
  async refresh(rawToken: string | undefined, userAgent?: string) {
    if (!rawToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.sha256(rawToken) },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (record.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Rotate: revoke the presented token, mint a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(record.user, userAgent);
  }

  async logout(rawToken?: string) {
    if (rawToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: this.sha256(rawToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { success: true };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  // ─── Helpers ────────────────────────────────────────────

  private async issueSession(user: SessionUser, userAgent?: string) {
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: ACCESS_TTL },
    );

    const refreshToken = randomBytes(32).toString('hex'); // 256-bit
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.sha256(refreshToken),
        userAgent: userAgent?.slice(0, 255),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
      },
      accessToken,
      refreshToken,
    };
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
