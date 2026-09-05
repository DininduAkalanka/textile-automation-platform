import { PrismaClient } from '@prisma/client';
import { seedCatalog } from './seed';
import { seedHistory } from './seed-history';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Clean Database Reset for Nandana Textile...\n');

  console.log('1️⃣  Cleaning obsolete transactional & product records in safe FK order...');

  // Safe reverse-FK order
  console.log('   - Clearing review helpful votes & reports...');
  await prisma.reviewHelpfulVote.deleteMany({});
  await prisma.reviewReport.deleteMany({});

  console.log('   - Clearing product reviews...');
  await prisma.review.deleteMany({});

  console.log('   - Clearing social media posts...');
  await prisma.socialPost.deleteMany({});

  console.log('   - Clearing production tasks...');
  await prisma.productionTask.deleteMany({});

  console.log('   - Clearing installments & payments...');
  await prisma.installment.deleteMany({});
  await prisma.payment.deleteMany({});

  console.log('   - Clearing order status history...');
  await prisma.orderStatusHistory.deleteMany({});

  console.log('   - Clearing inventory movements (releasing order restrict FK)...');
  await prisma.inventoryMovement.deleteMany({});

  console.log('   - Clearing order line items & orders...');
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});

  console.log('   - Clearing inventory ledgers...');
  await prisma.inventory.deleteMany({});

  console.log('   - Clearing all legacy products...');
  const deletedProducts = await prisma.product.deleteMany({});
  console.log(`   ✅ Removed ${deletedProducts.count} legacy products.`);

  // Clean any unused obsolete categories not part of the standard hierarchy
  const STANDARD_SLUGS = [
    'women',
    'men',
    'teenagers',
    'uniforms',
    'school-uniforms',
    'corporate-uniforms',
    'healthcare-uniforms',
    'industrial-uniforms',
  ];
  const obsoleteCategories = await prisma.category.findMany({
    where: {
      slug: { notIn: STANDARD_SLUGS },
      children: { none: {} },
      products: { none: {} },
    },
  });
  if (obsoleteCategories.length > 0) {
    console.log(`   - Removing ${obsoleteCategories.length} obsolete categories...`);
    await prisma.category.deleteMany({
      where: { id: { in: obsoleteCategories.map((c) => c.id) } },
    });
  }

  console.log('\n2️⃣  Executing main catalog seed (35 curated Sri Lankan products across 7 categories)...');
  await seedCatalog();

  console.log('\n3️⃣  Seeding rich sales history and active production floor tasks...');
  await seedHistory();

  console.log('\n🎉 CLEAN RESET & RE-SEED COMPLETED SUCCESSFULLY!');
  console.log('--------------------------------------------------');
  console.log('Catalog: Exactly 35 authentic products (5 per category)');
  console.log('Inventory: Fresh ledgers opened with 3 realistic low-stock alerts');
  console.log('Sales & Production: Active production board & ~40 weeks of demand data');
}

main()
  .catch((e) => {
    console.error('❌ Clean reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
