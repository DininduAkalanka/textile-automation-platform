/**
 * Demo SALES HISTORY seed — gives the demand forecaster real signal to work on.
 *
 * Inserts ~10 months of backdated COMPLETED orders across the seeded catalogue,
 * with a gentle upward trend (a growing shop), weekend bumps, and a school-term
 * spike for uniforms — so the forecast chart shows something believable in a
 * demo instead of a flat line on three real test orders.
 *
 * IMPORTANT — this deliberately does NOT run the reservation/ledger flow. These
 * are historical *sales facts* for analytics only (the ai_sales_facts view reads
 * orders/items/payments, never inventory movements). Re-deducting them from
 * today's live stock would be wrong, so today's inventory is left untouched.
 *
 * Idempotent: every order is tagged `HIST-…`; a re-run clears the previous batch
 * first. Deterministic PRNG, so runs are reproducible.
 *
 *   npm run db:seed:history
 */
import { PrismaClient, OrderStatus, PaymentStatus, PaymentMethod } from '@prisma/client';

const prisma = new PrismaClient();

const WEEKS_BACK = 40;
const HIST_PREFIX = 'HIST-';

// Deterministic PRNG (mulberry32) — reproducible history across runs.
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260718);
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

const SHIPPING = {
  fullName: 'Demo Customer',
  addressLine1: '1 Galle Road',
  city: 'Colombo',
  state: 'Western',
  postalCode: '00300',
  country: 'LK',
};

async function main() {
  console.log('📈 Seeding demo sales history…');

  // 1. Clear any prior HIST- batch (children first, then orders).
  const prior = await prisma.order.findMany({
    where: { orderNumber: { startsWith: HIST_PREFIX } },
    select: { id: true },
  });
  if (prior.length) {
    const ids = prior.map((o) => o.id);
    await prisma.payment.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    console.log(`   cleared ${prior.length} prior history orders`);
  }

  // 2. Who and what.
  const customer = await prisma.user.findFirst({
    where: { email: 'customer@example.com' },
    select: { id: true },
  });
  if (!customer) throw new Error('Run the main seed first (customer@example.com missing).');

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, price: true, productType: true },
  });
  if (products.length < 3) throw new Error('Not enough products — run the main seed first.');

  // 3. Generate week by week, backdated.
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  let counter = 0;
  let orderCount = 0;
  let itemCount = 0;

  for (let w = WEEKS_BACK; w >= 0; w--) {
    const weekStart = now - w * WEEK;
    const trend = 1 + (WEEKS_BACK - w) * 0.015; // ~a growing shop over time
    const ordersThisWeek = Math.max(3, Math.round(between(9, 15) * trend));

    for (let i = 0; i < ordersThisWeek; i++) {
      const placedAt = new Date(weekStart + between(0, 6) * 86_400_000 + between(8, 20) * 3_600_000);
      const month = placedAt.getMonth(); // 0-based
      const isWeekend = [0, 6].includes(placedAt.getDay());
      // Sri Lankan school terms begin ~Jan, May, Sep — uniforms spike before them.
      const uniformSeason = [0, 4, 8].includes(month);

      const nItems = between(1, 3);
      const chosen = new Set<string>();
      const items: { productId: string; quantity: number; unitPrice: string; totalPrice: string }[] = [];
      let subtotal = 0;

      for (let k = 0; k < nItems; k++) {
        const product = pick(products);
        if (chosen.has(product.id)) continue;
        chosen.add(product.id);

        const isUniform = product.productType === 'UNIFORM';
        let qty = between(1, isWeekend ? 4 : 3);
        if (isUniform && uniformSeason) qty += between(1, 3); // seasonal boost
        const unit = Number(product.price);
        const line = unit * qty;
        subtotal += line;
        items.push({
          productId: product.id,
          quantity: qty,
          unitPrice: unit.toFixed(2),
          totalPrice: line.toFixed(2),
        });
      }
      if (!items.length) continue;

      counter += 1;
      const total = subtotal.toFixed(2);
      await prisma.order.create({
        data: {
          orderNumber: `${HIST_PREFIX}${String(counter).padStart(6, '0')}`,
          userId: customer.id,
          subtotal: total,
          tax: '0',
          shippingCost: '0',
          total,
          status: OrderStatus.COMPLETED,
          shippingAddress: SHIPPING,
          createdAt: placedAt,
          items: { create: items },
          payment: {
            create: {
              amount: total,
              currency: 'LKR',
              status: PaymentStatus.COMPLETED,
              method: rand() < 0.6 ? PaymentMethod.PAYHERE : PaymentMethod.COD,
              paidAt: new Date(placedAt.getTime() + 2 * 3_600_000),
              createdAt: placedAt,
            },
          },
        },
      });
      orderCount += 1;
      itemCount += items.length;
    }
  }

  console.log(`✅ Seeded ${orderCount} historical orders (${itemCount} line items) over ${WEEKS_BACK} weeks.`);
  console.log('   Forecast, trending, dead-stock and bought-together now have data.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
