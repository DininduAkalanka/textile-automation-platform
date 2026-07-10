import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
  console.log(`✅ ${categories.length} categories created`);

  // ─── Create Products ────────────────────────────────────
  const products = [
    // Women's Products
    {
      name: 'Elegant Evening Gown',
      slug: 'elegant-evening-gown',
      description: 'A stunning floor-length evening gown featuring intricate sequin detailing and a flattering silhouette. Perfect for galas, weddings, and special events.',
      price: 12500.00,
      compareAtPrice: 15000.00,
      stockQuantity: 15,
      sku: 'WMN-GWN-001',
      images: ['/images/products/women-gown.png'],
      attributes: { color: 'Midnight Blue', material: 'Silk Blend', fit: 'Regular', occasion: 'Evening' },
      categoryId: categories[0].id,
      subCategory: 'evening',
    },
    {
      name: 'Floral Summer Maxi Dress',
      slug: 'floral-summer-maxi-dress',
      description: 'Lightweight and breezy maxi dress with a vibrant floral print. Designed with a tiered skirt and adjustable straps for ultimate summer comfort.',
      price: 4800.00,
      compareAtPrice: 5500.00,
      stockQuantity: 40,
      sku: 'WMN-DRS-002',
      images: ['/images/products/women-summer-dress.png'],
      attributes: { color: 'Floral Print', material: 'Chiffon', fit: 'Relaxed', occasion: 'Casual' },
      categoryId: categories[0].id,
      subCategory: 'casual',
    },
    {
      name: 'Professional Silk Blouse',
      slug: 'professional-silk-blouse',
      description: 'Sophisticated silk blouse with a tailored fit, perfect for the office. Features a classic collar and subtle pearl buttons.',
      price: 5200.00,
      stockQuantity: 25,
      sku: 'WMN-BLS-003',
      images: ['/images/products/women-blouse.png'],
      attributes: { color: 'Ivory White', material: '100% Silk', fit: 'Tailored', occasion: 'Workwear' },
      categoryId: categories[0].id,
      subCategory: 'blouses',
    },

    // Men's Products
    {
      name: 'Classic Oxford Formal Shirt',
      slug: 'classic-oxford-formal-shirt',
      description: 'A wardrobe essential. This Oxford cotton shirt offers a crisp, clean look with a breathable feel, suitable for business and formal settings.',
      price: 3500.00,
      compareAtPrice: 4200.00,
      stockQuantity: 60,
      sku: 'MEN-SHT-001',
      images: ['/images/products/men-shirt.png'],
      attributes: { color: 'Light Blue', material: 'Oxford Cotton', fit: 'Slim Fit', occasion: 'Formal' },
      categoryId: categories[1].id,
      subCategory: 'shirts',
    },
    {
      name: 'Premium Slim Fit Chinos',
      slug: 'premium-slim-fit-chinos',
      description: 'Versatile and comfortable chinos engineered with a touch of stretch. Transitions seamlessly from desk to dinner.',
      price: 4500.00,
      stockQuantity: 45,
      sku: 'MEN-CHN-002',
      images: ['/images/products/men-chinos.png'],
      attributes: { color: 'Khaki', material: 'Cotton Twill', fit: 'Slim Fit', occasion: 'Smart Casual' },
      categoryId: categories[1].id,
      subCategory: 'trousers',
    },
    {
      name: 'Textured Polo T-Shirt',
      slug: 'textured-polo-t-shirt',
      description: 'Elevate your casual look with this premium textured polo. Features a ribbed collar and high-quality moisture-wicking fabric.',
      price: 2800.00,
      compareAtPrice: 3200.00,
      stockQuantity: 80,
      sku: 'MEN-POL-003',
      images: ['/images/products/men-polo.png'],
      attributes: { color: 'Charcoal Grey', material: 'Pique Cotton', fit: 'Regular', occasion: 'Casual' },
      categoryId: categories[1].id,
      subCategory: 'casual',
    },

    // Teenagers' Products
    {
      name: 'Vintage Wash Denim Jacket',
      slug: 'vintage-wash-denim-jacket',
      description: 'A timeless denim jacket with a trendy vintage wash. Designed for effortless layering and everyday street style.',
      price: 6500.00,
      compareAtPrice: 7500.00,
      stockQuantity: 30,
      sku: 'TEN-DNM-001',
      images: ['/images/products/teen-denim.png'],
      attributes: { color: 'Vintage Blue', material: 'Denim', fit: 'Oversized', occasion: 'Casual' },
      categoryId: categories[2].id,
      subCategory: 'street',
    },
    {
      name: 'Graphic Oversized Streetwear Tee',
      slug: 'graphic-oversized-streetwear-tee',
      description: 'Bold graphic print t-shirt made from heavy-weight cotton. The dropped shoulders and relaxed fit offer a modern, streetwear aesthetic.',
      price: 2200.00,
      stockQuantity: 100,
      sku: 'TEN-TEE-002',
      images: ['/images/products/teen-tee.png'],
      attributes: { color: 'Black/Neon', material: 'Heavy Cotton', fit: 'Oversized', occasion: 'Streetwear' },
      categoryId: categories[2].id,
      subCategory: 'casual',
    },

    // Uniforms
    {
      name: 'Standard White School Shirt',
      slug: 'standard-white-school-shirt',
      description: 'Durable and easy-care white shirt designed for school uniforms. Features reinforced stitching and stain-resistant fabric.',
      price: 1800.00,
      stockQuantity: 200,
      sku: 'UNI-SCH-001',
      images: ['/images/products/uniform-shirt.png'],
      attributes: { color: 'White', material: 'Poly-Cotton', fit: 'Regular', occasion: 'School' },
      categoryId: categories[3].id,
      subCategory: 'government-school',
    },
    {
      name: 'Corporate Executive Blazer',
      slug: 'corporate-executive-blazer',
      description: 'A sharply tailored blazer for corporate uniforms. Made with premium wrinkle-resistant suiting fabric to maintain a professional look all day.',
      price: 9500.00,
      compareAtPrice: 11000.00,
      stockQuantity: 25,
      sku: 'UNI-COR-002',
      images: ['/images/products/uniform-blazer.png'],
      attributes: { color: 'Navy Blue', material: 'Suiting Blend', fit: 'Tailored', occasion: 'Corporate' },
      categoryId: categories[3].id,
      subCategory: 'corporate',
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        stockQuantity: product.stockQuantity,
        images: product.images,
        attributes: product.attributes,
        categoryId: product.categoryId,
        subCategory: product.subCategory,
      },
      create: product,
    });
  }
  console.log(`✅ ${products.length} products created`);

  console.log('');
  console.log('🎉 Database seeded successfully!');
  console.log('');
  console.log('📋 Test Credentials:');
  console.log('   Admin:    admin@textileshop.com / Admin@123456');
  console.log('   Customer: customer@example.com / Customer@123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
