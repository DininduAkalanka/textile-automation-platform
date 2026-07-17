import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { OrderConfirmationEmail } from '../email/templates/order-confirmation-email';
import { PaymentFailedEmail } from '../email/templates/payment-failed-email';
import { PaymentRejectedEmail } from '../email/templates/payment-rejected-email';
import { AdminPaymentMismatchEmail } from '../email/templates/admin-payment-mismatch-email';

/**
 * External (email/SMS) notifications for order & payment events.
 *
 * Deliberately separate from the in-app Notification rows: those are written by
 * each producer INSIDE its own transaction (see notifications.service.ts's
 * header); this service only sends AFTER the transaction has committed, because
 * an email cannot be rolled back. Every method is fire-and-forget safe — it
 * never throws, so a provider outage can never fail the business operation
 * (same contract as EmailService/SmsService themselves).
 *
 * Channel choice: email when the customer has one (rich template), otherwise a
 * concise SMS to their phone. Phone-only customers still get the full detail
 * in-app under My Orders.
 */
@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  /** Invoice-style confirmation, fired once when an order becomes CONFIRMED. */
  async sendOrderConfirmation(orderId: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: {
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
          items: { include: { product: { select: { name: true } } } },
        },
      });
      if (!order) return;

      const orderUrl = `${this.frontendUrl}/account/orders/${order.id}`;
      if (order.user.email) {
        await this.emailService.send({
          to: order.user.email,
          subject: `Order ${order.orderNumber} confirmed`,
          react: OrderConfirmationEmail({
            customerName: order.user.firstName,
            orderNumber: order.orderNumber,
            orderUrl,
            items: order.items.map((item) => ({
              name: item.product.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice.toFixed(2),
              totalPrice: item.totalPrice.toFixed(2),
            })),
            subtotal: order.subtotal.toFixed(2),
            shippingCost: order.shippingCost.toFixed(2),
            tax: order.tax.toFixed(2),
            total: order.total.toFixed(2),
            currency: 'LKR',
          }),
        });
      } else if (order.user.phone) {
        await this.smsService.send(
          order.user.phone,
          `TextileShop: order ${order.orderNumber} confirmed — total LKR ${order.total.toFixed(2)}. We'll update you as it progresses.`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Order-confirmation dispatch failed for ${orderId}: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }
  }

  /** Gateway reported the payment as failed — customer can retry. */
  async sendPaymentFailed(orderId: string): Promise<void> {
    await this.sendPaymentProblem(orderId, 'failed');
  }

  /** Admin rejected the payment (e.g. unverifiable bank slip). */
  async sendPaymentRejected(orderId: string): Promise<void> {
    await this.sendPaymentProblem(orderId, 'rejected');
  }

  private async sendPaymentProblem(
    orderId: string,
    kind: 'failed' | 'rejected',
  ): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { email: true, phone: true, firstName: true } },
        },
      });
      if (!order) return;

      const orderUrl = `${this.frontendUrl}/account/orders/${order.id}`;
      if (order.user.email) {
        await this.emailService.send({
          to: order.user.email,
          subject:
            kind === 'failed'
              ? `Payment for order ${order.orderNumber} didn't go through`
              : `Payment for order ${order.orderNumber} could not be verified`,
          react:
            kind === 'failed'
              ? PaymentFailedEmail({
                  customerName: order.user.firstName,
                  orderNumber: order.orderNumber,
                  retryUrl: orderUrl,
                })
              : PaymentRejectedEmail({
                  customerName: order.user.firstName,
                  orderNumber: order.orderNumber,
                  orderUrl,
                }),
        });
      } else if (order.user.phone) {
        await this.smsService.send(
          order.user.phone,
          kind === 'failed'
            ? `TextileShop: payment for order ${order.orderNumber} failed. Nothing was charged — please retry from My Orders.`
            : `TextileShop: we couldn't verify payment for order ${order.orderNumber}. Please contact us or submit it again.`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Payment-${kind} dispatch failed for ${orderId}: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }
  }

  /**
   * A correctly-signed webhook carried the WRONG amount — tampering or gateway
   * misconfiguration. Emails ADMIN_ALERT_EMAIL; skipped with a log when unset
   * (ownership of that check lives here so callers never need to).
   */
  async sendAdminAmountMismatch(input: {
    orderNumber: string;
    expectedAmount: string;
    receivedAmount: string;
    currency: string;
    transactionId: string;
  }): Promise<void> {
    try {
      const to = this.config.get<string>('ADMIN_ALERT_EMAIL');
      if (!to) {
        this.logger.warn(
          `ADMIN_ALERT_EMAIL not set — amount-mismatch alert for ${input.orderNumber} not emailed`,
        );
        return;
      }
      await this.emailService.send({
        to,
        subject: `⚠ Payment amount mismatch on order ${input.orderNumber}`,
        react: AdminPaymentMismatchEmail(input),
      });
    } catch (err) {
      this.logger.warn(
        `Admin mismatch dispatch failed for ${input.orderNumber}: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }
  }
}
