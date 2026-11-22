import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { VerificationChannel } from '@prisma/client';
import { randomInt } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { VerificationCodeEmail } from '../email/templates/verification-code-email';
import {
  CODE_TTL_MS,
  MAX_SENDS_PER_HOUR,
  RESEND_COOLDOWN_MS,
  claimAttemptAndCompare,
  otpInvalid,
  sha256Hex,
} from './verification.service';

/**
 * One-time codes for a GUEST checkout (QA P1-8).
 *
 * The old guest Cash-on-Delivery flow was a dead end: checkout demanded a
 * verified contact, but the only code endpoint required a logged-in user, so a
 * guest could never receive one — and every attempt created an unverified
 * account that then locked the real owner of that email out.
 *
 * These codes are keyed to the CONTACT (canonical email or +947 phone), not to
 * a user, so a guest proves ownership BEFORE any account exists. Same limits as
 * the account codes: 5-minute expiry, 5 guesses (claimed atomically before the
 * comparison), a 1-minute resend cooldown and 5 sends per hour per contact.
 */
@Injectable()
export class ContactVerificationService {
  private readonly logger = new Logger(ContactVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  async sendCode(
    contact: string,
    channel: VerificationChannel,
  ): Promise<{ channel: VerificationChannel; expiresAt: Date }> {
    await this.enforceRateLimits(contact, channel);

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    await this.prisma.contactVerificationCode.create({
      data: { contact, channel, codeHash: sha256Hex(code), expiresAt },
    });

    const devLogging =
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_DEV_OTP_LOGGING === 'true';
    this.logger.log(
      devLogging
        ? `[DEV GUEST OTP] ${channel} for ${contact}: ${code}`
        : `Dispatched guest checkout OTP for ${channel}`,
    );

    if (channel === VerificationChannel.EMAIL) {
      await this.emailService.send({
        to: contact,
        subject: 'Your Nandana Textile verification code',
        react: VerificationCodeEmail({ code }),
      });
    } else {
      await this.smsService.send(
        contact,
        `Your Nandana Textile verification code is ${code}. It expires in 5 minutes.`,
      );
    }
    return { channel, expiresAt };
  }

  /** Throws OTP_INVALID / OTP_LOCKED; on success the code is consumed. */
  async verifyCode(
    contact: string,
    channel: VerificationChannel,
    code: string,
  ): Promise<void> {
    const record = await this.prisma.contactVerificationCode.findFirst({
      where: {
        contact,
        channel,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw otpInvalid();

    await claimAttemptAndCompare(
      (args) => this.prisma.contactVerificationCode.updateMany(args),
      record,
      code,
    );

    const consumed = await this.prisma.contactVerificationCode.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw otpInvalid();
  }

  private async enforceRateLimits(
    contact: string,
    channel: VerificationChannel,
  ): Promise<void> {
    const latest = await this.prisma.contactVerificationCode.findFirst({
      where: { contact, channel },
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
    const sentLastHour = await this.prisma.contactVerificationCode.count({
      where: {
        contact,
        channel,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (sentLastHour >= MAX_SENDS_PER_HOUR) {
      throw new BadRequestException({
        code: 'OTP_RATE_LIMIT',
        message: 'Too many codes requested. Please try again later.',
      });
    }
  }
}
