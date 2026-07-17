import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

const build = async (env: Record<string, string | undefined>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      SmsService,
      { provide: ConfigService, useValue: { get: (k: string) => env[k] } },
    ],
  }).compile();
  return moduleRef.get(SmsService);
};

describe('SmsService', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('unconfigured (no gateway)', () => {
    it('reports not configured and never sends', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      const service = await build({});
      expect(service.isConfigured).toBe(false);
      await expect(
        service.send('+94771234567', 'hello'),
      ).resolves.toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('configured', () => {
    it('is configured when provider + key are present', async () => {
      const service = await build({
        SMS_PROVIDER: 'textlk',
        SMS_API_KEY: 'k',
      });
      expect(service.isConfigured).toBe(true);
    });

    it('never throws even when the gateway request rejects', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockRejectedValue(new Error('gateway unreachable'));
      const service = await build({
        SMS_PROVIDER: 'notifylk',
        SMS_API_KEY: 'k',
        SMS_USER_ID: '1',
      });

      await expect(
        service.send('+94771234567', 'hello'),
      ).resolves.toBeUndefined();
    });
  });
});
