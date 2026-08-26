import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * F-07: Global deny-by-default JWT guard.
 *
 * When registered as APP_GUARD in app.module.ts this guard runs on every
 * request. Routes or controllers decorated with @Public() are passed through
 * without authentication; everything else requires a valid JWT. This removes
 * the risk of a newly added route accidentally failing open because a developer
 * forgot @UseGuards(JwtAuthGuard).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Allow @Public() routes to pass through without a JWT
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
