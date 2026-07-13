import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { MovementType, Prisma, ProductType } from '@prisma/client';
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
          productType: dto.productType,
          requiresMeasurement: dto.requiresMeasurement,
          fabricType: dto.fabricType,
          color: dto.color,
          unit: dto.unit,
          costPrice: dto.costPrice,
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

  /**
   * The admin catalog table (plan Session 2.2, task 1). A SEPARATE method from
   * the public findAll() above, not a shared one with an `isAdmin` flag —
   * findAll() hardcodes `isActive: true` because a shopper must never see an
   * archived product, and that is exactly the constraint an admin managing the
   * catalog needs to see PAST. Two different audiences, two different default
   * visibilities; bolting a conditional onto one query for both was more
   * likely to leak an archived product to the storefront by accident than to
   * save the few lines of duplication.
   */
  async findAllAdmin(query: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    productType?: ProductType;
    archivedOnly?: boolean;
    lowStockOnly?: boolean;
    sortBy?: 'name' | 'price' | 'stockQuantity' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    // "Low" mirrors inventory.service.ts's own definition exactly (available <=
    // minimum) — one meaning for "low stock" across the whole admin surface,
    // not a second one invented here. Computed via raw SQL for the same reason
    // it is there: Prisma's `where` cannot compare two columns to each other.
    let lowStockIds: string[] | undefined;
    if (query.lowStockOnly) {
      const rows = await this.prisma.$queryRaw<Array<{ product_id: string }>>`
        SELECT i.product_id
          FROM inventory i
         WHERE i.quantity_available <= i.minimum_stock_level`;
      lowStockIds = rows.map((r) => r.product_id);
    }

    const where: Prisma.ProductWhereInput = {
      isActive: !query.archivedOnly,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.productType ? { productType: query.productType } : {}),
      ...(lowStockIds ? { id: { in: lowStockIds } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const sortBy = query.sortBy ?? 'updatedAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
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

  /**
   * Depth is capped at 2 (doc 06 §5.2: category -> sub-category, no deeper).
   * Postgres can't express "no grandparents" as a constraint, so both the
   * create and reparent paths check it here, against the CANDIDATE parent's
   * own parentId.
   */
  private async assertValidParent(parentId: string) {
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true },
    });
    if (!parent) {
      throw new NotFoundException('Parent category not found');
    }
    if (parent.parentId) {
      throw new ConflictException(
        'Category depth is limited to 2 levels — the selected parent is already a sub-category',
      );
    }
  }

  async createCategory(data: {
    name: string;
    description?: string;
    imageUrl?: string;
    parentId?: string;
  }) {
    const slug = this.generateSlug(data.name);

    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Category already exists');
    }

    if (data.parentId) {
      await this.assertValidParent(data.parentId);
    }

    return this.prisma.category.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        imageUrl: data.imageUrl,
        parentId: data.parentId,
      },
    });
  }

  async updateCategory(
    id: string,
    data: {
      name?: string;
      description?: string;
      imageUrl?: string;
      parentId?: string | null;
    },
  ) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const update: Prisma.CategoryUpdateInput = {
      description: data.description,
      imageUrl: data.imageUrl,
    };

    if (data.name && data.name !== category.name) {
      // Unlike Product (where a slug clash just gets a timestamp suffix —
      // storefront URLs, not identity), Category.name is independently
      // @unique in the schema. Silently de-duping the SLUG while still
      // writing the colliding NAME unchanged would leave the DB's own
      // constraint to reject it with a raw, unhandled P2002 — a 500, not the
      // clean 409 createCategory() already gives this exact situation. Reject
      // here instead, the same way, before either uniqueness constraint is
      // ever reached.
      const slug = this.generateSlug(data.name);
      const existingSlug = await this.prisma.category.findFirst({
        where: { slug, NOT: { id } },
      });
      if (existingSlug) {
        throw new ConflictException('Category name already in use');
      }
      update.name = data.name;
      update.slug = slug;
    }

    if (data.parentId !== undefined) {
      if (data.parentId === id) {
        throw new ConflictException('A category cannot be its own parent');
      }
      if (data.parentId === null) {
        update.parent = { disconnect: true };
      } else {
        await this.assertValidParent(data.parentId);
        // A category with children of its own would become a depth-3 branch
        // (its children's children) if nested under another category.
        const childCount = await this.prisma.category.count({
          where: { parentId: id },
        });
        if (childCount > 0) {
          throw new ConflictException(
            'This category has sub-categories of its own and cannot be nested under another category',
          );
        }
        update.parent = { connect: { id: data.parentId } };
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: update,
    });
  }

  async removeCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const { products, children } = category._count;
    if (products > 0 || children > 0) {
      const parts: string[] = [];
      if (products > 0) parts.push(`${products} product(s)`);
      if (children > 0) parts.push(`${children} sub-categor${children === 1 ? 'y' : 'ies'}`);
      throw new ConflictException(
        `Cannot delete "${category.name}" — it still has ${parts.join(' and ')}. Move or remove them first.`,
      );
    }

    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (err) {
      // Defense-in-depth against the TOCTOU race the check above can't close
      // (a product could be assigned to this category between the check and
      // the delete): the DB's own RESTRICT still blocks it, translated to the
      // same clean 409 rather than the generic 500 an unrecognised error gets.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2003'
      ) {
        throw new ConflictException(
          `Cannot delete "${category.name}" — it is still referenced by other records.`,
        );
      }
      throw err;
    }

    return { success: true };
  }

  async findAllCategories() {
    return this.prisma.category.findMany({
      include: {
        _count: {
          select: { products: true, children: true },
        },
      },
    });
  }
}
