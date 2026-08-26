import { SetMetadata } from '@nestjs/common';

/**
 * F-07: Mark a route handler (or an entire controller) as public so that the
 * global JwtAuthGuard skips JWT verification for it.
 *
 * Usage:
 *   @Public()
 *   @Get('products')
 *   listProducts() { ... }
 *
 * Without this decorator, every route in every controller requires a valid
 * JWT — the deny-by-default contract enforced by the global APP_GUARD.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
