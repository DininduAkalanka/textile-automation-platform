import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Tighter rate limit on credential endpoints (doc 09 §5.1: 20/min auth).
const AUTH_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_MAX_AGE,
    });
  }

  @Throttle(AUTH_THROTTLE)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...result } = await this.authService.register(
      dto,
      req.headers['user-agent'],
    );
    this.setRefreshCookie(res, refreshToken);
    return result; // { user, accessToken }
  }

  @Throttle(AUTH_THROTTLE)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...result } = await this.authService.login(
      dto,
      req.headers['user-agent'],
    );
    this.setRefreshCookie(res, refreshToken);
    return result;
  }

  @Throttle(AUTH_THROTTLE)
  @Post('refresh')
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, user, accessToken } = await this.authService.refresh(
      req.cookies?.[REFRESH_COOKIE],
      req.headers['user-agent'],
    );
    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken };
  }

  @Post('logout')
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }

  // Retained alias for existing callers.
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }
}
