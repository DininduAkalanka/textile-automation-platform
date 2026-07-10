import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { MovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async create(dto: CreateProductDto) {
    // Check SKU uniqueness
    const existingSku = await this.prisma.product.findUnique({
      where: { sku: dto.sku },
    });
    if (existingSku) {
      throw new ConflictException('SKU already exists');
    }

    // Generate unique slug
    let slug = this.generateSlug(dto.name);
    const existingSlug = await this.prisma.product.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    // A product without an inventory row can never be ordered: reserve() issues
    // `UPDATE inventory WHERE product_id = …`, which would match nothing and fail
    // every checkout with "Insufficient stock". The row and its opening INITIAL
    // movement are therefore created in the SAME transaction as the product, so
    // the ledger balances from the first instant (plan Session 2.1).
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          price: dto.price,
          compareAtPrice: dto.compareAtPrice,
          stockQuantity: dto.stockQuantity,
          sku: dto.sku,
          images: dto.images || [],
          attributes: dto.attributes || {},
          categoryId: dto.categoryId,
          isActive: dto.isActive ?? true,
        },
        include: {
          category: true,
        },
      });

      const inventory = await tx.inventory.create({
        data: {
          productId: product.id,
          // Nothing is reserved yet, so the sellable cache
          // (products.stock_quantity) equals quantity_available here.
          quantityAvailable: dto.stockQuantity,
          quantityReserved: 0,
          minimumStockLevel: 0,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          type: MovementType.INITIAL,
          quantityChange: dto.stockQuantity,
          note: 'Opening balance (product created)',
        },
      });

      return product;
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    categorySlug?: string;
    subCategory?: string;
    collection?: string;
    offers?: string;
    tier?: string;
    period?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = query.page || 1;
    const limit = query.limit || 12;
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
    };

    // Search filter
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    } else if (query.categorySlug && query.categorySlug !== 'new-arrivals') {
      where.category = { slug: query.categorySlug };
    }

    // Subcategory & Virtual Collection filters
    if (query.subCategory) {
      if (query.subCategory === 'special-offers' || query.offers === '1' || query.offers === 'true') {
        where.compareAtPrice = { not: null };
      } else if (query.subCategory === 'premium-collection' || query.tier === 'premium') {
        where.price = { gte: 5000 };
      } else if (query.subCategory === 'latest-this-week' || query.subCategory === 'trending-now') {
        // Handled via custom sorting below
      } else {
        where.subCategory = query.subCategory;
      }
    } else {
      if (query.offers === '1' || query.offers === 'true') {
        where.compareAtPrice = { not: null };
      }
      if (query.tier === 'premium') {
        where.price = { gte: 5000 };
      }
    }

    // Price range filter
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = where.price || {};
      if (query.minPrice !== undefined) where.price.gte = query.minPrice;
      if (query.maxPrice !== undefined) where.price.lte = query.maxPrice;
    }

    // Sorting
    const orderBy: any = {};
    if (query.subCategory === 'trending-now' || query.sortBy === 'trending') {
      orderBy['stockQuantity'] = 'desc';
    } else {
      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder || 'desc';
      orderBy[sortBy] = sortOrder;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findById(id);

    const data: any = { ...dto };

    // Regenerate slug if name changed
    if (dto.name) {
      data.slug = this.generateSlug(dto.name);
      const existingSlug = await this.prisma.product.findFirst({
        where: { slug: data.slug, NOT: { id } },
      });
      if (existingSlug) {
        data.slug = `${data.slug}-${Date.now()}`;
      }
    }

    return this.prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    });
  }

  async remove(id: string) {
    await this.findById(id);

    // Soft delete
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── Category Methods ─────────────────────────────────

  async createCategory(data: { name: string; description?: string; imageUrl?: string }) {
    const slug = this.generateSlug(data.name);

    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Category already exists');
    }

    return this.prisma.category.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        imageUrl: data.imageUrl,
      },
    });
  }

  async findAllCategories() {
    return this.prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }
}
