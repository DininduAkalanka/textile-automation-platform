import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import type { ReactElement } from 'react';

/**
 * Outbound email. OPTIONAL infrastructure, exactly like the Stripe client in
 * PaymentsService: with no `RESEND_API_KEY` the app boots normally and every
 * send becomes a logged no-op (the body — including any OTP — is printed so the
 * flow is fully demoable locally without a provider). `send()` NEVER throws —
 * a failed email must never break the business action that triggered it, the
 * same rule AiService follows for the assistant.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('RESEND_API_KEY');
    this.from =
      this.config.get<string>('EMAIL_FROM') ||
      'TextileShop <onboarding@resend.dev>';
    if (key) {
      this.resend = new Resend(key);
      this.logger.log('Resend initialized — emails will be sent');
    } else {
      this.resend = null;
      this.logger.warn(
        'RESEND_API_KEY not set — emails will be logged, not sent',
      );
    }
  }

  get isConfigured(): boolean {
    return this.resend !== null;
  }

  /**
   * Send an email. Content is either a raw `html` string or a `react` element
   * (a React Email template), which is rendered to HTML here so callers in
   * plain .ts files never need JSX.
   */
  async send(opts: {
    to: string;
    subject: string;
    html?: string;
    react?: ReactElement;
  }): Promise<void> {
    let html = opts.html ?? '';
    if (opts.react) {
      try {
        html = await render(opts.react);
      } catch (err) {
        this.logger.warn(
          `Failed to render template for "${opts.subject}": ${
            err instanceof Error ? err.message : 'unknown error'
          }`,
        );
        return; // nothing sensible to send
      }
    }

    if (!this.resend) {
      this.logger.warn(
        `Email NOT sent (no RESEND_API_KEY). To: ${opts.to} | Subject: ${opts.subject}`,
      );
      this.logger.debug(`Email body preview:\n${html}`);
      return;
    }
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: opts.to,
        subject: opts.subject,
        html,
      });
      if (error) {
        this.logger.warn(
          `Resend rejected "${opts.subject}" to ${opts.to}: ${error.message}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to send "${opts.subject}" to ${opts.to}: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }
  }
}
