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
    // Women's Products (5 items)
    {
      name: 'Royal Kanjivaram Pure Silk Saree',
      slug: 'royal-kanjivaram-pure-silk-saree',
      description: 'Handcrafted royal red and gold Kanjivaram pure silk saree featuring elaborate golden zari peacock motifs and a rich pallu. An heirloom drape for weddings and celebratory ceremonies.',
      price: 18500.00,
      compareAtPrice: 22000.00,
      costPrice: 11000.00,
      stockQuantity: 20,
      minimumStockLevel: 5,
      sku: 'WMN-SAR-001',
      images: ['/images/products/women-silk-saree.jpg'],
      attributes: { color: 'Royal Red & Gold', material: 'Pure Silk', fit: 'Traditional Drape', occasion: 'Wedding & Bridal' },
      categoryId: categories[0].id,
      subCategory: 'sarees',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Pure Silk',
      color: 'Royal Red & Gold',
      unit: 'pcs',
    },
    {
      name: 'Floral Printed Cotton Kurta',
      slug: 'floral-printed-cotton-kurta',
      description: 'Contemporary teal blue cotton kurta with a vibrant botanical print, notched neckline, and three-quarter sleeves. Tailored for all-day breathability and easy styling.',
      price: 4200.00,
      compareAtPrice: 4800.00,
      costPrice: 2400.00,
      stockQuantity: 45,
      minimumStockLevel: 10,
      sku: 'WMN-KUR-002',
      images: ['/images/products/women-casual-kurta.jpg'],
      attributes: { color: 'Teal Blue', material: '100% Breathable Cotton', fit: 'Straight Fit', occasion: 'Casual & Office' },
      categoryId: categories[0].id,
      subCategory: 'kurthas',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: '100% Breathable Cotton',
      color: 'Teal Blue',
      unit: 'pcs',
    },
    {
      name: 'Embroidered Linen Tunic Top',
      slug: 'embroidered-linen-tunic-top',
      description: 'Artisanal cream-white pure linen tunic blouse embellished with fine floral neckline embroidery. Features balloon sleeves and mother-of-pearl buttons.',
      price: 5800.00,
      compareAtPrice: 6500.00,
      costPrice: 3200.00,
      stockQuantity: 30,
      minimumStockLevel: 10,
      sku: 'WMN-TOP-003',
      images: ['/images/products/women-linen-top.jpg'],
      attributes: { color: 'Ivory Cream', material: 'Pure Linen', fit: 'Relaxed Tailored', occasion: 'Smart Casual' },
      categoryId: categories[0].id,
      subCategory: 'blouses',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Pure Linen',
      color: 'Ivory Cream',
      unit: 'pcs',
    },
    {
      name: 'Pleated Georgette Evening Dress',
      slug: 'pleated-georgette-evening-dress',
      description: 'Graceful emerald green accordion pleated maxi dress in fluid georgette fabric. Features a high neck, cinched fabric belt, and balloon cuffs.',
      price: 9500.00,
      compareAtPrice: 11000.00,
      costPrice: 5200.00,
      stockQuantity: 25,
      minimumStockLevel: 8,
      sku: 'WMN-DRS-004',
      images: ['/images/products/women-georgette-dress.jpg'],
      attributes: { color: 'Emerald Green', material: 'Georgette Chiffon', fit: 'A-Line Pleated', occasion: 'Evening Gala' },
      categoryId: categories[0].id,
      subCategory: 'evening',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Georgette Chiffon',
      color: 'Emerald Green',
      unit: 'pcs',
    },
    {
      name: 'Handloom Cotton Traditional Saree',
      slug: 'handloom-cotton-traditional-saree',
      description: 'Authentic Sri Lankan handloom cotton saree in mustard yellow with classic maroon geometric borders. Lightweight, cool, and effortless to drape for cultural events.',
      price: 6900.00,
      compareAtPrice: 7800.00,
      costPrice: 3800.00,
      stockQuantity: 35,
      minimumStockLevel: 10,
      sku: 'WMN-SAR-005',
      images: ['/images/products/women-cotton-saree.jpg'],
      attributes: { color: 'Mustard & Maroon', material: 'Handloom Cotton', fit: 'Traditional Drape', occasion: 'Festive & Cultural' },
      categoryId: categories[0].id,
      subCategory: 'sarees',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Handloom Cotton',
      color: 'Mustard & Maroon',
      unit: 'pcs',
    },

    // Men's Products (5 items)
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
      name: 'Executive Pure Linen Shirt',
      slug: 'executive-pure-linen-shirt',
      description: 'Crisp white tailored long-sleeve pure linen shirt with button-down collar and mother-of-pearl buttons. Unmatched warm-weather sophistication.',
      price: 4900.00,
      compareAtPrice: 5600.00,
      costPrice: 2700.00,
      stockQuantity: 50,
      minimumStockLevel: 12,
      sku: 'MEN-SHT-002',
      images: ['/images/products/men-linen-shirt.jpg'],
      attributes: { color: 'Pure White', material: '100% French Linen', fit: 'Tailored Fit', occasion: 'Smart Casual' },
      categoryId: categories[1].id,
      subCategory: 'shirts',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: '100% French Linen',
      color: 'Pure White',
      unit: 'pcs',
    },
    {
      name: 'Tailored Slim Fit Formal Trousers',
      slug: 'tailored-slim-fit-formal-trousers',
      description: 'Charcoal grey slim-fit dress trousers crafted from breathable wrinkle-resistant suiting cloth. Features sharp pressed creases and slant pockets.',
      price: 4800.00,
      compareAtPrice: 5500.00,
      costPrice: 2600.00,
      stockQuantity: 40,
      minimumStockLevel: 10,
      sku: 'MEN-TRS-003',
      images: ['/images/products/men-formal-trouser.jpg'],
      attributes: { color: 'Charcoal Grey', material: 'Poly-Viscose Suiting', fit: 'Slim Fit', occasion: 'Business Formal' },
      categoryId: categories[1].id,
      subCategory: 'trousers',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Poly-Viscose Suiting',
      color: 'Charcoal Grey',
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

    // Teenagers' Products (5 items)
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
    {
      name: 'Urban Relaxed Cargo Joggers',
      slug: 'urban-relaxed-cargo-joggers',
      description: 'Multi-pocket utility cargo pants in relaxed cotton twill with elasticated drawstring waistband and ankle cuffs. Built for urban comfort and youth style.',
      price: 3900.00,
      compareAtPrice: 4500.00,
      costPrice: 2100.00,
      stockQuantity: 50,
      minimumStockLevel: 15,
      sku: 'TEN-CRG-003',
      images: ['/images/categories/teenagers.jpg'],
      attributes: { color: 'Army Green', material: 'Stretch Twill', fit: 'Relaxed Cargo', occasion: 'Streetwear' },
      categoryId: categories[2].id,
      subCategory: 'street',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Stretch Twill',
      color: 'Army Green',
      unit: 'pcs',
    },
    {
      name: 'Youth Sportswear Active Track Set',
      slug: 'youth-sportswear-active-track-set',
      description: 'Two-piece breathable athletic tracksuit featuring a lightweight zip-up jacket and matching tapered track pants with moisture-wicking technology.',
      price: 4600.00,
      compareAtPrice: 5200.00,
      costPrice: 2500.00,
      stockQuantity: 40,
      minimumStockLevel: 10,
      sku: 'TEN-SPT-004',
      images: ['/images/hero2.png'],
      attributes: { color: 'Navy & White', material: 'Performance Poly', fit: 'Athletic Fit', occasion: 'Sports & Active' },
      categoryId: categories[2].id,
      subCategory: 'sports',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'Performance Poly',
      color: 'Navy & White',
      unit: 'pcs',
    },
    {
      name: 'Trendy Striped Oversized Crewneck',
      slug: 'trendy-striped-oversized-crewneck',
      description: 'Classic horizontal stripe crewneck sweater in soft French terry cotton. A versatile layering piece for breezy evenings and campus wear.',
      price: 2800.00,
      compareAtPrice: 3400.00,
      costPrice: 1500.00,
      stockQuantity: 65,
      minimumStockLevel: 15,
      sku: 'TEN-CRW-005',
      images: ['/images/prod2.png'],
      attributes: { color: 'Black/White Stripe', material: 'French Terry Cotton', fit: 'Oversized', occasion: 'Casual' },
      categoryId: categories[2].id,
      subCategory: 'casual',
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
      fabricType: 'French Terry Cotton',
      color: 'Black/White Stripe',
      unit: 'pcs',
    },

    // ─── Uniforms: School Uniforms (5 items) ───────────────────
    {
      name: 'Standard White School Shirt',
      slug: 'standard-white-school-shirt',
      description: 'Durable and easy-care white shirt designed for school uniforms. Features reinforced stitching and stain-resistant fabric.',
      price: 1800.00,
      costPrice: 1050.00,
      stockQuantity: 200,
      minimumStockLevel: 50,
      sku: 'UNI-SCH-001',
      images: ['/images/uniforms/school-white-shirt.jpg'],
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
      name: 'Government School Uniform Girls Pinafore',
      slug: 'government-school-girls-pinafore',
      description: 'Official standard approved white school uniform pinafore dress with box pleats, durable collar and reinforced waistband for daily school attendance.',
      price: 2600.00,
      compareAtPrice: 3000.00,
      costPrice: 1500.00,
      stockQuantity: 150,
      minimumStockLevel: 40,
      sku: 'UNI-SCH-002',
      images: ['/images/uniforms/school-girls-pinafore.jpg'],
      attributes: { color: 'White', material: 'Durable Poly-Cotton', fit: 'Pleated Uniform', occasion: 'School' },
      categoryId: schoolUniforms.id,
      subCategory: 'government-school',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Durable Poly-Cotton',
      color: 'White',
      unit: 'pcs',
    },
    {
      name: 'Government School Boys Navy Trousers',
      slug: 'government-school-boys-navy-trousers',
      description: 'Classic navy blue school uniform trousers featuring reinforced knee seams, elasticated back waistband, and deep side pockets.',
      price: 2400.00,
      compareAtPrice: 2900.00,
      costPrice: 1300.00,
      stockQuantity: 120,
      minimumStockLevel: 30,
      sku: 'UNI-SCH-003',
      images: ['/images/uniforms/school-navy-trousers.jpg'],
      attributes: { color: 'Navy Blue', material: 'Heavy Poly-Cotton Drill', fit: 'Straight Leg', occasion: 'School' },
      categoryId: schoolUniforms.id,
      subCategory: 'government-school',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Heavy Poly-Cotton Drill',
      color: 'Navy Blue',
      unit: 'pcs',
    },
    {
      name: 'Private International School Blazer Set',
      slug: 'private-international-school-blazer-set',
      description: 'Premium tailored school blazer with embroidered school crest detailing and matching trousers/skirt cut from luxury wool-blend cloth.',
      price: 5800.00,
      compareAtPrice: 6800.00,
      costPrice: 3200.00,
      stockQuantity: 80,
      minimumStockLevel: 20,
      sku: 'UNI-PRI-004',
      images: ['/images/uniforms/private-school-blazer.jpg'],
      attributes: { color: 'Maroon & Gold', material: 'Wool Blend Suiting', fit: 'Custom Tailored', occasion: 'Private School' },
      categoryId: schoolUniforms.id,
      subCategory: 'private-school',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Wool Blend Suiting',
      color: 'Maroon & Gold',
      unit: 'pcs',
    },
    {
      name: 'Primary School Cotton Uniform Shorts',
      slug: 'primary-school-cotton-uniform-shorts',
      description: 'Comfortable junior school uniform shorts with elasticated waistband and durable belt loops, tailored for active elementary students.',
      price: 1600.00,
      compareAtPrice: 2000.00,
      costPrice: 900.00,
      stockQuantity: 110,
      minimumStockLevel: 30,
      sku: 'UNI-SCH-005',
      images: ['/images/uniforms/junior-school-shorts.jpg'],
      attributes: { color: 'Navy Blue', material: '100% Cotton Twill', fit: 'Relaxed Fit', occasion: 'Primary School' },
      categoryId: schoolUniforms.id,
      subCategory: 'government-school',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: '100% Cotton Twill',
      color: 'Navy Blue',
      unit: 'pcs',
    },

    // ─── Uniforms: Corporate & Office (5 items) ─────────────────
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
      images: ['/images/uniforms/corporate-executive-blazer.jpg'],
      attributes: { color: 'Navy Blue', material: 'Suiting Blend', fit: 'Tailored', occasion: 'Corporate' },
      categoryId: corporateUniforms.id,
      subCategory: 'corporate',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Suiting Blend',
      color: 'Navy Blue',
      unit: 'pcs',
    },
    {
      name: 'Tailored Corporate Office Trouser',
      slug: 'tailored-corporate-office-trouser',
      description: 'Executive corporate formal trousers tailored with flat front and crease retention for banking and office corporate teams.',
      price: 4500.00,
      compareAtPrice: 5200.00,
      costPrice: 2400.00,
      stockQuantity: 60,
      minimumStockLevel: 15,
      sku: 'UNI-COR-003',
      images: ['/images/uniforms/corporate-office-trouser.jpg'],
      attributes: { color: 'Charcoal Grey', material: 'Poly-Viscose Stretch', fit: 'Slim Tailored', occasion: 'Office Formal' },
      categoryId: corporateUniforms.id,
      subCategory: 'corporate',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Poly-Viscose Stretch',
      color: 'Charcoal Grey',
      unit: 'pcs',
    },
    {
      name: 'Formal Executive Oxford Office Shirt',
      slug: 'formal-executive-oxford-office-shirt',
      description: 'Premium corporate uniform shirt in crisp Oxford cotton with contrast inner collar and cuff lining. Ideal for company-wide branding.',
      price: 3800.00,
      compareAtPrice: 4400.00,
      costPrice: 2000.00,
      stockQuantity: 90,
      minimumStockLevel: 25,
      sku: 'UNI-COR-004',
      images: ['/images/uniforms/corporate-oxford-shirt.jpg'],
      attributes: { color: 'Executive Light Blue', material: 'Oxford Cotton', fit: 'Regular Fit', occasion: 'Corporate Office' },
      categoryId: corporateUniforms.id,
      subCategory: 'corporate',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Oxford Cotton',
      color: 'Executive Light Blue',
      unit: 'pcs',
    },
    {
      name: 'Women Executive Office Pencil Skirt',
      slug: 'women-executive-office-pencil-skirt',
      description: 'High-waisted knee-length corporate pencil skirt with rear vent and concealed zip. Professional and comfortable for all-day office wear.',
      price: 3600.00,
      compareAtPrice: 4200.00,
      costPrice: 1900.00,
      stockQuantity: 45,
      minimumStockLevel: 10,
      sku: 'UNI-COR-005',
      images: ['/images/uniforms/corporate-pencil-skirt.jpg'],
      attributes: { color: 'Midnight Black', material: 'Stretch Crepe', fit: 'Pencil Silhouette', occasion: 'Corporate' },
      categoryId: corporateUniforms.id,
      subCategory: 'corporate',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Stretch Crepe',
      color: 'Midnight Black',
      unit: 'pcs',
    },
    {
      name: 'Corporate Formal Waistcoat Vest',
      slug: 'corporate-formal-waistcoat-vest',
      description: 'Five-button tailored corporate waistcoat vest with adjustable back cinch. Perfect for executive suites, hospitality management, and formal uniforms.',
      price: 4900.00,
      compareAtPrice: 5800.00,
      costPrice: 2600.00,
      stockQuantity: 40,
      minimumStockLevel: 10,
      sku: 'UNI-COR-006',
      images: ['/images/uniforms/corporate-waistcoat-vest.jpg'],
      attributes: { color: 'Navy Blue', material: 'Suiting Blend', fit: 'Tailored Fit', occasion: 'Executive Corporate' },
      categoryId: corporateUniforms.id,
      subCategory: 'corporate',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Suiting Blend',
      color: 'Navy Blue',
      unit: 'pcs',
    },

    // ─── Uniforms: Healthcare & Hospitality (5 items) ───────────
    {
      name: 'Medical Unisex Surgical Scrub Suit Set',
      slug: 'medical-unisex-surgical-scrub-suit-set',
      description: 'Antimicrobial and fluid-resistant surgical scrub top and cargo trouser set designed for doctors, surgeons, and nurses in hospital clinics.',
      price: 3800.00,
      compareAtPrice: 4500.00,
      costPrice: 2000.00,
      stockQuantity: 100,
      minimumStockLevel: 25,
      sku: 'UNI-HLT-001',
      images: ['/images/uniforms/medical-scrubs.jpg'],
      attributes: { color: 'Medical Teal', material: 'Poly-Spandex Stretch', fit: 'Comfort Fit', occasion: 'Hospital & Clinic' },
      categoryId: healthcareUniforms.id,
      subCategory: 'healthcare',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Poly-Spandex Stretch',
      color: 'Medical Teal',
      unit: 'pcs',
    },
    {
      name: 'Hospital Doctors Professional Lab Coat',
      slug: 'hospital-doctors-professional-lab-coat',
      description: 'Full-length white medical laboratory coat with reinforced chest pocket, pen slots, and side access slits. Stain-resistant and easy to launder.',
      price: 4200.00,
      compareAtPrice: 4900.00,
      costPrice: 2200.00,
      stockQuantity: 75,
      minimumStockLevel: 20,
      sku: 'UNI-HLT-002',
      images: ['/images/uniforms/doctor-lab-coat.jpg'],
      attributes: { color: 'Hospital White', material: 'Cotton-Rich Drill', fit: 'Standard Lab Cut', occasion: 'Medical & Laboratory' },
      categoryId: healthcareUniforms.id,
      subCategory: 'healthcare',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Cotton-Rich Drill',
      color: 'Hospital White',
      unit: 'pcs',
    },
    {
      name: 'Nurse Clinical Duty Uniform Tunic Dress',
      slug: 'nurse-clinical-duty-uniform-tunic-dress',
      description: 'Breathable nursing tunic dress with action back shoulder pleats and contrast navy piping. Designed for flexibility during 12-hour shifts.',
      price: 3400.00,
      compareAtPrice: 3900.00,
      costPrice: 1800.00,
      stockQuantity: 80,
      minimumStockLevel: 20,
      sku: 'UNI-HLT-003',
      images: ['/images/uniforms/nurse-tunic-dress.jpg'],
      attributes: { color: 'Sky Blue / Navy Piping', material: 'Durable Poly-Cotton', fit: 'Action Back Tunic', occasion: 'Nursing Care' },
      categoryId: healthcareUniforms.id,
      subCategory: 'healthcare',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Durable Poly-Cotton',
      color: 'Sky Blue',
      unit: 'pcs',
    },
    {
      name: 'Executive Master Chef Coat & Apron Set',
      slug: 'executive-master-chef-coat-and-apron-set',
      description: 'Double-breasted white executive chef jacket with breathable mesh back vents, french cuffs, and stain-resistant front apron.',
      price: 4600.00,
      compareAtPrice: 5400.00,
      costPrice: 2400.00,
      stockQuantity: 50,
      minimumStockLevel: 15,
      sku: 'UNI-HSP-004',
      images: ['/images/uniforms/chef-jacket-apron.jpg'],
      attributes: { color: 'Chef White', material: 'Heavyweight Poly-Cotton', fit: 'Double Breasted', occasion: 'Culinary & Restaurant' },
      categoryId: healthcareUniforms.id,
      subCategory: 'hospitality',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Heavyweight Poly-Cotton',
      color: 'Chef White',
      unit: 'pcs',
    },
    {
      name: 'Hotel Front Desk Hospitality Uniform Vest',
      slug: 'hotel-front-desk-hospitality-uniform-vest',
      description: 'Luxurious hotel front office uniform vest with satin lapels and tailored silhouette for hotel receptionists and concierge staff.',
      price: 5200.00,
      compareAtPrice: 6000.00,
      costPrice: 2800.00,
      stockQuantity: 40,
      minimumStockLevel: 10,
      sku: 'UNI-HSP-005',
      images: ['/images/uniforms/hospitality-vest.jpg'],
      attributes: { color: 'Burgundy & Black', material: 'Premium Suiting Blend', fit: 'Formal Tailored', occasion: 'Hospitality & Hotel' },
      categoryId: healthcareUniforms.id,
      subCategory: 'hospitality',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Premium Suiting Blend',
      color: 'Burgundy',
      unit: 'pcs',
    },

    // ─── Uniforms: Industrial & Security (5 items) ──────────────
    {
      name: 'Industrial Heavy-Duty Workwear Coverall',
      slug: 'industrial-heavy-duty-workwear-coverall',
      description: 'Flame-retardant and oil-resistant industrial workwear boiler suit jumpsuit with reflective safety strips, heavy-duty brass zipper, and tool pockets.',
      price: 6200.00,
      compareAtPrice: 7200.00,
      costPrice: 3600.00,
      stockQuantity: 70,
      minimumStockLevel: 20,
      sku: 'UNI-IND-001',
      images: ['/images/uniforms/industrial-coverall.jpg'],
      attributes: { color: 'Navy Blue / Hi-Vis', material: 'Heavy Drill Cotton', fit: 'Industrial Fit', occasion: 'Factory & Engineering' },
      categoryId: industrialUniforms.id,
      subCategory: 'industrial',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Heavy Drill Cotton',
      color: 'Navy Blue',
      unit: 'pcs',
    },
    {
      name: 'Reflective Hi-Vis Safety Work Jacket',
      slug: 'reflective-hi-vis-safety-work-jacket',
      description: 'High-visibility safety jacket featuring 3M Scotchlite reflective stripes, waterproof outer shell, and storm flap for construction and field safety.',
      price: 4800.00,
      compareAtPrice: 5600.00,
      costPrice: 2500.00,
      stockQuantity: 85,
      minimumStockLevel: 20,
      sku: 'UNI-IND-002',
      images: ['/images/uniforms/hivis-safety-jacket.jpg'],
      attributes: { color: 'Neon Yellow & Navy', material: 'Waterproof Oxford Poly', fit: 'Relaxed Safety Cut', occasion: 'Construction & Roadwork' },
      categoryId: industrialUniforms.id,
      subCategory: 'industrial',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Waterproof Oxford Poly',
      color: 'Neon Yellow',
      unit: 'pcs',
    },
    {
      name: 'Heavy-Duty Cotton Drill Cargo Work Pants',
      slug: 'heavy-duty-cotton-drill-cargo-work-pants',
      description: 'Triple-stitched heavy cotton drill work cargo pants with reinforced kneepad pockets, hammer loop, and deep utility cargo pockets.',
      price: 4200.00,
      compareAtPrice: 4900.00,
      costPrice: 2200.00,
      stockQuantity: 65,
      minimumStockLevel: 15,
      sku: 'UNI-IND-003',
      images: ['/images/uniforms/cargo-work-pants.jpg'],
      attributes: { color: 'Khaki Stone', material: 'Heavy Duty 310gsm Cotton', fit: 'Work Cargo Fit', occasion: 'Mechanical & Carpentry' },
      categoryId: industrialUniforms.id,
      subCategory: 'industrial',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Heavy Duty 310gsm Cotton',
      color: 'Khaki Stone',
      unit: 'pcs',
    },
    {
      name: 'Security Officer Formal Duty Shirt',
      slug: 'security-officer-formal-duty-shirt',
      description: 'Professional security duty uniform shirt with shoulder epaulettes, badge tab, and dual pleated chest pockets with button flaps.',
      price: 3200.00,
      compareAtPrice: 3800.00,
      costPrice: 1700.00,
      stockQuantity: 90,
      minimumStockLevel: 25,
      sku: 'UNI-IND-004',
      images: ['/images/uniforms/security-duty-shirt.jpg'],
      attributes: { color: 'Navy Blue', material: 'Poly-Cotton Poplin', fit: 'Structured Duty Cut', occasion: 'Security & Guarding' },
      categoryId: industrialUniforms.id,
      subCategory: 'security',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Poly-Cotton Poplin',
      color: 'Navy Blue',
      unit: 'pcs',
    },
    {
      name: 'Factory & Warehouse Anti-Static Coat',
      slug: 'factory-and-warehouse-anti-static-coat',
      description: 'ESD anti-static warehouse protective dust coat for electronic assembly, cleanrooms, and pharmaceutical manufacturing facilities.',
      price: 3900.00,
      compareAtPrice: 4500.00,
      costPrice: 2000.00,
      stockQuantity: 60,
      minimumStockLevel: 15,
      sku: 'UNI-IND-005',
      images: ['/images/uniforms/anti-static-coat.jpg'],
      attributes: { color: 'Light Blue', material: 'Carbon Grid Anti-Static Fabric', fit: 'Knee-Length Coat', occasion: 'Cleanroom & Warehouse' },
      categoryId: industrialUniforms.id,
      subCategory: 'industrial',
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
      fabricType: 'Carbon Grid Anti-Static Fabric',
      color: 'Light Blue',
      unit: 'pcs',
    },

    // ─── Fabrics, sold by the metre ────────────────────────────────────────
    // These exist for the AI retriever (D10) as much as for the shop. The
    // assistant's golden queries — "hot weather fabric", "cheap cotton",
    // "school uniform fabric for kids" — can only be answered well if the
    // catalog genuinely CONTAINS breathable fabrics at a range of prices, with
    // the words a customer would actually use written into the description.
    // A retriever is only as good as what it has to retrieve.
    {
      name: 'Pure Cotton Fabric',
      slug: 'pure-cotton-fabric',
      description:
        'Soft, breathable 100% cotton fabric. Light and cool against the skin, ideal for hot and humid weather. A popular everyday choice for shirts, school uniforms and children\'s clothing.',
      price: 850.0,
      costPrice: 520.0,
      stockQuantity: 400,
      minimumStockLevel: 100,
      sku: 'FAB-COT-001',
      images: ['/images/products/fabric-cotton.png'],
      attributes: { color: 'White', material: 'Cotton', width: '44 inch' },
      categoryId: categories[0].id,
      subCategory: 'fabric',
      productType: ProductType.FABRIC,
      requiresMeasurement: false,
      fabricType: 'Cotton',
      color: 'White',
      unit: 'metre',
    },
    {
      name: 'Cotton Poplin Shirting Fabric',
      slug: 'cotton-poplin-shirting-fabric',
      description:
        'Crisp cotton poplin with a smooth finish. Breathable and easy to iron, this is the standard cloth for tailored office shirts and school uniform shirts.',
      price: 1150.0,
      costPrice: 700.0,
      stockQuantity: 260,
      minimumStockLevel: 80,
      sku: 'FAB-COT-002',
      images: ['/images/products/fabric-poplin.png'],
      attributes: { color: 'Sky Blue', material: 'Cotton', width: '58 inch' },
      categoryId: categories[0].id,
      subCategory: 'fabric',
      productType: ProductType.FABRIC,
      requiresMeasurement: false,
      fabricType: 'Cotton',
      color: 'Sky Blue',
      unit: 'metre',
    },
    {
      name: 'Pure Linen Fabric',
      slug: 'pure-linen-fabric',
      description:
        'Natural linen with excellent airflow — the coolest fabric we stock for tropical heat. Relaxed texture, gets softer with every wash. Perfect for summer shirts and loose trousers.',
      price: 2400.0,
      costPrice: 1500.0,
      stockQuantity: 120,
      minimumStockLevel: 40,
      sku: 'FAB-LIN-001',
      images: ['/images/products/fabric-linen.png'],
      attributes: { color: 'Natural Beige', material: 'Linen', width: '58 inch' },
      categoryId: categories[0].id,
      subCategory: 'fabric',
      productType: ProductType.FABRIC,
      requiresMeasurement: false,
      fabricType: 'Linen',
      color: 'Natural Beige',
      unit: 'metre',
    },
    {
      name: 'Polyester Blend Uniform Fabric',
      slug: 'polyester-blend-uniform-fabric',
      description:
        'Hard-wearing polyester-cotton blend built for daily school and factory use. Resists creasing, holds colour through repeated washing, and dries quickly.',
      price: 640.0,
      costPrice: 380.0,
      stockQuantity: 500,
      minimumStockLevel: 120,
      sku: 'FAB-POL-001',
      images: ['/images/products/fabric-poly.png'],
      attributes: { color: 'Grey', material: 'Polyester Cotton', width: '58 inch' },
      categoryId: schoolUniforms.id,
      subCategory: 'fabric',
      productType: ProductType.FABRIC,
      requiresMeasurement: false,
      fabricType: 'Polyester Cotton',
      color: 'Grey',
      unit: 'metre',
    },
    {
      name: 'Pure Silk Fabric',
      slug: 'pure-silk-fabric',
      description:
        'Luxurious pure silk with a natural lustre and fluid drape. Reserved for sarees, bridal wear and occasion garments.',
      price: 6800.0,
      costPrice: 4200.0,
      stockQuantity: 45,
      minimumStockLevel: 15,
      sku: 'FAB-SLK-001',
      images: ['/images/products/fabric-silk.png'],
      attributes: { color: 'Maroon', material: 'Silk', width: '44 inch' },
      categoryId: categories[0].id,
      subCategory: 'fabric',
      productType: ProductType.FABRIC,
      requiresMeasurement: false,
      fabricType: 'Silk',
      color: 'Maroon',
      unit: 'metre',
    },



    // ─── Custom tailoring ─────────────────────────────────────────────────
    {
      name: 'Custom Tailored Shirt',
      slug: 'custom-tailored-shirt',
      description:
        'A shirt cut entirely to your own measurements in the fabric of your choice. Choose cotton for the heat or a blend for the office.',
      price: 5500.0,
      costPrice: 3200.0,
      stockQuantity: 30,
      minimumStockLevel: 10,
      sku: 'CUS-SHT-001',
      images: ['/images/products/custom-shirt.png'],
      attributes: { color: 'Custom', material: 'Customer Choice', fit: 'Bespoke' },
      categoryId: categories[1].id,
      subCategory: 'custom',
      productType: ProductType.CUSTOM,
      requiresMeasurement: true,
      fabricType: 'Cotton',
      color: 'Custom',
      unit: 'pcs',
    },

    // ─── Accessories ──────────────────────────────────────────────────────
    {
      name: 'School Tie',
      slug: 'school-tie',
      description:
        'Standard striped school tie with a pre-knotted option for younger children.',
      price: 450.0,
      costPrice: 220.0,
      stockQuantity: 200,
      minimumStockLevel: 60,
      sku: 'ACC-TIE-001',
      images: ['/images/products/acc-tie.png'],
      attributes: { color: 'Navy Stripe', material: 'Polyester' },
      categoryId: schoolUniforms.id,
      subCategory: 'accessory',
      productType: ProductType.ACCESSORY,
      requiresMeasurement: false,
      fabricType: 'Polyester',
      color: 'Navy Stripe',
      unit: 'pcs',
    },
    {
      name: 'Leather Formal Belt',
      slug: 'leather-formal-belt',
      description:
        'Genuine leather belt with a brushed steel buckle. Pairs with school and office uniforms alike.',
      price: 1800.0,
      costPrice: 950.0,
      stockQuantity: 8,
      minimumStockLevel: 25, // intentionally LOW for the low-stock demo
      sku: 'ACC-BLT-001',
      images: ['/images/products/acc-belt.png'],
      attributes: { color: 'Black', material: 'Leather' },
      categoryId: categories[1].id,
      subCategory: 'accessory',
      productType: ProductType.ACCESSORY,
      requiresMeasurement: false,
      fabricType: 'Leather',
      color: 'Black',
      unit: 'pcs',
    },
  ];

  for (const { minimumStockLevel: _min, ...product } of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      // stockQuantity is deliberately absent: it is a denormalized cache of
      // `inventory.quantity_available - quantity_reserved`, and this seed runs on
      // every container start. Rewriting it here would desync the cache from the
      // ledger on any database that has taken real orders.
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
