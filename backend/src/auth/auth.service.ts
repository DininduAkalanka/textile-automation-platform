import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type SessionUser = {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto, userAgent?: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
      },
    });

    return this.issueSession(user, userAgent);
  }

  async login(dto: LoginDto, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
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

    return this.issueSession(user, userAgent);
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
      },
      accessToken,
      refreshToken,
    };
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
