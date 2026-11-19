import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { VerificationChannel } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { VerificationService } from '../verification/verification.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));
import * as bcrypt from 'bcrypt';

const makeUser = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'a@b.com',
  phone: null,
  passwordHash: 'hashed-password',
  firstName: 'Jane',
  lastName: 'Doe',
  role: 'CUSTOMER',
  isActive: true,
  emailVerified: false,
  phoneVerified: false,
  ...over,
});

describe('AuthService (dual identity + OTP)', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let jwt: { sign: jest.Mock };
  let verification: { sendCode: jest.Mock };

  beforeEach(async () => {
    (bcrypt.compare as jest.Mock).mockReset();
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ failedLoginAttempts: 1 }),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    jwt = { sign: jest.fn().mockReturnValue('access-token') };
    verification = { sendCode: jest.fn().mockResolvedValue({}) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: VerificationService, useValue: verification },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    const base = {
      password: 'Password1',
      firstName: 'Jane',
      lastName: 'Doe',
    };

    it('registers with email only and sends an EMAIL code', async () => {
      prisma.user.create.mockResolvedValue(makeUser());

      const res = await service.register({ ...base, email: 'A@B.com' });

      // email is lowercased on store
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'a@b.com', phone: null }),
        }),
      );
      expect(verification.sendCode).toHaveBeenCalledWith(
        'u1',
        VerificationChannel.EMAIL,
      );
      expect(res).toMatchObject({
        user: { id: 'u1', emailVerified: false },
        accessToken: 'access-token',
      });
    });

    it('registers with phone only (normalized) and sends an SMS code', async () => {
      prisma.user.create.mockResolvedValue(
        makeUser({ email: null, phone: '+94771234567' }),
      );

      await service.register({ ...base, phone: '0771234567' });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: null, phone: '+94771234567' }),
        }),
      );
      expect(verification.sendCode).toHaveBeenCalledWith(
        'u1',
        VerificationChannel.SMS,
      );
    });

    it('rejects when neither email nor phone is given', async () => {
      await expect(service.register({ ...base } as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate contact', async () => {
      prisma.user.findFirst.mockResolvedValue(makeUser());
      await expect(
        service.register({ ...base, email: 'a@b.com' } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('still registers if the initial code send fails (best-effort)', async () => {
      prisma.user.create.mockResolvedValue(makeUser());
      verification.sendCode.mockRejectedValue(new Error('smtp down'));

      const res = await service.register({ ...base, email: 'a@b.com' });
      expect(res.accessToken).toBe('access-token');
    });
  });

  describe('login', () => {
    it('logs in by email', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await service.login({
        identifier: 'a@b.com',
        password: 'Password1',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'a@b.com' },
      });
      expect(res.accessToken).toBe('access-token');
    });

    it('logs in by phone (identifier normalized to E.164)', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ email: null, phone: '+94771234567' }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login({
        identifier: '0771234567',
        password: 'Password1',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: '+94771234567' },
      });
    });

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ identifier: 'a@b.com', password: 'nope' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('lets an UNVERIFIED user log in (no verification gate at login)', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ emailVerified: false, phoneVerified: false }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await service.login({
        identifier: 'a@b.com',
        password: 'Password1',
      });
      expect(res.accessToken).toBe('access-token');
    });

    // ─── QA P1-4 ────────────────────────────────────────────────────────
    it('spends bcrypt time on an UNKNOWN identifier too (no timing oracle)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ identifier: 'nobody@x.com', password: 'whatever1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      // The same expensive comparison a real account would cost.
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    });

    it('counts a wrong password against the account', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ failedLoginAttempts: 0 }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ identifier: 'a@b.com', password: 'nope' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { failedLoginAttempts: { increment: 1 } },
        }),
      );
    });

    it('locks the account on the 5th failure in a row', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ failedLoginAttempts: 4 }));
      prisma.user.update.mockResolvedValueOnce({ failedLoginAttempts: 5 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ identifier: 'a@b.com', password: 'nope' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('refuses a locked account WITHOUT checking the password', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ lockedUntil: new Date(Date.now() + 10 * 60_000) }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const err = await service
        .login({ identifier: 'a@b.com', password: 'Password1' })
        .catch((e) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.getResponse()).toMatchObject({ code: 'ACCOUNT_LOCKED' });
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('a correct password clears earlier failures', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ failedLoginAttempts: 3 }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login({ identifier: 'a@b.com', password: 'Password1' });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { failedLoginAttempts: 0, lockedUntil: null },
        }),
      );
    });
  });

  // ─── QA P1-5 ──────────────────────────────────────────────────────────
  describe('refresh', () => {
    it('refuses a deactivated account and revokes all of its refresh tokens', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: makeUser({ isActive: false }),
      });

      await expect(service.refresh('raw-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  // ─── QA P0-1 ──────────────────────────────────────────────────────────
  describe('createGuestUser', () => {
    it('never looks up existing accounts; a duplicate contact is LOGIN_REQUIRED', async () => {
      const { Prisma } = jest.requireActual('@prisma/client');
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const err = await service
        .createGuestUser({
          email: 'admin@textileshop.com',
          phone: '+94770000000',
          fullName: 'Attacker',
          emailVerified: false,
          phoneVerified: false,
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({ code: 'LOGIN_REQUIRED' });
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('creates only CUSTOMER accounts', async () => {
      prisma.user.create.mockResolvedValue(makeUser());
      await service.createGuestUser({
        email: 'new@x.com',
        phone: '+94771111111',
        fullName: 'New Guest',
        emailVerified: false,
        phoneVerified: false,
      });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'CUSTOMER' }),
        }),
      );
    });
  });
});
