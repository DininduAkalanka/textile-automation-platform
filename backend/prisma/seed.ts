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

export async function seedCatalog() {
  console.log('🌱 Seeding database...');

  // ─── Create Admin User ──────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@textileshop.com' },
    // In `update` too, not just `create`: the verified-flag columns default to
    // false, so re-seeding an already-migrated DB must flip demo accounts back
    // to verified or they'd be blocked at checkout.
    update: { emailVerified: true, phoneVerified: true },
    create: {
      email: 'admin@textileshop.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      phone: '+94771234567',
      role: UserRole.ADMIN,
      emailVerified: true,
      phoneVerified: true,
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  // ─── Create Test Customer ───────────────────────────────
  const customerPassword = await bcrypt.hash('Customer@123456', 12);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: { emailVerified: true, phoneVerified: true },
    create: {
      email: 'customer@example.com',
      passwordHash: customerPassword,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+94779876543',
      role: UserRole.CUSTOMER,
      emailVerified: true,
      phoneVerified: true,
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
      update: { emailVerified: true, phoneVerified: true },
      create: {
        email: w.email,
        passwordHash: workerPassword,
        firstName: w.firstName,
        lastName: w.lastName,
        phone: w.phone,
        role: UserRole.WORKER,
        emailVerified: true,
        phoneVerified: true,
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
  const [schoolUniforms, corporateUniforms, healthcareUniforms, industrialUniforms] = await Promise.all([
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
    prisma.category.upsert({
      where: { slug: 'healthcare-uniforms' },
      update: { parentId: categories[3].id },
      create: {
        name: 'Healthcare & Hospitality',
        slug: 'healthcare-uniforms',
        description: 'Medical scrubs, lab coats, and hospitality staff attire.',
        parentId: categories[3].id,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'industrial-uniforms' },
      update: { parentId: categories[3].id },
      create: {
        name: 'Industrial & Workwear',
        slug: 'industrial-uniforms',
        description: 'Heavy-duty coveralls, safety wear, and industrial gear.',
        parentId: categories[3].id,
      },
    }),
  ]);
  console.log(`✅ ${categories.length + 4} categories created (4 nested uniform categories)`);

  // ─── Create Products ────────────────────────────────────
  // productType + requiresMeasurement drive decision D8: only UNIFORM/CUSTOM
  // items, or items requiring measurement, generate production tasks.
  const products: ProductSeed[] = [
    // ─── Women's Products (5 items) ──────────────────────────
    {
      name: 'Border Detailed Handloom Saree',
      slug: 'border-detailed-handloom-saree',
      description: 'Handcrafted traditional Sri Lankan handloom cotton saree featuring an elaborate contrast geometric woven border and pallu. Includes unstitched matching blouse piece.',
      price: 8900.00,
      compareAtPrice: 10500.00,
      costPrice: 5200.00,
      stockQuantity: 20,
      minimumStockLevel: 5,
      sku: 'WMN-SAR-001',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16587.jpg?v=1785563901'],
      attributes: { color: 'Mustard & Maroon', material: 'Handloom Cotton', size: 'Free Size (6 Yards)', occasion: 'Traditional & Festival' },
      categoryId: categories[0].id,
      subCategory: 'sarees',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Handloom Cotton',
      color: 'Mustard & Maroon',
      unit: 'pcs',
    },
    {
      name: 'Engage Long Sleeve Striped Workwear Shirt',
      slug: 'engage-long-sleeve-striped-shirt',
      description: "Genuine Engage women's long sleeve workwear collared shirt crafted from 80% cotton / 20% polyester blend. Tailored pinstripe fit for sharp office styling and all-day comfort.",
      price: 2995.00,
      compareAtPrice: 3500.00,
      costPrice: 1600.00,
      stockQuantity: 35,
      minimumStockLevel: 8,
      sku: 'WMN-TOP-002',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16685.jpg?v=1788579796'],
      attributes: { color: 'Blue Pinstripe', material: '80% Cotton / 20% Poly', size: 'S, M, L, XL, XXL', fit: 'Tailored Fit' },
      categoryId: categories[0].id,
      subCategory: 'tops',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Cotton-Rich Poplin',
      color: 'Blue Pinstripe',
      unit: 'pcs',
    },
    {
      name: 'Engage Embroidered Kurtha Top',
      slug: 'engage-embroidered-kurtha-top',
      description: 'Sophisticated Engage embroidered cotton kurtha top with split V-neckline, delicate floral thread embroidery, and three-quarter sleeves for daily elegance.',
      price: 3450.00,
      compareAtPrice: 4200.00,
      costPrice: 1800.00,
      stockQuantity: 28,
      minimumStockLevel: 6,
      sku: 'WMN-KRT-003',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16371.jpg?v=1781870990'],
      attributes: { color: 'Teal Blue Floral', material: '100% Breathable Cotton', size: 'S, M, L, XL', fit: 'Regular Tunic' },
      categoryId: categories[0].id,
      subCategory: 'dresses',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: '100% Cotton',
      color: 'Teal Blue',
      unit: 'pcs',
    },
    {
      name: 'Printed Pure Cotton Saree',
      slug: 'printed-pure-cotton-saree',
      description: 'Lightweight 100% fine cotton printed saree with all-over botanical motifs and running contrast borders. Ideal for tropical daytime comfort.',
      price: 4950.00,
      compareAtPrice: 5900.00,
      costPrice: 2800.00,
      stockQuantity: 25,
      minimumStockLevel: 5,
      sku: 'WMN-SAR-004',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16438.jpg?v=1782891271'],
      attributes: { color: 'Earthy Indigo Print', material: '100% Fine Cotton', size: 'Free Size (6 Yards)', occasion: 'Daily & Casual' },
      categoryId: categories[0].id,
      subCategory: 'sarees',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Fine Cotton',
      color: 'Indigo Print',
      unit: 'pcs',
    },
    {
      name: 'Akasi Mid Waist Smart Workwear Pants',
      slug: 'akasi-mid-waist-ww-pants',
      description: 'Akasi tailored mid-waist formal workwear trousers with hook-and-bar closure, clean front crease, and stretch poly-crepe fabric.',
      price: 3850.00,
      compareAtPrice: 4500.00,
      costPrice: 2000.00,
      stockQuantity: 30,
      minimumStockLevel: 8,
      sku: 'WMN-PNT-005',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16613.png?v=1786681807'],
      attributes: { color: 'Formal Charcoal', material: 'Stretch Poly-Crepe', size: 'Waist 26, 28, 30, 32, 34', fit: 'Tapered Ankle' },
      categoryId: categories[0].id,
      subCategory: 'bottoms',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Stretch Poly-Crepe',
      color: 'Formal Charcoal',
      unit: 'pcs',
    },

    // ─── Men's Products (5 items) ────────────────────────────
    {
      name: 'Trafford Short Sleeve Cotton Shirt',
      slug: 'trafford-short-sleeve-cotton-shirt',
      description: 'Trafford premium 100% combed cotton short sleeve formal/smart-casual shirt. Breathable weave with point collar and curved hemline.',
      price: 3890.00,
      compareAtPrice: 4500.00,
      costPrice: 2100.00,
      stockQuantity: 40,
      minimumStockLevel: 10,
      sku: 'MEN-SHT-001',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TM15419.jpg?v=1781886502'],
      attributes: { color: 'Ice Blue', material: '100% Fine Combed Cotton', size: 'M, L, XL, XXL', collar: '15.5 to 17.5 inches' },
      categoryId: categories[1].id,
      subCategory: 'shirts',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Combed Cotton',
      color: 'Ice Blue',
      unit: 'pcs',
    },
    {
      name: "Men's Short Sleeve Printed Resort Shirt",
      slug: 'mens-short-sleeve-printed-shirt',
      description: 'Modern casual printed short sleeve cotton shirt featuring contemporary tropical micro-prints. Cut in a regular comfort fit.',
      price: 3450.00,
      compareAtPrice: 4200.00,
      costPrice: 1800.00,
      stockQuantity: 32,
      minimumStockLevel: 8,
      sku: 'MEN-SHT-002',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TM15392.jpg?v=1781250531'],
      attributes: { color: 'Printed Navy & White', material: '100% Cotton Poplin', size: 'S, M, L, XL', fit: 'Regular Fit' },
      categoryId: categories[1].id,
      subCategory: 'shirts',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Cotton Poplin',
      color: 'Printed Navy & White',
      unit: 'pcs',
    },
    {
      name: 'Trafford Printed Casual Short Sleeve Shirt',
      slug: 'trafford-printed-casual-shirt',
      description: 'Authentic Trafford lightweight printed casual shirt with buttoned chest pocket and contrast inner collar band.',
      price: 3250.00,
      compareAtPrice: 3800.00,
      costPrice: 1700.00,
      stockQuantity: 30,
      minimumStockLevel: 7,
      sku: 'MEN-SHT-003',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TM15272.1.jpg?v=1773922910'],
      attributes: { color: 'Geometric Earthy Print', material: '100% Cotton', size: 'M, L, XL', fit: 'Comfort Casual' },
      categoryId: categories[1].id,
      subCategory: 'shirts',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: '100% Cotton',
      color: 'Geometric Print',
      unit: 'pcs',
    },
    {
      name: 'Vantage Ultra Slim Fit Formal Trousers',
      slug: 'vantage-ultra-slim-fit-formal-trouser',
      description: 'Vantage executive navy blue formal suiting trousers with flat-front styling, slant side pockets, and crease-resistant poly-viscose blend.',
      price: 4750.00,
      compareAtPrice: 5600.00,
      costPrice: 2500.00,
      stockQuantity: 35,
      minimumStockLevel: 8,
      sku: 'MEN-TRS-004',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TM14815.1.jpg?v=1737527937'],
      attributes: { color: 'Formal Navy Blue', material: 'Poly-Viscose Suiting', size: 'Waist 30, 32, 34, 36, 38', fit: 'Ultra Slim' },
      categoryId: categories[1].id,
      subCategory: 'trousers',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Poly-Viscose Suiting',
      color: 'Navy Blue',
      unit: 'pcs',
    },
    {
      name: "Moose Men's Chino Smart Casual Pants",
      slug: 'moose-mens-chino-pants-navy',
      description: 'Genuine Moose 98% cotton twill / 2% elastane stretch chino trousers. Tailored for smart office wear or weekend outings.',
      price: 4250.00,
      compareAtPrice: 4950.00,
      costPrice: 2200.00,
      stockQuantity: 28,
      minimumStockLevel: 6,
      sku: 'MEN-CHN-005',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TM110964.jpg?v=1722218063'],
      attributes: { color: 'Classic Deep Navy', material: '98% Cotton / 2% Elastane', size: 'Waist 30, 32, 34, 36', fit: 'Slim Chino' },
      categoryId: categories[1].id,
      subCategory: 'trousers',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Cotton Twill Stretch',
      color: 'Deep Navy',
      unit: 'pcs',
    },

    // ─── Teenagers Products (5 items) ────────────────────────
    {
      name: 'Tendenza Teen Wrapped Waist Shirt',
      slug: 'tendenza-teen-wrapped-waist-shirt',
      description: 'Tendenza Teen contemporary wrapped waist cropped collared shirt in soft poplin. Fashion-forward silhouette designed for young trendsetters.',
      price: 2850.00,
      compareAtPrice: 3400.00,
      costPrice: 1400.00,
      stockQuantity: 25,
      minimumStockLevel: 5,
      sku: 'TEN-TOP-001',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16093.jpg?v=1775894880'],
      attributes: { color: 'Crisp White', material: 'Cotton Poplin', size: 'Age 13-14, 15-16, Small', fit: 'Crop Wrapped' },
      categoryId: categories[2].id,
      subCategory: 'tops',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Cotton Poplin',
      color: 'Crisp White',
      unit: 'pcs',
    },
    {
      name: 'Vintage Wash Denim Trucker Jacket',
      slug: 'vintage-wash-denim-trucker-jacket',
      description: 'Heavyweight cotton denim jacket with vintage stonewash finish, metal shank buttons, chest flap pockets, and back embellishments.',
      price: 5800.00,
      compareAtPrice: 6900.00,
      costPrice: 3200.00,
      stockQuantity: 6,
      minimumStockLevel: 15, // Intentionally LOW STOCK (1 of 3)
      sku: 'TEN-DNM-002',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16414.jpg?v=1782541487'],
      attributes: { color: 'Faded Vintage Blue', material: '100% Heavy Cotton Denim', size: 'S, M, L', fit: 'Relaxed Trucker' },
      categoryId: categories[2].id,
      subCategory: 'jackets',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: '100% Cotton Denim',
      color: 'Vintage Blue',
      unit: 'pcs',
    },
    {
      name: 'Tendenza Teen Side Slit Skirt',
      slug: 'tendenza-teen-side-slit-skirt',
      description: 'Casual teenage high-waist A-line skirt with stylish side slit detail, comfortable elastic waistband, and lightweight breathable fabric.',
      price: 2650.00,
      compareAtPrice: 3200.00,
      costPrice: 1300.00,
      stockQuantity: 22,
      minimumStockLevel: 5,
      sku: 'TEN-SKT-003',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW15544.1.jpg?v=1767178431'],
      attributes: { color: 'Soft Olive Green', material: 'Cotton-Viscose Blend', size: 'Age 14-16, XS, S', fit: 'A-Line Midi' },
      categoryId: categories[2].id,
      subCategory: 'skirts',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Cotton-Viscose',
      color: 'Soft Olive Green',
      unit: 'pcs',
    },
    {
      name: 'Tendenza Teen Stitch Printed T-Shirt',
      slug: 'tendenza-teen-stitch-printed-tee',
      description: 'Relaxed boxy crew neck graphic tee made from 100% single jersey cotton with high-density contrast stitch front print.',
      price: 1950.00,
      compareAtPrice: 2400.00,
      costPrice: 950.00,
      stockQuantity: 30,
      minimumStockLevel: 6,
      sku: 'TEN-TEE-004',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16101.jpg?v=1775901236'],
      attributes: { color: 'Charcoal Wash', material: '100% Cotton Jersey', size: 'S, M, L', fit: 'Boxy Casual' },
      categoryId: categories[2].id,
      subCategory: 't-shirts',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Single Jersey Cotton',
      color: 'Charcoal Wash',
      unit: 'pcs',
    },
    {
      name: 'Tendenza Teen Zipper Detailed Jumpsuit',
      slug: 'tendenza-teen-zipper-jumpsuit',
      description: 'Stylish teenage all-in-one jumpsuit featuring exposed metal front zipper, utility waist cinch, and tapered leg openings.',
      price: 4250.00,
      compareAtPrice: 5100.00,
      costPrice: 2200.00,
      stockQuantity: 18,
      minimumStockLevel: 5,
      sku: 'TEN-JMP-005',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16053.2.jpg?v=1775494053'],
      attributes: { color: 'Sand Beige', material: 'Cotton Twill', size: 'Age 14-16, S, M', fit: 'Utility One-Piece' },
      categoryId: categories[2].id,
      subCategory: 'dresses',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Cotton Twill',
      color: 'Sand Beige',
      unit: 'pcs',
    },

    // ─── School Uniforms (5 items) ───────────────────────────
    {
      name: "Girl's School Uniform Frock (5 Pleat)",
      slug: 'girls-school-uniform-frock-5-pleat',
      description: 'Official Sri Lankan government regulation 5-pleat white school uniform frock with Peter Pan collar and tie loop. Wash-and-wear poplin.',
      price: 2450.00,
      compareAtPrice: 2900.00,
      costPrice: 1200.00,
      stockQuantity: 150,
      minimumStockLevel: 30,
      sku: 'UNI-SCH-001',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TK10199.jpg?v=1722230954'],
      attributes: { color: 'Regulation School White', material: '65% Poly / 35% Cotton Poplin', size: '18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38', fit: 'Standard 5-Pleat' },
      categoryId: schoolUniforms.id,
      subCategory: 'school-uniforms',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Poly-Cotton School Poplin',
      color: 'White',
      unit: 'pcs',
    },
    {
      name: "Boy's School Uniform Shirt - Short Sleeve",
      slug: 'boy-school-uniform-shirt-short-sleeve',
      description: "Regulation Sri Lankan boy's short sleeve school uniform shirt in bright white durable poplin with left chest pocket and reinforced collar.",
      price: 1850.00,
      compareAtPrice: 2200.00,
      costPrice: 900.00,
      stockQuantity: 140,
      minimumStockLevel: 30,
      sku: 'UNI-SCH-002',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TK10209.jpg?v=1722231501'],
      attributes: { color: 'Regulation White', material: '65% Poly / 35% Cotton', size: '20, 22, 24, 26, 28, 30, 32, 34, 36, 38', fit: 'Regulation School Cut' },
      categoryId: schoolUniforms.id,
      subCategory: 'school-uniforms',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'School Poplin',
      color: 'White',
      unit: 'pcs',
    },
    {
      name: "Boy's School Uniform Short - Elasticated",
      slug: 'boy-school-uniform-short-elasticated',
      description: "Navy blue boy's school uniform shorts with comfortable elasticated back waistband, front pleats, and stain-resistant gabardine fabric.",
      price: 2100.00,
      compareAtPrice: 2500.00,
      costPrice: 1050.00,
      stockQuantity: 110,
      minimumStockLevel: 25,
      sku: 'UNI-SCH-003',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TK10205.jpg?v=1722230981'],
      attributes: { color: 'Navy Blue', material: 'Heavy Gabardine Twill', size: 'Waist 20 to 32 inches', fit: 'Pleated School Short' },
      categoryId: schoolUniforms.id,
      subCategory: 'school-uniforms',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Gabardine Twill',
      color: 'Navy Blue',
      unit: 'pcs',
    },
    {
      name: "Girl's School Uniform Frock (Box Pleat)",
      slug: 'girls-school-uniform-frock-box-pleat',
      description: "Traditional box-pleated girl's white school uniform frock conforming to leading Colombo and Kandy school codes.",
      price: 2550.00,
      compareAtPrice: 3000.00,
      costPrice: 1300.00,
      stockQuantity: 90,
      minimumStockLevel: 20,
      sku: 'UNI-SCH-004',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TK10200.jpg?v=1722230956'],
      attributes: { color: 'Regulation School White', material: 'Easy-Care Poplin', size: '22 to 38', fit: 'Box Pleat' },
      categoryId: schoolUniforms.id,
      subCategory: 'school-uniforms',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Easy-Care Poplin',
      color: 'White',
      unit: 'pcs',
    },
    {
      name: "Boy's School Uniform Shirt - Long Sleeve",
      slug: 'boy-school-uniform-shirt-long-sleeve',
      description: "Senior boy's long sleeve school shirt with button cuffs and stiffened spread collar for college prefects and formal school functions.",
      price: 2250.00,
      compareAtPrice: 2700.00,
      costPrice: 1100.00,
      stockQuantity: 80,
      minimumStockLevel: 20,
      sku: 'UNI-SCH-005',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TK10208.jpg?v=1722230996'],
      attributes: { color: 'Brilliant White', material: '65% Poly / 35% Cotton', size: 'Chest 30 to 42', fit: 'Senior Long Sleeve' },
      categoryId: schoolUniforms.id,
      subCategory: 'school-uniforms',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'School Poplin',
      color: 'Brilliant White',
      unit: 'pcs',
    },

    // ─── Corporate Uniforms (5 items) ────────────────────────
    {
      name: 'Tendenza Navy Elegance Blazer Jacket',
      slug: 'tendenza-navy-elegance-blazer',
      description: 'Tendenza executive navy blue tailored single-breasted corporate blazer. Crease-resistant poly-wool suiting with notched lapels and satin lining.',
      price: 9500.00,
      compareAtPrice: 11500.00,
      costPrice: 5200.00,
      stockQuantity: 45,
      minimumStockLevel: 10,
      sku: 'UNI-COR-001',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW15209.jpg?v=1760894529'],
      attributes: { color: 'Executive Navy', material: 'Crease-Resistant Poly-Wool', size: '36, 38, 40, 42, 44', fit: 'Single-Breasted Tailored' },
      categoryId: corporateUniforms.id,
      subCategory: 'corporate-wear',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Crease-Resistant Poly-Wool',
      color: 'Executive Navy',
      unit: 'pcs',
    },
    {
      name: 'Trafford Executive Long Sleeve Business Shirt',
      slug: 'trafford-executive-long-sleeve-shirt',
      description: 'High-count cotton-rich corporate shirt with taped seams for puckering-free washing. Built for daily corporate staff wear.',
      price: 3600.00,
      compareAtPrice: 4200.00,
      costPrice: 1800.00,
      stockQuantity: 80,
      minimumStockLevel: 20,
      sku: 'UNI-COR-002',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TM15441.jpg?v=1783076543'],
      attributes: { color: 'Crisp White', material: '80% Cotton / 20% Poly', size: 'Collar 14.5 to 17.5', fit: 'Classic Executive' },
      categoryId: corporateUniforms.id,
      subCategory: 'corporate-wear',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: '80% Cotton / 20% Poly',
      color: 'Crisp White',
      unit: 'pcs',
    },
    {
      name: 'Vantage 4-Way Stretch Formal Suiting Trousers',
      slug: 'vantage-4way-stretch-formal-trouser',
      description: 'Vantage premium 4-way stretch black formal corporate trousers. Superior flexibility and wrinkle-resistance for office personnel.',
      price: 4900.00,
      compareAtPrice: 5800.00,
      costPrice: 2400.00,
      stockQuantity: 70,
      minimumStockLevel: 15,
      sku: 'UNI-COR-003',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/3.1_1_5f8a83ce-131d-4258-b42f-c45fea55c19f.png?v=1782540283'],
      attributes: { color: 'Deep Black', material: '4-Way Stretch Suiting', size: 'Waist 30 to 40', fit: 'Straight Formal' },
      categoryId: corporateUniforms.id,
      subCategory: 'corporate-wear',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: '4-Way Stretch Suiting',
      color: 'Deep Black',
      unit: 'pcs',
    },
    {
      name: 'Tendenza Front Dart Detailed Pencil Skirt',
      slug: 'tendenza-front-dart-pencil-skirt',
      description: 'Corporate pencil skirt with front darting, back walking vent, and hidden zipper. Poly-viscose suiting crepe.',
      price: 3200.00,
      compareAtPrice: 3800.00,
      costPrice: 1600.00,
      stockQuantity: 55,
      minimumStockLevel: 12,
      sku: 'UNI-COR-004',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW15562.5.jpg?v=1767771751'],
      attributes: { color: 'Formal Charcoal', material: 'Stretch Suiting Crepe', size: 'Waist 26 to 36', fit: 'Slim Pencil' },
      categoryId: corporateUniforms.id,
      subCategory: 'corporate-wear',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Stretch Suiting Crepe',
      color: 'Formal Charcoal',
      unit: 'pcs',
    },
    {
      name: 'Formal Suiting Waistcoat Vest',
      slug: 'formal-suiting-waistcoat-vest',
      description: 'Professional four-button front suiting vest with back cinch buckle for receptionists, financial officers, and hospitality supervisors.',
      price: 3900.00,
      compareAtPrice: 4600.00,
      costPrice: 1900.00,
      stockQuantity: 50,
      minimumStockLevel: 10,
      sku: 'UNI-COR-005',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TM14865.png?v=1741595880'],
      attributes: { color: 'Charcoal Black', material: 'Poly-Wool Suiting', size: 'S, M, L, XL', fit: 'Tailored Vest' },
      categoryId: corporateUniforms.id,
      subCategory: 'corporate-wear',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Poly-Wool Suiting',
      color: 'Charcoal Black',
      unit: 'pcs',
    },

    // ─── Healthcare & Hospitality Uniforms (5 items) ─────────
    {
      name: 'Bella Medical Doctor Consultation Overcoat',
      slug: 'bella-doctor-consultation-overcoat',
      description: 'Heavyweight sanitized white cotton drill doctor overcoat with notched collar, side pocket slits, and breast pocket for pens/ID.',
      price: 3800.00,
      compareAtPrice: 4500.00,
      costPrice: 2000.00,
      stockQuantity: 100,
      minimumStockLevel: 25,
      sku: 'UNI-HLT-001',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW15865.jpg?v=1773463309'],
      attributes: { color: 'Sanitized White', material: 'Heavy Cotton Twill', size: 'S, M, L, XL, XXL', fit: 'Regular Knee-Length' },
      categoryId: healthcareUniforms.id,
      subCategory: 'medical',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Heavy Cotton Twill',
      color: 'Sanitized White',
      unit: 'pcs',
    },
    {
      name: 'Clinical Grade Hospital Scrub Set',
      slug: 'clinical-hospital-scrub-set',
      description: 'Two-piece clinical scrub set with antimicrobial poly-cotton fabric, reinforced seams, V-neck top, and drawstring cargo pants.',
      price: 4200.00,
      compareAtPrice: 4900.00,
      costPrice: 2200.00,
      stockQuantity: 120,
      minimumStockLevel: 30,
      sku: 'UNI-HLT-002',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16194.jpg?v=1778229717'],
      attributes: { color: 'Hospital Teal / Navy', material: 'Antimicrobial Poly-Cotton', size: 'XS, S, M, L, XL', fit: 'Comfort Scrub' },
      categoryId: healthcareUniforms.id,
      subCategory: 'medical',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Antimicrobial Poly-Cotton',
      color: 'Hospital Teal',
      unit: 'pcs',
    },
    {
      name: 'Executive Culinary Chef Overcoat',
      slug: 'executive-culinary-chef-overcoat',
      description: 'Double-breasted commercial chef jacket with 10 knot buttons, breathable underarm eyelets, and thermometer sleeve pocket.',
      price: 4600.00,
      compareAtPrice: 5400.00,
      costPrice: 2500.00,
      stockQuantity: 50,
      minimumStockLevel: 15,
      sku: 'UNI-HLT-003',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16273.jpg?v=1779699266'],
      attributes: { color: 'Brilliant White', material: '100% Heavy Cotton Drill', size: 'S, M, L, XL', fit: 'Executive Chef' },
      categoryId: healthcareUniforms.id,
      subCategory: 'hospitality',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: '100% Heavy Cotton Drill',
      color: 'Brilliant White',
      unit: 'pcs',
    },
    {
      name: 'Hospitality Food & Beverage Steward Vest',
      slug: 'hospitality-steward-vest',
      description: 'Black stain-resistant serving vest for banquet stewards, restaurant waiters, and front-of-house hospitality staff.',
      price: 3200.00,
      compareAtPrice: 3800.00,
      costPrice: 1700.00,
      stockQuantity: 8,
      minimumStockLevel: 25, // Intentionally LOW STOCK (2 of 3)
      sku: 'UNI-HLT-004',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16347.jpg?v=1781526222'],
      attributes: { color: 'Onyx Black', material: 'Stain-Resistant Poly Suiting', size: 'S, M, L, XL', fit: 'Tailored Vest' },
      categoryId: healthcareUniforms.id,
      subCategory: 'hospitality',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Stain-Resistant Poly Suiting',
      color: 'Onyx Black',
      unit: 'pcs',
    },
    {
      name: 'Nursing Healthcare Tunic Dress',
      slug: 'nursing-healthcare-tunic-dress',
      description: 'Comfortable healthcare nursing tunic dress with waterproof-lined hip pockets, contrast collar piping, and side movement vents.',
      price: 3100.00,
      compareAtPrice: 3600.00,
      costPrice: 1600.00,
      stockQuantity: 80,
      minimumStockLevel: 20,
      sku: 'UNI-HLT-005',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16500.jpg?v=1784279763'],
      attributes: { color: 'Sky Blue / Navy Piping', material: 'Stretch Poly-Cotton', size: 'S, M, L, XL', fit: 'Comfort Healthcare' },
      categoryId: healthcareUniforms.id,
      subCategory: 'medical',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Stretch Poly-Cotton',
      color: 'Sky Blue / Navy Piping',
      unit: 'pcs',
    },

    // ─── Industrial & Workwear Uniforms (5 items) ────────────
    {
      name: 'Rainco Super Force Industrial Weatherproof Suit',
      slug: 'rainco-super-force-industrial-suit',
      description: 'Authentic Rainco Super Force heavy-duty industrial 2-piece waterproof hooded work suit with welded seams and storm flaps.',
      price: 6800.00,
      compareAtPrice: 7900.00,
      costPrice: 3700.00,
      stockQuantity: 60,
      minimumStockLevel: 15,
      sku: 'UNI-IND-001',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TA15123_1311bbce-152d-4cfa-b28d-c14277588ed9.png?v=1729240651'],
      attributes: { color: 'Industrial Navy', material: 'Heavy PVC/Polyester', size: 'M, L, XL, XXL', fit: 'Heavy Weatherproof' },
      categoryId: industrialUniforms.id,
      subCategory: 'workwear',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Industrial PVC/Polyester',
      color: 'Industrial Navy',
      unit: 'pcs',
    },
    {
      name: 'High-Visibility Reflective Utility Jacket',
      slug: 'hivis-reflective-utility-jacket',
      description: 'Heavy-duty work jacket with 3M reflective high-visibility safety bands for site engineers, warehousemen, and road teams.',
      price: 5600.00,
      compareAtPrice: 6500.00,
      costPrice: 2900.00,
      stockQuantity: 75,
      minimumStockLevel: 20,
      sku: 'UNI-IND-002',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16414.jpg?v=1782541487'],
      attributes: { color: 'High-Vis Yellow & Denim', material: '300D Oxford Polyester', size: 'M, L, XL, XXL', fit: 'High-Vis Safety' },
      categoryId: industrialUniforms.id,
      subCategory: 'workwear',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: '300D Oxford Polyester',
      color: 'High-Vis Yellow & Denim',
      unit: 'pcs',
    },
    {
      name: 'Security Officer Long Sleeve Duty Shirt',
      slug: 'security-officer-long-sleeve-duty-shirt',
      description: 'Professional security duty shirt with buttoned shoulder epaulets, pleated chest pockets with pen slots, and durable poplin fabric.',
      price: 3400.00,
      compareAtPrice: 4000.00,
      costPrice: 1800.00,
      stockQuantity: 90,
      minimumStockLevel: 25,
      sku: 'UNI-IND-003',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TM15392.jpg?v=1781250531'],
      attributes: { color: 'Duty Khaki / Blue', material: 'Heavy Poly-Cotton Poplin', size: 'S, M, L, XL', fit: 'Structured Duty' },
      categoryId: industrialUniforms.id,
      subCategory: 'security',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Heavy Poly-Cotton Poplin',
      color: 'Duty Khaki',
      unit: 'pcs',
    },
    {
      name: 'Industrial Heavy Canvas Work Trousers',
      slug: 'industrial-heavy-canvas-work-trousers',
      description: 'Rugged canvas work pants with reinforced double knees, ruler pocket, hammer loop, and triple-stitched main seams.',
      price: 4900.00,
      compareAtPrice: 5800.00,
      costPrice: 2600.00,
      stockQuantity: 80,
      minimumStockLevel: 20,
      sku: 'UNI-IND-004',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW16290.png?v=1780038232'],
      attributes: { color: 'Industrial Black / Charcoal', material: 'Heavy Canvas Twill', size: 'Waist 30 to 40', fit: 'Heavy Utility' },
      categoryId: industrialUniforms.id,
      subCategory: 'workwear',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Heavy Canvas Twill',
      color: 'Industrial Black',
      unit: 'pcs',
    },
    {
      name: 'Anti-Static Cleanroom Specialist ESD Coat',
      slug: 'anti-static-cleanroom-specialist-coat',
      description: 'Electrostatic dissipative (ESD) protective white cleanroom coat with conductive grid carbon yarn and snap-button cuffs.',
      price: 4400.00,
      compareAtPrice: 5200.00,
      costPrice: 2300.00,
      stockQuantity: 10,
      minimumStockLevel: 20, // Intentionally LOW STOCK (3 of 3)
      sku: 'UNI-IND-005',
      images: ['https://cdn.shopify.com/s/files/1/0884/9873/3368/files/TW15865.jpg?v=1773463309'],
      attributes: { color: 'Cleanroom White / Blue Grid', material: '98% Poly / 2% Carbon Fiber', size: 'S, M, L, XL', fit: 'ESD Barrier' },
      categoryId: industrialUniforms.id,
      subCategory: 'workwear',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: '98% Poly / 2% Carbon Fiber',
      color: 'Cleanroom White / Blue Grid',
      unit: 'pcs',
    },
  ];

  // Stagger createdAt timestamps so flagship consumer categories
  // (Women's Sarees, Men's Linen Shirts, Teenagers, School Uniforms)
  // appear at the top of the collection when sorted by newest (createdAt DESC).
  const baseTime = Date.now();
  for (let i = 0; i < products.length; i++) {
    const { minimumStockLevel: _min, ...product } = products[i];
    const productCreatedAt = new Date(baseTime - i * 60000);

    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        sku: product.sku,
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
        createdAt: productCreatedAt,
      },
      create: {
        ...product,
        createdAt: productCreatedAt,
      },
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

if (require.main === module) {
  seedCatalog()
    .catch((e) => {
      console.error('❌ Seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
