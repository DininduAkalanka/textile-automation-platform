import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Accounts with access to the business side (every order, customer and
 * payment). Their password protects every customer's data, so it must be
 * longer than a shopper's. Customers and floor workers keep the 8-character
 * minimum enforced by the DTOs.
 */
const STAFF_ROLES: ReadonlySet<string> = new Set([
  UserRole.ADMIN,
  UserRole.MANAGER,
]);

export const MIN_STAFF_PASSWORD_LENGTH = 12;

/** Throws a 400 when the password is too short for this account's role. */
export function assertPasswordAllowedForRole(
  role: UserRole | string,
  password: string,
): void {
  if (STAFF_ROLES.has(role) && password.length < MIN_STAFF_PASSWORD_LENGTH) {
    throw new BadRequestException({
      code: 'PASSWORD_TOO_SHORT',
      message: `Admin and manager passwords must be at least ${MIN_STAFF_PASSWORD_LENGTH} characters.`,
    });
  }
}
