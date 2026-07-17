import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailService } from './email.service';

jest.mock('resend');
const MockResend = Resend as jest.MockedClass<typeof Resend>;

const build = async (env: Record<string, string | undefined>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      EmailService,
      { provide: ConfigService, useValue: { get: (k: string) => env[k] } },
    ],
  }).compile();
  return moduleRef.get(EmailService);
};

describe('EmailService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('unconfigured (no RESEND_API_KEY)', () => {
    it('reports not configured and never sends', async () => {
      const service = await build({});
      expect(service.isConfigured).toBe(false);
      await expect(
        service.send({ to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('configured', () => {
    it('is configured with a key present', async () => {
      MockResend.mockImplementation(
        () => ({ emails: { send: jest.fn() } }) as unknown as Resend,
      );
      const service = await build({ RESEND_API_KEY: 'test_key' });
      expect(service.isConfigured).toBe(true);
    });

    it('never throws even when the provider send rejects', async () => {
      const send = jest.fn().mockRejectedValue(new Error('network down'));
      MockResend.mockImplementation(
        () => ({ emails: { send } }) as unknown as Resend,
      );
      const service = await build({ RESEND_API_KEY: 'test_key' });

      await expect(
        service.send({ to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>' }),
      ).resolves.toBeUndefined();
      expect(send).toHaveBeenCalledTimes(1);
    });
  });
});
