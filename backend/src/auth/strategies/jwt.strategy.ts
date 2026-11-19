import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string | null; // phone-only accounts have no email
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      // Fail fast: never validate tokens against a predictable fallback secret.
      throw new Error(
        'JWT_SECRET is not set. Refusing to start with an insecure default.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * QA P1-5: a signature check alone trusted a token for its whole lifetime —
   * a deactivated worker or admin kept working until it expired, and a demoted
   * admin kept the ADMIN claim. Every request now confirms the account still
   * exists and is active, and takes the role from the database, not the token.
   * (One primary-key lookup per authenticated request.)
   */
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, role: true, email: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }
    return {
      sub: payload.sub,
      email: user.email,
      role: user.role,
    };
  }
}
