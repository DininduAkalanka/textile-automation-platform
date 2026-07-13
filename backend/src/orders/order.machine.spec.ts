import { OrderStatus } from '@prisma/client';

import {
  IllegalOrderTransition,
  OrderAction,
  allowedOrderActions,
  assertTransition,
  canTransition,
  orderStatusNotification,
} from './order.machine';

/**
 * The order status machine (plan §4.1, BR6).
 *
 * These tests are the specification. Neither orders.service.ts nor
 * production.service.ts is allowed to decide a status for itself — both map
 * whatever this returns onto the row — so if a rule is not here, it does not
 * exist, and if the two services ever disagree again, it is because ONE of them
 * stopped importing this file, which is a much louder mistake to make.
 */
describe('order status machine', () => {
  const {
    PENDING,
    CONFIRMED,
    IN_PRODUCTION,
    QUALITY_CHECK,
    COMPLETED,
    DELIVERED,
    CANCELLED,
  } = OrderStatus;

  describe('the happy path: placed to delivered', () => {
    it('walks PENDING → CONFIRMED → IN_PRODUCTION → QUALITY_CHECK → COMPLETED → DELIVERED', () => {
      const path: OrderStatus[] = [
        PENDING,
        CONFIRMED,
        IN_PRODUCTION,
        QUALITY_CHECK,
        COMPLETED,
        DELIVERED,
      ];
      for (let i = 0; i < path.length - 1; i++) {
        expect(canTransition(path[i], path[i + 1])).toBe(true);
      }
    });

    it('lets a fulfillment-only order skip production entirely', () => {
      // CONFIRMED -> COMPLETED directly: no uniform, no custom item, nothing for
      // the floor to do. This is the "advance" verb's whole reason to exist.
      expect(canTransition(CONFIRMED, COMPLETED)).toBe(true);
    });
  });

  describe('the QC-fail contradiction (the reason this file exists)', () => {
    /**
     * This is not a hypothetical edge. production.machine.ts's `qc_fail` action
     * ALREADY sends a rejected task from QUALITY_CHECK back to FINISHING, and
     * production.service.ts's syncOrderStatus ALREADY follows that by moving the
     * ORDER from QUALITY_CHECK back to IN_PRODUCTION — correctly, because an
     * order cannot claim to be "being inspected" while a worker is re-stitching
     * it. Before this file existed, orders.service.ts's OWN transition map
     * forbade exactly this move, and nothing ever checked production's write
     * against it. The two modules disagreed and nothing noticed.
     */
    it('allows QUALITY_CHECK -> IN_PRODUCTION — a QC failure pulling work back', () => {
      expect(canTransition(QUALITY_CHECK, IN_PRODUCTION)).toBe(true);
    });

    it('the order can be re-inspected and pass after rework (the loop closes)', () => {
      expect(canTransition(IN_PRODUCTION, QUALITY_CHECK)).toBe(true);
      expect(canTransition(QUALITY_CHECK, COMPLETED)).toBe(true);
    });
  });

  describe('cancellation — only before production has shipped anything', () => {
    it('is legal from PENDING and CONFIRMED', () => {
      expect(canTransition(PENDING, CANCELLED)).toBe(true);
      expect(canTransition(CONFIRMED, CANCELLED)).toBe(true);
    });

    it('is illegal once the floor has started, or after delivery', () => {
      for (const from of [IN_PRODUCTION, QUALITY_CHECK, COMPLETED, DELIVERED]) {
        expect(canTransition(from, CANCELLED)).toBe(false);
      }
    });
  });

  describe('terminal states', () => {
    it('DELIVERED and CANCELLED go nowhere', () => {
      expect(canTransition(DELIVERED, PENDING)).toBe(false);
      expect(canTransition(DELIVERED, COMPLETED)).toBe(false);
      expect(canTransition(CANCELLED, PENDING)).toBe(false);
      expect(canTransition(CANCELLED, CONFIRMED)).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('is silent on a legal move', () => {
      expect(() => assertTransition(PENDING, CONFIRMED)).not.toThrow();
    });

    it('throws IllegalOrderTransition on an illegal one, naming both states', () => {
      expect(() => assertTransition(DELIVERED, PENDING)).toThrow(
        IllegalOrderTransition,
      );
      expect(() => assertTransition(DELIVERED, PENDING)).toThrow(
        /DELIVERED.*PENDING/,
      );
    });
  });

  describe('allowedOrderActions — the admin verbs, single source for the UI', () => {
    it('offers only cancel on a fresh PENDING order', () => {
      expect(
        allowedOrderActions({ status: PENDING, hasProductionTasks: false }),
      ).toEqual<OrderAction[]>(['cancel']);
    });

    it('offers cancel and advance on a fulfillment-only CONFIRMED order', () => {
      expect(
        allowedOrderActions({
          status: CONFIRMED,
          hasProductionTasks: false,
        }).sort(),
      ).toEqual(['advance', 'cancel']);
    });

    /**
     * The one rule that is NOT in the pure graph: reaching COMPLETED from
     * CONFIRMED is legal in general (fulfillment-only orders do it), but an order
     * WITH production tasks reaches COMPLETED automatically as the floor finishes
     * — offering "advance" here would let an admin race that automation and ship
     * a garment nobody made.
     */
    it('withholds advance — but keeps cancel — on a CONFIRMED order that has production tasks', () => {
      expect(
        allowedOrderActions({ status: CONFIRMED, hasProductionTasks: true }),
      ).toEqual<OrderAction[]>(['cancel']);
    });

    it('offers only deliver once COMPLETED', () => {
      expect(
        allowedOrderActions({ status: COMPLETED, hasProductionTasks: false }),
      ).toEqual<OrderAction[]>(['deliver']);
      // hasProductionTasks is irrelevant by now — the order already got here.
      expect(
        allowedOrderActions({ status: COMPLETED, hasProductionTasks: true }),
      ).toEqual<OrderAction[]>(['deliver']);
    });

    it('offers nothing once DELIVERED or CANCELLED — both are dead ends', () => {
      expect(
        allowedOrderActions({ status: DELIVERED, hasProductionTasks: false }),
      ).toEqual([]);
      expect(
        allowedOrderActions({ status: CANCELLED, hasProductionTasks: false }),
      ).toEqual([]);
    });

    it('offers nothing mid-production — the floor is driving, not the admin', () => {
      expect(
        allowedOrderActions({
          status: IN_PRODUCTION,
          hasProductionTasks: true,
        }),
      ).toEqual([]);
      expect(
        allowedOrderActions({
          status: QUALITY_CHECK,
          hasProductionTasks: true,
        }),
      ).toEqual([]);
    });
  });

  describe('orderStatusNotification — the ONLY place notification copy is written', () => {
    it('says nothing for PENDING — a customer does not need telling about their own click', () => {
      expect(orderStatusNotification(PENDING, 'TXL-1')).toBeNull();
    });

    it('names the order in the title for every status that DOES notify', () => {
      const notifying = [
        CONFIRMED,
        IN_PRODUCTION,
        QUALITY_CHECK,
        COMPLETED,
        DELIVERED,
        CANCELLED,
      ];
      for (const status of notifying) {
        const copy = orderStatusNotification(status, 'TXL-42');
        expect(copy).not.toBeNull();
        expect(copy!.title).toContain('TXL-42');
      }
    });

    it('appends detail to the body without losing the base message', () => {
      const plain = orderStatusNotification(CANCELLED, 'TXL-1');
      const withRefund = orderStatusNotification(
        CANCELLED,
        'TXL-1',
        'A refund will be processed manually.',
      );

      expect(withRefund!.body).toContain(plain!.body);
      expect(withRefund!.body).toContain('refund will be processed manually');
    });
  });
});
