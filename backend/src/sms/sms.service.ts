import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SmsProvider = 'notifylk' | 'textlk';

const SEND_TIMEOUT_MS = 10_000;

/**
 * Outbound SMS via a Sri Lankan gateway (Notify.lk or Text.lk — cheaper for LK
 * numbers than Twilio). OPTIONAL, like EmailService: with no `SMS_API_KEY` the
 * app boots and every send is a logged no-op (so the OTP flow is demoable
 * locally without a paid account). `send()` NEVER throws.
 *
 * The gateway HTTP shapes below follow each provider's documented API; confirm
 * against the live docs when a provider is actually activated — the never-throws
 * wrapper means a mismatch degrades to a logged warning, not a crash.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: SmsProvider | null;
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly userId: string; // Notify.lk requires a user_id alongside the key

  constructor(private readonly config: ConfigService) {
    const provider = this.config.get<string>('SMS_PROVIDER') as
      | SmsProvider
      | undefined;
    this.apiKey = this.config.get<string>('SMS_API_KEY') ?? '';
    this.senderId = this.config.get<string>('SMS_SENDER_ID') || 'TextileShop';
    this.userId = this.config.get<string>('SMS_USER_ID') ?? '';
    if (provider && this.apiKey) {
      this.provider = provider;
      this.logger.log(`SMS provider "${provider}" initialized`);
    } else {
      this.provider = null;
      this.logger.warn(
        'SMS_PROVIDER/SMS_API_KEY not set — SMS will be logged, not sent',
      );
    }
  }

  get isConfigured(): boolean {
    return this.provider !== null;
  }

  async send(to: string, message: string): Promise<void> {
    if (!this.provider) {
      this.logger.warn(`SMS NOT sent (no gateway). To: ${to} | ${message}`);
      return;
    }
    // Gateways expect the number without the leading '+': 94771234567.
    const local = to.replace(/^\+/, '');
    try {
      if (this.provider === 'notifylk') {
        await this.sendNotifyLk(local, message);
      } else {
        await this.sendTextLk(local, message);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to send SMS to ${to}: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async sendNotifyLk(to: string, message: string): Promise<void> {
    const params = new URLSearchParams({
      user_id: this.userId,
      api_key: this.apiKey,
      sender_id: this.senderId,
      to,
      message,
    });
    const res = await this.fetchWithTimeout(
      `https://app.notify.lk/api/v1/send?${params.toString()}`,
      { method: 'POST' },
    );
    if (!res.ok) this.logger.warn(`Notify.lk responded HTTP ${res.status}`);
  }

  private async sendTextLk(to: string, message: string): Promise<void> {
    const res = await this.fetchWithTimeout(
      'https://app.text.lk/api/v3/sms/send',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          recipient: to,
          sender_id: this.senderId,
          type: 'plain',
          message,
        }),
      },
    );
    if (!res.ok) this.logger.warn(`Text.lk responded HTTP ${res.status}`);
  }
}
