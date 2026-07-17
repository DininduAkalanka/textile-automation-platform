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
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerificationService } from '../verification/verification.service';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Tighter rate limit on credential endpoints (doc 09 §5.1: 20/min auth).
const AUTH_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verificationService: VerificationService,
  ) {}

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

  // ─── Contact verification (OTP) ─────────────────────────
  // Authenticated: a logged-in user verifies their OWN contact. Same tight
  // throttle as the credential endpoints; the service adds its own per-user
  // cooldown and hourly cap on top of this IP-based limit.

  @Throttle(AUTH_THROTTLE)
  @UseGuards(JwtAuthGuard)
  @Post('send-code')
  async sendCode(@Request() req: any, @Body() dto: SendCodeDto) {
    return this.verificationService.sendCode(req.user.sub, dto.channel);
  }

  @Throttle(AUTH_THROTTLE)
  @UseGuards(JwtAuthGuard)
  @Post('verify-code')
  async verifyCode(@Request() req: any, @Body() dto: VerifyCodeDto) {
    return this.verificationService.verifyCode(
      req.user.sub,
      dto.channel,
      dto.code,
    );
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
