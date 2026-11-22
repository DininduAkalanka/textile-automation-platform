import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { VerificationChannel } from '@prisma/client';
import { randomInt, createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { VerificationCodeEmail } from '../email/templates/verification-code-email';

export const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends
export const MAX_SENDS_PER_HOUR = 5;
export const MAX_ATTEMPTS = 5; // guesses before a code locks

export const otpInvalid = (message = 'That code is invalid or has expired. Request a new one.') =>
  new BadRequestException({ code: 'OTP_INVALID', message });

export const otpLocked = () =>
  new BadRequestException({
    code: 'OTP_LOCKED',
    message: 'Too many incorrect attempts. Request a new code.',
  });

export const sha256Hex = (value: string) =>
  createHash('sha256').update(value).digest('hex');

/** The guarded "claim one attempt" update, shared by both code tables. */
export const claimAttemptArgs = (id: string) => ({
  where: { id, attempts: { lt: MAX_ATTEMPTS }, consumedAt: null },
  data: { attempts: { increment: 1 } },
});

type ClaimAttempt = (
  args: ReturnType<typeof claimAttemptArgs>,
) => Promise<{ count: number }>;

/**
 * QA P1-3 — claim the attempt BEFORE comparing the code.
 *
 * The old order was: read `attempts`, compare the code, and only on a WRONG
 * guess increment. A burst of concurrent guesses all read the same stale
 * `attempts` (say 0), all passed the lock check, and every one of them got its
 * comparison — a 40-request burst let the 31st guess through.
 *
 * Now each request must first win a guarded increment (attempts < MAX). The
 * database serializes those UPDATEs, so across ANY amount of concurrency at
 * most MAX_ATTEMPTS requests ever reach the comparison. A request that loses
 * the claim is rejected without the code ever being looked at.
 *
 * The comparison is constant-time over the two SHA-256 digests.
 */
export async function claimAttemptAndCompare(
  claim: ClaimAttempt,
  record: { id: string; attempts: number; codeHash: string },
  code: string,
): Promise<void> {
  const claimed = await claim(claimAttemptArgs(record.id));
  if (claimed.count !== 1) throw otpLocked();

  const isDevMatch =
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_DEV_OTP_BYPASS === 'true' &&
    code === '123456';
  const expected = Buffer.from(record.codeHash, 'hex');
  const actual = Buffer.from(sha256Hex(String(code)), 'hex');
  const matches =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!isDevMatch && !matches) {
    // `record.attempts` is from before our claim; it only picks the message.
    // The security limit was already enforced by the guarded claim above.
    if (record.attempts + 1 >= MAX_ATTEMPTS) throw otpLocked();
    throw otpInvalid('Incorrect code. Please try again.');
  }
}

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
  private readonly logger = new Logger(VerificationService.name);

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
    const isBypassAllowed =
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_DEV_OTP_BYPASS === 'true';
    const isDevLoggingAllowed =
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_DEV_OTP_LOGGING === 'true';

    if (isDevLoggingAllowed) {
      this.logger.log(
        `\n======================================================\n📧 [DEV OTP CODE] ${channel} for ${destination}: ${code}${isBypassAllowed ? ' (or dev bypass code: 123456)' : ''}\n======================================================`,
      );
    } else {
      this.logger.log(`Dispatched verification OTP for ${channel}`);
    }

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

    if (!record) throw otpInvalid();

    await claimAttemptAndCompare(
      (args) => this.prisma.verificationCode.updateMany(args),
      record,
      code,
    );

    // Consume exactly once: two correct submissions racing each other must not
    // both succeed, so the consume is itself guarded on consumedAt IS NULL.
    const isEmail = channel === VerificationChannel.EMAIL;
    const user = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.verificationCode.updateMany({
        where: { id: record.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) throw otpInvalid();
      return tx.user.update({
        where: { id: userId },
        data: isEmail ? { emailVerified: true } : { phoneVerified: true },
        select: { emailVerified: true, phoneVerified: true },
      });
    });

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
        subject: 'Your Nandana Textile verification code',
        react: VerificationCodeEmail({ code }),
      });
    } else {
      await this.smsService.send(
        destination,
        `Your Nandana Textile verification code is ${code}. It expires in 5 minutes.`,
      );
    }
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
