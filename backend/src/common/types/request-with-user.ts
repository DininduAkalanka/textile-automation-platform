import { Request } from 'express';
import { UserRole } from '@prisma/client';

/**
 * The shape Passport attaches to req.user after JwtStrategy.validate().
 * Used in controllers instead of `any` to satisfy @typescript-eslint/no-unsafe-*
 */
export interface AuthenticatedUser {
  sub: string;
  email: string | null;
  role: UserRole;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
