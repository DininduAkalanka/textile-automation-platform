import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { VerificationChannel } from '@prisma/client';
import { createHash } from 'crypto';
import { VerificationService } from './verification.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** Run fn, return the thrown error (or fail). */
async function caught(
  fn: () => Promise<unknown>,
): Promise<BadRequestException> {
  const err = await fn().then(
    () => {
      throw new Error('expected a rejection');
    },
    (e) => e as BadRequestException,
  );
  return err;
}

describe('VerificationService', () => {
  let service: VerificationService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    verificationCode: {
      findFirst: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let email: { send: jest.Mock };
  let sms: { send: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      verificationCode: {
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (arg: any) => {
        if (typeof arg === 'function') return arg(prisma);
        return Promise.all(arg);
      }),
    };
    email = { send: jest.fn().mockResolvedValue(undefined) };
    sms = { send: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        { provide: SmsService, useValue: sms },
      ],
    }).compile();
    service = moduleRef.get(VerificationService);
  });

  describe('sendCode', () => {
    it('emails a code to an unverified email and stores only its hash', async () => {
      prisma.user.findUnique.mockResolvedValue({
        email: 'a@b.com',
        phone: null,
        emailVerified: false,
        phoneVerified: false,
      });
      prisma.verificationCode.findFirst.mockResolvedValue(null); // no prior code
      prisma.verificationCode.count.mockResolvedValue(0);

      const res = await service.sendCode('u1', VerificationChannel.EMAIL);

      expect(res.channel).toBe(VerificationChannel.EMAIL);
      expect(email.send).toHaveBeenCalledTimes(1);
      expect(sms.send).not.toHaveBeenCalled();
      // The persisted value is a hash, never the plaintext code.
      const stored = prisma.verificationCode.create.mock.calls[0][0].data
        .codeHash as string;
      expect(stored).toMatch(/^[a-f0-9]{64}$/);
    });

    it('SMS-sends when the channel is SMS', async () => {
      prisma.user.findUnique.mockResolvedValue({
        email: null,
        phone: '+94771234567',
        emailVerified: false,
        phoneVerified: false,
      });
      prisma.verificationCode.findFirst.mockResolvedValue(null);
      prisma.verificationCode.count.mockResolvedValue(0);

      await service.sendCode('u1', VerificationChannel.SMS);
      expect(sms.send).toHaveBeenCalledWith(
        '+94771234567',
        expect.stringContaining('verification code'),
      );
    });

    it('rejects when there is no contact for the channel', async () => {
      prisma.user.findUnique.mockResolvedValue({
        email: null,
        phone: '+94771234567',
        emailVerified: false,
        phoneVerified: false,
      });
      const err = await caught(() =>
        service.sendCode('u1', VerificationChannel.EMAIL),
      );
      expect(err.getResponse()).toMatchObject({ code: 'NO_CONTACT' });
    });

    it('rejects when the contact is already verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        email: 'a@b.com',
        phone: null,
        emailVerified: true,
        phoneVerified: false,
      });
      const err = await caught(() =>
        service.sendCode('u1', VerificationChannel.EMAIL),
      );
      expect(err.getResponse()).toMatchObject({ code: 'ALREADY_VERIFIED' });
    });

    it('enforces a cooldown between sends', async () => {
      prisma.user.findUnique.mockResolvedValue({
        email: 'a@b.com',
        phone: null,
        emailVerified: false,
        phoneVerified: false,
      });
      prisma.verificationCode.findFirst.mockResolvedValue({
        createdAt: new Date(), // just sent
      });

      const err = await caught(() =>
        service.sendCode('u1', VerificationChannel.EMAIL),
      );
      expect(err.getResponse()).toMatchObject({ code: 'OTP_COOLDOWN' });
      expect(prisma.verificationCode.create).not.toHaveBeenCalled();
    });

    it('enforces an hourly send cap', async () => {
      prisma.user.findUnique.mockResolvedValue({
        email: 'a@b.com',
        phone: null,
        emailVerified: false,
        phoneVerified: false,
      });
      prisma.verificationCode.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 5 * 60 * 1000), // past cooldown
      });
      prisma.verificationCode.count.mockResolvedValue(5); // at the cap

      const err = await caught(() =>
        service.sendCode('u1', VerificationChannel.EMAIL),
      );
      expect(err.getResponse()).toMatchObject({ code: 'OTP_RATE_LIMIT' });
    });
  });

  describe('verifyCode', () => {
    it('marks the contact verified on a correct code', async () => {
      prisma.verificationCode.findFirst.mockResolvedValue({
        id: 'c1',
        attempts: 0,
        codeHash: sha256('123456'),
      });
      prisma.user.update.mockResolvedValue({
        emailVerified: true,
        phoneVerified: false,
      });

      const res = await service.verifyCode(
        'u1',
        VerificationChannel.EMAIL,
        '123456',
      );

      expect(res).toEqual({ emailVerified: true, phoneVerified: false });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { emailVerified: true } }),
      );
    });

    it('rejects when no active code exists', async () => {
      prisma.verificationCode.findFirst.mockResolvedValue(null);
      const err = await caught(() =>
        service.verifyCode('u1', VerificationChannel.EMAIL, '123456'),
      );
      expect(err.getResponse()).toMatchObject({ code: 'OTP_INVALID' });
    });

    it('increments attempts and rejects on a wrong code', async () => {
      prisma.verificationCode.findFirst.mockResolvedValue({
        id: 'c1',
        attempts: 1,
        codeHash: sha256('123456'),
      });

      const err = await caught(() =>
        service.verifyCode('u1', VerificationChannel.EMAIL, '000000'),
      );
      expect(err.getResponse()).toMatchObject({ code: 'OTP_INVALID' });
      expect(prisma.verificationCode.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { attempts: { increment: 1 } } }),
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('locks a code after too many attempts', async () => {
      prisma.verificationCode.findFirst.mockResolvedValue({
        id: 'c1',
        attempts: 5, // already at the cap
        codeHash: sha256('123456'),
      });

      const err = await caught(() =>
        service.verifyCode('u1', VerificationChannel.EMAIL, '123456'),
      );
      expect(err.getResponse()).toMatchObject({ code: 'OTP_LOCKED' });
    });
  });
});
