/**
 * Demo SALES HISTORY & ACTIVE PRODUCTION seed
 *
 * 1. Inserts ~40 weeks of backdated COMPLETED orders across the seeded catalogue,
 *    giving the AI demand forecaster, trending detector, and sales chart rich data.
 * 2. Seeds 4 active in-progress production floor orders with tasks across
 *    CUTTING, STITCHING, FINISHING, and QUALITY_CHECK, giving the Admin Kanban Board
 *    and Worker Portals active tasks to manage.
 * 3. Seeds verified customer reviews for key Sri Lankan products.
 *
 *   npm run db:seed:history
 */
import {
  PrismaClient,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  ProductionStage,
  TaskStatus,
  ReviewSizeFeedback,
  ReviewStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const WEEKS_BACK = 40;
const HIST_PREFIX = 'HIST-';
const DEMO_ACTIVE_PREFIX = 'DEMO-ACT-';

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

export async function seedHistory() {
  console.log('📈 Seeding demo sales history and production floor tasks…');

  // 1. Clear any prior HIST- and DEMO-ACT- batches (children first, then orders).
  const prior = await prisma.order.findMany({
    where: {
      OR: [
        { orderNumber: { startsWith: HIST_PREFIX } },
        { orderNumber: { startsWith: DEMO_ACTIVE_PREFIX } },
      ],
    },
    select: { id: true },
  });
  if (prior.length) {
    const ids = prior.map((o) => o.id);
    await prisma.reviewHelpfulVote.deleteMany({
      where: { review: { orderId: { in: ids } } },
    });
    await prisma.reviewReport.deleteMany({
      where: { review: { orderId: { in: ids } } },
    });
    await prisma.review.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.productionTask.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    console.log(`   cleared ${prior.length} prior demo orders`);
  }

  // 2. Lookup customer and workers.
  const customer = await prisma.user.findFirst({
    where: { email: 'customer@example.com' },
    select: { id: true },
  });
  if (!customer) throw new Error('Run the main seed first (customer@example.com missing).');

  const cuttingWorker = await prisma.worker.findFirst({
    where: { specialization: ProductionStage.CUTTING },
    select: { id: true },
  });
  const stitchingWorker = await prisma.worker.findFirst({
    where: { specialization: ProductionStage.STITCHING },
    select: { id: true },
  });

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, price: true, productType: true, slug: true, requiresMeasurement: true },
  });
  if (products.length < 3) throw new Error('Not enough products — run the main seed first.');

  // 3. Generate week by week, backdated historical orders.
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  let counter = 0;
  let orderCount = 0;
  let itemCount = 0;
  const createdCompletedOrders: { orderId: string; productId: string }[] = [];

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
      const order = await prisma.order.create({
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
        include: { items: true },
      });

      if (order.items.length > 0 && createdCompletedOrders.length < 10) {
        createdCompletedOrders.push({
          orderId: order.id,
          productId: order.items[0].productId,
        });
      }

      orderCount += 1;
      itemCount += items.length;
    }
  }
  console.log(`✅ Seeded ${orderCount} historical orders (${itemCount} line items) over ${WEEKS_BACK} weeks.`);

  // 4. Seed 4 Active In-Flight Production Orders across the 4 Kanban Stages
  console.log('🧵 Seeding active production floor orders & tasks for Admin Kanban Board…');

  const uniformProducts = products.filter(
    (p) => p.productType === 'UNIFORM' || p.requiresMeasurement,
  );
  if (uniformProducts.length >= 4) {
    const activePipelineConfigs = [
      {
        stage: ProductionStage.CUTTING,
        taskStatus: TaskStatus.IN_PROGRESS,
        workerId: cuttingWorker?.id ?? null,
        note: 'High-precision cutting of 20 units school frocks as per pattern.',
        startTime: new Date(Date.now() - 3 * 3600000),
      },
      {
        stage: ProductionStage.STITCHING,
        taskStatus: TaskStatus.IN_PROGRESS,
        workerId: stitchingWorker?.id ?? null,
        note: 'Double needle seam stitching on short sleeve school uniform shirts.',
        startTime: new Date(Date.now() - 2 * 3600000),
      },
      {
        stage: ProductionStage.FINISHING,
        taskStatus: TaskStatus.PENDING,
        workerId: null,
        note: 'Awaiting button installation and steam press finishing.',
        startTime: null,
      },
      {
        stage: ProductionStage.QUALITY_CHECK,
        taskStatus: TaskStatus.PENDING,
        workerId: null,
        note: 'Finished batch awaiting final dimensional tolerance QC check.',
        startTime: null,
      },
    ];

    for (let idx = 0; idx < activePipelineConfigs.length; idx++) {
      const cfg = activePipelineConfigs[idx];
      const prod = uniformProducts[idx];
      const price = Number(prod.price);
      const qty = 5 + idx * 3;
      const total = (price * qty).toFixed(2);

      const activeOrder = await prisma.order.create({
        data: {
          orderNumber: `${DEMO_ACTIVE_PREFIX}${String(idx + 1).padStart(4, '0')}`,
          userId: customer.id,
          subtotal: total,
          tax: '0',
          shippingCost: '0',
          total,
          status: OrderStatus.CONFIRMED,
          shippingAddress: SHIPPING,
          createdAt: new Date(Date.now() - (idx + 1) * 24 * 3600000),
          items: {
            create: [
              {
                productId: prod.id,
                quantity: qty,
                unitPrice: price.toFixed(2),
                totalPrice: total,
                measurements: {
                  chest: '38',
                  waist: '32',
                  length: '40',
                  standardSize: 'M',
                },
              },
            ],
          },
          payment: {
            create: {
              amount: total,
              currency: 'LKR',
              status: PaymentStatus.COMPLETED,
              method: PaymentMethod.PAYHERE,
              paidAt: new Date(Date.now() - (idx + 1) * 24 * 3600000),
            },
          },
        },
        include: { items: true },
      });

      // Create the production task
      await prisma.productionTask.create({
        data: {
          orderId: activeOrder.id,
          orderItemId: activeOrder.items[0].id,
          stage: cfg.stage,
          status: cfg.taskStatus,
          assignedWorkerId: cfg.workerId,
          note: cfg.note,
          startTime: cfg.startTime,
        },
      });
    }
    console.log('✅ Seeded 4 active production tasks across CUTTING, STITCHING, FINISHING, QUALITY_CHECK.');
  }

  // 5. Seed Verified Reviews for Top Showcase Products
  console.log('⭐ Seeding verified customer reviews for top products…');
  const topSlugs = [
    'border-detailed-handloom-saree',
    'engage-long-sleeve-striped-shirt',
    'girls-school-uniform-frock-5-pleat',
    'bella-doctor-consultation-overcoat',
  ];

  const reviewTemplates = [
    {
      title: 'Stunning craftsmanship and traditional handloom feel!',
      comment: 'Wore this for an auspicious function in Kandy. The intricate woven border detail is exceptionally rich and the drape was effortless throughout the evening. Highly recommended!',
      rating: 5,
      fabricRating: 5,
      colorAccuracyRating: 5,
      comfortRating: 5,
    },
    {
      title: 'Sharp fit for Colombo corporate meetings',
      comment: 'Crisp poplin collar and high quality striped stitching. Breathable fabric that keeps me cool during long commutes. True to size.',
      rating: 5,
      fabricRating: 5,
      colorAccuracyRating: 4,
      comfortRating: 5,
    },
    {
      title: 'School regulation compliant and durable',
      comment: 'The five pleats hold shape nicely after multiple machine washes. Fabric does not turn yellowish. Excellent school uniform quality.',
      rating: 5,
      fabricRating: 5,
      colorAccuracyRating: 5,
      comfortRating: 4,
    },
    {
      title: 'Heavyweight cotton drill — clinical grade',
      comment: 'Solid medical lab coat with plenty of pocket room for my stethoscope and notebook. Side pass-through slits are very convenient.',
      rating: 5,
      fabricRating: 5,
      colorAccuracyRating: 5,
      comfortRating: 5,
    },
  ];

  for (let i = 0; i < topSlugs.length; i++) {
    const slug = topSlugs[i];
    const prod = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!prod || !createdCompletedOrders[i]) continue;

    const tpl = reviewTemplates[i];
    await prisma.review.create({
      data: {
        productId: prod.id,
        orderId: createdCompletedOrders[i].orderId,
        userId: customer.id,
        rating: tpl.rating,
        title: tpl.title,
        comment: tpl.comment,
        fabricRating: tpl.fabricRating,
        colorAccuracyRating: tpl.colorAccuracyRating,
        comfortRating: tpl.comfortRating,
        sizeFeedback: ReviewSizeFeedback.TRUE_TO_SIZE,
        wouldRecommend: true,
        isVerifiedPurchase: true,
        status: ReviewStatus.PUBLISHED,
        helpfulCount: between(2, 8),
      },
    });
  }
  console.log('✅ Seeded authentic verified reviews for flagship products.');

  console.log('🎉 Demo sales history, production tasks, and reviews are fully seeded.');
}

if (require.main === module) {
  seedHistory()
    .catch((e) => {
      console.error('❌ seed-history error:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
