import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, VerificationChannel } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { normalizeLkPhone } from '../common/phone.util';
import { VerificationService } from '../verification/verification.service';
import { loginLockMinutes, loginMaxFailures } from '../common/config/limits';

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** A guest used a contact that already has an account (QA P0-1). */
export const loginRequired = () =>
  new ConflictException({
    code: 'LOGIN_REQUIRED',
    message:
      'An account with this email or phone number already exists. Sign in to continue.',
  });

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
      // QA P1-8: an earlier guest checkout may have created an unverified
      // account for this contact. Point the owner at the reset flow, which
      // now lets them claim it (receiving the link proves ownership).
      throw new ConflictException(
        'An account with that email or phone number already exists. Sign in, or use "Forgot password" to claim it.',
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
      // QA P1-4: an unknown identifier used to answer in ~5 ms while a known
      // one paid for bcrypt (~300 ms) — a stopwatch was enough to tell which
      // emails are registered. Spend the same bcrypt time either way.
      await bcrypt.compare(dto.password, await this.timingEqualizerHash());
      throw new UnauthorizedException('Invalid credentials');
    }

    // QA P1-4: per-account lockout. Per-IP throttling alone cannot stop
    // credential stuffing spread across many addresses.
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        message: `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`,
      });
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      await this.recordFailedLogin(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Checked only AFTER the password, so a wrong guess cannot learn that an
    // account exists but is deactivated.
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    // Note: NO verification gate here (unlike an email-only design). Contact
    // verification is enforced at checkout, so login stays low-friction.
    return this.issueSession(user, userAgent);
  }

  /** Count a wrong password; the Nth in a row locks the account for a while. */
  private async recordFailedLogin(userId: string): Promise<void> {
    const { failedLoginAttempts } = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (failedLoginAttempts >= loginMaxFailures()) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: new Date(Date.now() + loginLockMinutes() * 60_000),
        },
      });
    }
  }

  private equalizerHash: Promise<string> | null = null;

  /** A real bcrypt hash (same cost as stored passwords), computed once. */
  private timingEqualizerHash(): Promise<string> {
    this.equalizerHash ??= bcrypt.hash(randomBytes(16).toString('hex'), 12);
    return this.equalizerHash;
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
    // QA P1-5: a deactivated account used to keep minting fresh access tokens
    // through refresh for as long as it kept rotating (a rolling 7-day
    // session). Refuse, and revoke every refresh token the account still holds.
    if (!record.user.isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Account is deactivated');
    }

    // Serialize rotation with a password reset, which also locks the user before
    // revoking their refresh tokens. A racing rotation cannot escape revocation.
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${record.userId}::uuid FOR UPDATE`;
      const rotated = await tx.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (!rotated.count) throw new UnauthorizedException('Invalid refresh token');
      return this.issueSession(record.user, userAgent, tx);
    });
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

  /**
   * Guest checkout account creation (QA P0-1).
   *
   * This replaces provisionOrFindGuestUser(), which FOUND an existing account
   * by email/phone and handed back a fresh session for it — no password, no
   * code. Posting a guest checkout with admin@… returned an ADMIN token.
   *
   * There is no "find" any more. The caller has already refused contacts that
   * belong to an account (LOGIN_REQUIRED), and the unique constraints on
   * email/phone refuse a racing duplicate here. Only a brand-new CUSTOMER is
   * ever created, and only that new account ever gets a session.
   */
  async createGuestUser(input: {
    email: string | null;
    phone: string | null;
    fullName: string;
    password?: string;
    emailVerified: boolean;
    phoneVerified: boolean;
  }) {
    const parts = input.fullName.trim().split(/\s+/);
    const firstName = (parts[0] || 'Guest').slice(0, 50);
    const lastName = (parts.slice(1).join(' ') || 'Customer').slice(0, 50);
    const passwordHash = await bcrypt.hash(
      input.password || randomBytes(16).toString('hex'),
      12,
    );

    try {
      return await this.prisma.user.create({
        data: {
          email: input.email,
          phone: input.phone,
          firstName,
          lastName,
          passwordHash,
          role: 'CUSTOMER',
          emailVerified: input.emailVerified,
          phoneVerified: input.phoneVerified,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw loginRequired();
      }
      throw e;
    }
  }

  /** Session for an account createGuestUser() just made — never for any other. */
  issueGuestSession(user: SessionUser, userAgent?: string) {
    return this.issueSession(user, userAgent);
  }

  // ─── Helpers ────────────────────────────────────────────

  private async issueSession(
    user: SessionUser,
    userAgent?: string,
    db: Pick<Prisma.TransactionClient, 'refreshToken'> = this.prisma,
  ) {
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: ACCESS_TTL },
    );

    const refreshToken = randomBytes(32).toString('hex'); // 256-bit
    await db.refreshToken.create({
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
