import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';

import {
  expirySweepEnabled,
  expirySweepIntervalMs,
  reservationTtlMinutes,
} from '../common/config/limits';
import { OrdersService } from './orders.service';

/**
 * QA P0-2: the job that was missing.
 *
 * Every unpaid order reserves its stock at placement. Before this service,
 * nothing ever gave that stock back: an abandoned PayHere checkout, an unpaid
 * first installment, or one abusive anonymous request held stock forever and
 * the storefront showed the product as sold out.
 *
 * Every ORDER_EXPIRY_SWEEP_INTERVAL_MS (default 60 s) this cancels PENDING
 * orders older than ORDER_RESERVATION_TTL_MINUTES (default 30) that have not
 * been paid, releasing their reservations. Cash on Delivery is never touched
 * (it is confirmed at placement).
 *
 * Safe with several API instances: each order is cancelled in its own
 * transaction under the order row lock and re-checked there, so two sweepers
 * (or a sweeper racing a payment webhook) can never both act on one order.
 * A plain interval rather than a cron library — one less dependency, and the
 * interval only decides how promptly stock comes back, never correctness.
 */
@Injectable()
export class OrderExpiryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OrderExpiryService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly orders: OrdersService) {}

  onApplicationBootstrap() {
    if (!expirySweepEnabled()) return;
    const every = expirySweepIntervalMs();
    this.timer = setInterval(() => void this.sweep(), every);
    this.timer.unref(); // never keep the process alive just for this
    this.logger.log(
      `Unpaid orders release their stock after ${reservationTtlMinutes()} min (checked every ${Math.round(every / 1000)} s)`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One pass. Public so tests (and an operator) can run it on demand. */
  async sweep(): Promise<{ cancelled: number }> {
    if (this.running) return { cancelled: 0 };
    this.running = true;
    let cancelled = 0;
    try {
      const ids = await this.orders.findExpiredUnpaidOrderIds();
      for (const id of ids) {
        try {
          if (await this.orders.expireUnpaidOrder(id)) cancelled++;
        } catch (err) {
          this.logger.warn(
            `Could not expire order ${id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      if (cancelled > 0) {
        this.logger.log(`Released stock from ${cancelled} unpaid order(s)`);
      }
    } catch (err) {
      this.logger.error(
        `Reservation sweep failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
    return { cancelled };
  }
}
