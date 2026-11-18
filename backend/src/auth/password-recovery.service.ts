import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';

import { normalizeLkPhone } from '../common/phone.util';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';

const LINK_TTL = 15 * 60_000;
const RESEND_INTERVAL = 60_000;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const invalidLink = () => new BadRequestException('This reset link is invalid or has expired. Request a new link.');

@Injectable()
export class PasswordRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  async request(identifier: string) {
    const input = identifier.trim();
    const email = isEmail(input) ? input.toLowerCase() : null;
    const phone = email ? null : normalizeLkPhone(input);
    if (!email && !phone) throw new BadRequestException('Enter an email address or Sri Lankan mobile number.');
    if (email ? !this.email.isConfigured : !this.sms.isConfigured) {
      throw new ServiceUnavailableException(`${email ? 'Email' : 'SMS'} recovery is unavailable. Try another verified contact or contact the shop.`);
    }

    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    // The conditional write gives concurrent requests the same resend cooldown.
    const issued = await this.prisma.user.updateMany({
      where: {
        isActive: true,
        ...(email ? { email, emailVerified: true } : { phone, phoneVerified: true }),
        OR: [
          { resetExpiresAt: null },
          { resetExpiresAt: { lte: new Date(now + LINK_TTL - RESEND_INTERVAL) } },
        ],
      },
      data: { resetTokenHash: hashToken(token), resetExpiresAt: new Date(now + LINK_TTL) },
    });

    if (issued.count) {
      const link = new URL('/reset-password', this.config.getOrThrow<string>('FRONTEND_URL'));
      link.hash = token;
      // Delivery services handle provider errors. Keep request timing independent of delivery.
      if (email) {
        void this.email.send({
          to: email,
          subject: 'Reset your Nandana Textile password',
          html: `<p>Someone requested a password reset for your Nandana Textile account.</p><p><a href="${link.href}">Choose a new password</a></p><p>This link expires in 15 minutes. If you did not request it, you can ignore this message.</p>`,
        });
      } else {
        void this.sms.send(phone!, `Nandana Textile password reset: ${link.href} (valid for 15 minutes). Ignore if you did not request this.`);
      }
    }
    return { success: true };
  }

  async reset(token: string, password: string) {
    const resetTokenHash = hashToken(token);
    const valid = { resetTokenHash, resetExpiresAt: { gt: new Date() }, isActive: true };
    const user = await this.prisma.user.findFirst({ where: valid, select: { id: true } });
    if (!user) throw invalidLink();

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.user.updateMany({
        where: { id: user.id, resetTokenHash, resetExpiresAt: { gt: new Date() }, isActive: true },
        data: { passwordHash, resetTokenHash: null, resetExpiresAt: null },
      });
      if (!consumed.count) throw invalidLink();
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { success: true };
  }
}
