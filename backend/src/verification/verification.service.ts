import { BadRequestException, Injectable } from '@nestjs/common';
import { VerificationChannel } from '@prisma/client';
import { randomInt, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { VerificationCodeEmail } from '../email/templates/verification-code-email';

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5; // wrong guesses before a code locks

/**
 * Owns the one-time-code lifecycle for verifying a contact (email or phone).
 *
 * A 6-digit code is only 1-in-a-million, so the security is NOT the code — it
 * is the surrounding limits, all enforced here: the plaintext is never stored
 * (only its SHA-256 hash), a code expires in 5 minutes, locks after 5 wrong
 * guesses, and a user can only request a handful per hour with a cooldown
 * between. Delivery goes through EmailService/SmsService, which are optional and
 * never throw — with no provider configured the code is logged for local demos.
 */
@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  /** Generate, persist (hashed) and dispatch a fresh code for one channel. */
  async sendCode(
    userId: string,
    channel: VerificationChannel,
  ): Promise<{ channel: VerificationChannel; expiresAt: Date }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true,
      },
    });
    if (!user) {
      throw new BadRequestException({
        code: 'USER_NOT_FOUND',
        message: 'Account not found.',
      });
    }

    const isEmail = channel === VerificationChannel.EMAIL;
    const destination = isEmail ? user.email : user.phone;
    const alreadyVerified = isEmail ? user.emailVerified : user.phoneVerified;

    if (!destination) {
      throw new BadRequestException({
        code: 'NO_CONTACT',
        message: `No ${isEmail ? 'email' : 'phone number'} on file to verify.`,
      });
    }
    if (alreadyVerified) {
      throw new BadRequestException({
        code: 'ALREADY_VERIFIED',
        message: `Your ${isEmail ? 'email' : 'phone'} is already verified.`,
      });
    }

    await this.enforceRateLimits(userId, channel);

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    await this.prisma.verificationCode.create({
      data: {
        userId,
        channel,
        codeHash: this.sha256(code),
        expiresAt,
      },
    });

    await this.dispatch(channel, destination, code);
    return { channel, expiresAt };
  }

  /** Check a code; on success mark the matching contact verified. */
  async verifyCode(
    userId: string,
    channel: VerificationChannel,
    code: string,
  ): Promise<{ emailVerified: boolean; phoneVerified: boolean }> {
    const record = await this.prisma.verificationCode.findFirst({
      where: {
        userId,
        channel,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException({
        code: 'OTP_INVALID',
        message: 'That code is invalid or has expired. Request a new one.',
      });
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException({
        code: 'OTP_LOCKED',
        message: 'Too many incorrect attempts. Request a new code.',
      });
    }

    if (this.sha256(code) !== record.codeHash) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException({
        code: 'OTP_INVALID',
        message: 'Incorrect code. Please try again.',
      });
    }

    const isEmail = channel === VerificationChannel.EMAIL;
    const [, user] = await this.prisma.$transaction([
      this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: isEmail ? { emailVerified: true } : { phoneVerified: true },
        select: { emailVerified: true, phoneVerified: true },
      }),
    ]);

    return {
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
    };
  }

  // ─── Helpers ────────────────────────────────────────────

  private async enforceRateLimits(
    userId: string,
    channel: VerificationChannel,
  ): Promise<void> {
    const latest = await this.prisma.verificationCode.findFirst({
      where: { userId, channel },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException({
        code: 'OTP_COOLDOWN',
        message: 'Please wait a minute before requesting another code.',
      });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sentLastHour = await this.prisma.verificationCode.count({
      where: { userId, channel, createdAt: { gte: oneHourAgo } },
    });
    if (sentLastHour >= MAX_SENDS_PER_HOUR) {
      throw new BadRequestException({
        code: 'OTP_RATE_LIMIT',
        message: 'Too many codes requested. Please try again later.',
      });
    }
  }

  private async dispatch(
    channel: VerificationChannel,
    destination: string,
    code: string,
  ): Promise<void> {
    if (channel === VerificationChannel.EMAIL) {
      await this.emailService.send({
        to: destination,
        subject: 'Your TextileShop verification code',
        react: VerificationCodeEmail({ code }),
      });
    } else {
      await this.smsService.send(
        destination,
        `Your TextileShop verification code is ${code}. It expires in 5 minutes.`,
      );
    }
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
