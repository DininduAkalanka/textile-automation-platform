import {
  PrismaClient,
  UserRole,
  ProductType,
  ProductionStage,
  MovementType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * A product as declared in this file. `minimumStockLevel` is not a Product
 * column — it lives on the inventory row — so it is stripped before the upsert.
 */
type ProductSeed = {
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  costPrice: number;
  stockQuantity: number;
  minimumStockLevel: number;
  sku: string;
  images: string[];
  attributes: Record<string, string>;
  categoryId: string;
  subCategory: string;
  productType: ProductType;
  requiresMeasurement: boolean;
  fabricType: string;
  color: string;
  unit: string;
};

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Create Admin User ──────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@textileshop.com' },
    update: {},
    create: {
      email: 'admin@textileshop.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      phone: '+94771234567',
      role: UserRole.ADMIN,
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  // ─── Create Test Customer ───────────────────────────────
  const customerPassword = await bcrypt.hash('Customer@123456', 12);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      passwordHash: customerPassword,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+94779876543',
      role: UserRole.CUSTOMER,
    },
  });
  console.log(`✅ Customer user created: ${customer.email}`);

  // ─── Create Workers (BR5: tasks are assigned to workers) ─
  // Workers authenticate as users with role=WORKER; the `workers` row carries
  // only production-specific attributes.
  const workerPassword = await bcrypt.hash('Worker@123456', 12);
  const workerSeeds = [
    {
      email: 'worker.cutting@textileshop.com',
      firstName: 'Sunil',
      lastName: 'Perera',
      phone: '+94771111111',
      specialization: ProductionStage.CUTTING,
      skillLevel: 4,
    },
    {
      email: 'worker.stitching@textileshop.com',
      firstName: 'Kamala',
      lastName: 'Silva',
      phone: '+94772222222',
      specialization: ProductionStage.STITCHING,
      skillLevel: 5,
    },
  ];

  for (const w of workerSeeds) {
    const user = await prisma.user.upsert({
      where: { email: w.email },
      update: {},
      create: {
        email: w.email,
        passwordHash: workerPassword,
        firstName: w.firstName,
        lastName: w.lastName,
        phone: w.phone,
        role: UserRole.WORKER,
      },
    });

    await prisma.worker.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        specialization: w.specialization,
        skillLevel: w.skillLevel,
      },
    });
  }
  console.log(`✅ ${workerSeeds.length} workers created`);

  // ─── Create Categories ──────────────────────────────────
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'women' },
      update: {},
      create: {
        name: 'Women',
        slug: 'women',
        description: 'Explore the latest trends in women\'s fashion. From elegant evening wear to casual everyday styles.',
        imageUrl: '/images/categories/women.jpg',
      },
    }),
    prisma.category.upsert({
      where: { slug: 'men' },
      update: {},
      create: {
        name: 'Men',
        slug: 'men',
        description: 'Premium menswear collection featuring formal, casual, and activewear for the modern gentleman.',
        imageUrl: '/images/categories/men.jpg',
      },
    }),
    prisma.category.upsert({
      where: { slug: 'teenagers' },
      update: {},
      create: {
        name: 'Teenagers',
        slug: 'teenagers',
        description: 'Trendy, comfortable, and vibrant clothing designed specifically for teenagers and young adults.',
        imageUrl: '/images/categories/teenagers.jpg',
      },
    }),
    prisma.category.upsert({
      where: { slug: 'uniforms' },
      update: {},
      create: {
        name: 'Uniforms',
        slug: 'uniforms',
        description: 'High-quality school and corporate uniforms designed for durability and all-day comfort.',
        imageUrl: '/images/categories/uniforms.jpg',
      },
    }),
  ]);

  // Depth-2 children under Uniforms, exercising the category tree.
  const [schoolUniforms, corporateUniforms] = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'school-uniforms' },
      update: { parentId: categories[3].id },
      create: {
        name: 'School Uniforms',
        slug: 'school-uniforms',
        description: 'Durable, easy-care uniforms for government and private schools.',
        parentId: categories[3].id,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'corporate-uniforms' },
      update: { parentId: categories[3].id },
      create: {
        name: 'Corporate Uniforms',
        slug: 'corporate-uniforms',
        description: 'Tailored corporate wear that keeps a professional look all day.',
        parentId: categories[3].id,
      },
    }),
  ]);
  console.log(`✅ ${categories.length + 2} categories created (2 nested)`);

  // ─── Create Products ────────────────────────────────────
  // productType + requiresMeasurement drive decision D8: only UNIFORM/CUSTOM
  // items, or items requiring measurement, generate production tasks.
  const products: ProductSeed[] = [
    // Women's Products
    {
      name: 'Elegant Evening Gown',
      slug: 'elegant-evening-gown',
      description: 'A stunning floor-length evening gown featuring intricate sequin detailing and a flattering silhouette. Perfect for galas, weddings, and special events.',
      price: 12500.00,
      compareAtPrice: 15000.00,
      costPrice: 7500.00,
      stockQuantity: 15,
      minimumStockLevel: 20, // intentionally LOW for the low-stock demo
      sku: 'WMN-GWN-001',
      images: ['/images/products/women-gown.png'],
      attributes: { color: 'Midnight Blue', material: 'Silk Blend', fit: 'Regular', occasion: 'Evening' },
      categoryId: categories[0].id,
      subCategory: 'evening',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Silk Blend',
      color: 'Midnight Blue',
      unit: 'pcs',
    },
    {
      name: 'Floral Summer Maxi Dress',
      slug: 'floral-summer-maxi-dress',
      description: 'Lightweight and breezy maxi dress with a vibrant floral print. Designed with a tiered skirt and adjustable straps for ultimate summer comfort.',
      price: 4800.00,
      compareAtPrice: 5500.00,
      costPrice: 2900.00,
      stockQuantity: 40,
      minimumStockLevel: 10,
      sku: 'WMN-DRS-002',
      images: ['/images/products/women-summer-dress.png'],
      attributes: { color: 'Floral Print', material: 'Chiffon', fit: 'Relaxed', occasion: 'Casual' },
      categoryId: categories[0].id,
      subCategory: 'casual',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Chiffon',
      color: 'Floral Print',
      unit: 'pcs',
    },
    {
      name: 'Professional Silk Blouse',
      slug: 'professional-silk-blouse',
      description: 'Sophisticated silk blouse with a tailored fit, perfect for the office. Features a classic collar and subtle pearl buttons.',
      price: 5200.00,
      costPrice: 3100.00,
      stockQuantity: 25,
      minimumStockLevel: 10,
      sku: 'WMN-BLS-003',
      images: ['/images/products/women-blouse.png'],
      attributes: { color: 'Ivory White', material: '100% Silk', fit: 'Tailored', occasion: 'Workwear' },
      categoryId: categories[0].id,
      subCategory: 'blouses',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: '100% Silk',
      color: 'Ivory White',
      unit: 'pcs',
    },

    // Men's Products
    {
      name: 'Classic Oxford Formal Shirt',
      slug: 'classic-oxford-formal-shirt',
      description: 'A wardrobe essential. This Oxford cotton shirt offers a crisp, clean look with a breathable feel, suitable for business and formal settings.',
      price: 3500.00,
      compareAtPrice: 4200.00,
      costPrice: 2000.00,
      stockQuantity: 60,
      minimumStockLevel: 15,
      sku: 'MEN-SHT-001',
      images: ['/images/products/men-shirt.png'],
      attributes: { color: 'Light Blue', material: 'Oxford Cotton', fit: 'Slim Fit', occasion: 'Formal' },
      categoryId: categories[1].id,
      subCategory: 'shirts',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Oxford Cotton',
      color: 'Light Blue',
      unit: 'pcs',
    },
    {
      name: 'Premium Slim Fit Chinos',
      slug: 'premium-slim-fit-chinos',
      description: 'Versatile and comfortable chinos engineered with a touch of stretch. Transitions seamlessly from desk to dinner.',
      price: 4500.00,
      costPrice: 2700.00,
      stockQuantity: 45,
      minimumStockLevel: 15,
      sku: 'MEN-CHN-002',
      images: ['/images/products/men-chinos.png'],
      attributes: { color: 'Khaki', material: 'Cotton Twill', fit: 'Slim Fit', occasion: 'Smart Casual' },
      categoryId: categories[1].id,
      subCategory: 'trousers',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Cotton Twill',
      color: 'Khaki',
      unit: 'pcs',
    },
    {
      name: 'Textured Polo T-Shirt',
      slug: 'textured-polo-t-shirt',
      description: 'Elevate your casual look with this premium textured polo. Features a ribbed collar and high-quality moisture-wicking fabric.',
      price: 2800.00,
      compareAtPrice: 3200.00,
      costPrice: 1600.00,
      stockQuantity: 80,
      minimumStockLevel: 20,
      sku: 'MEN-POL-003',
      images: ['/images/products/men-polo.png'],
      attributes: { color: 'Charcoal Grey', material: 'Pique Cotton', fit: 'Regular', occasion: 'Casual' },
      categoryId: categories[1].id,
      subCategory: 'casual',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Pique Cotton',
      color: 'Charcoal Grey',
      unit: 'pcs',
    },

    // Teenagers' Products
    {
      name: 'Vintage Wash Denim Jacket',
      slug: 'vintage-wash-denim-jacket',
      description: 'A timeless denim jacket with a trendy vintage wash. Designed for effortless layering and everyday street style.',
      price: 6500.00,
      compareAtPrice: 7500.00,
      costPrice: 3900.00,
      stockQuantity: 30,
      minimumStockLevel: 35, // intentionally LOW for the low-stock demo
      sku: 'TEN-DNM-001',
      images: ['/images/products/teen-denim.png'],
      attributes: { color: 'Vintage Blue', material: 'Denim', fit: 'Oversized', occasion: 'Casual' },
      categoryId: categories[2].id,
      subCategory: 'street',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Denim',
      color: 'Vintage Blue',
      unit: 'pcs',
    },
    {
      name: 'Graphic Oversized Streetwear Tee',
      slug: 'graphic-oversized-streetwear-tee',
      description: 'Bold graphic print t-shirt made from heavy-weight cotton. The dropped shoulders and relaxed fit offer a modern, streetwear aesthetic.',
      price: 2200.00,
      costPrice: 1200.00,
      stockQuantity: 100,
      minimumStockLevel: 25,
      sku: 'TEN-TEE-002',
      images: ['/images/products/teen-tee.png'],
      attributes: { color: 'Black/Neon', material: 'Heavy Cotton', fit: 'Oversized', occasion: 'Streetwear' },
      categoryId: categories[2].id,
      subCategory: 'casual',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Heavy Cotton',
      color: 'Black/Neon',
      unit: 'pcs',
    },

    // Uniforms — these two are the production-eligible items (decision D8).
    {
      name: 'Standard White School Shirt',
      slug: 'standard-white-school-shirt',
      description: 'Durable and easy-care white shirt designed for school uniforms. Features reinforced stitching and stain-resistant fabric.',
      price: 1800.00,
      costPrice: 1050.00,
      stockQuantity: 200,
      minimumStockLevel: 50,
      sku: 'UNI-SCH-001',
      images: ['/images/products/uniform-shirt.png'],
      attributes: { color: 'White', material: 'Poly-Cotton', fit: 'Regular', occasion: 'School' },
      categoryId: schoolUniforms.id,
      subCategory: 'government-school',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Poly-Cotton',
      color: 'White',
      unit: 'pcs',
    },
    {
      name: 'Corporate Executive Blazer',
      slug: 'corporate-executive-blazer',
      description: 'A sharply tailored blazer for corporate uniforms. Made with premium wrinkle-resistant suiting fabric to maintain a professional look all day.',
      price: 9500.00,
      compareAtPrice: 11000.00,
      costPrice: 5800.00,
      stockQuantity: 25,
      minimumStockLevel: 30, // intentionally LOW for the low-stock demo
      sku: 'UNI-COR-002',
      images: ['/images/products/uniform-blazer.png'],
      attributes: { color: 'Navy Blue', material: 'Suiting Blend', fit: 'Tailored', occasion: 'Corporate' },
      categoryId: corporateUniforms.id,
      subCategory: 'corporate',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Suiting Blend',
      color: 'Navy Blue',
      unit: 'pcs',
    },
  ];

  for (const { minimumStockLevel: _min, ...product } of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      // stockQuantity is deliberately absent: it is a denormalized cache of
      // `inventory.quantity_available - quantity_reserved`, and this seed runs on
      // every container start. Rewriting it here would desync the cache from the
      // ledger on any database that has taken real orders.
      update: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        costPrice: product.costPrice,
        images: product.images,
        attributes: product.attributes,
        categoryId: product.categoryId,
        subCategory: product.subCategory,
        productType: product.productType,
        requiresMeasurement: product.requiresMeasurement,
        fabricType: product.fabricType,
        color: product.color,
        unit: product.unit,
      },
      create: product,
    });
  }
  console.log(`✅ ${products.length} products created`);

  // ─── Open the inventory ledger (D2/D3) ──────────────────
  // Without these rows every checkout fails: reserve() issues
  // `UPDATE inventory WHERE product_id = …`, which matches nothing.
  //
  // Only ever creates. An inventory row that already exists carries live stock
  // and a movement history, and re-seeding must never overwrite either.
  const minimums = new Map(products.map((p) => [p.sku, p.minimumStockLevel]));
  const seeded = await prisma.product.findMany({
    where: { sku: { in: products.map((p) => p.sku) } },
    select: { id: true, sku: true, stockQuantity: true },
  });

  let openedLedgers = 0;
  for (const product of seeded) {
    const existing = await prisma.inventory.findUnique({
      where: { productId: product.id },
      select: { id: true },
    });
    if (existing) continue;

    // Row and its opening movement land together, so the ledger balances from
    // the first instant: quantity_available == SUM(quantity_change).
    await prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.create({
        data: {
          productId: product.id,
          quantityAvailable: product.stockQuantity,
          quantityReserved: 0,
          minimumStockLevel: minimums.get(product.sku) ?? 0,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          type: MovementType.INITIAL,
          quantityChange: product.stockQuantity,
          note: 'Opening balance (seed)',
        },
      });
    });
    openedLedgers++;
  }
  console.log(
    `✅ inventory: ${openedLedgers} ledgers opened, ${seeded.length - openedLedgers} left untouched`,
  );

  console.log('');
  console.log('🎉 Database seeded successfully!');
  console.log('');
  console.log('📋 Test Credentials:');
  console.log('   Admin:    admin@textileshop.com / Admin@123456');
  console.log('   Customer: customer@example.com / Customer@123456');
  console.log('   Worker:   worker.cutting@textileshop.com / Worker@123456');
  console.log('   Worker:   worker.stitching@textileshop.com / Worker@123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
