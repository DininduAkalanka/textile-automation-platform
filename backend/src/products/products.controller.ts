import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseFloatPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdminProductsQueryDto } from './dto/admin-products-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

/**
 * A recommendation-list size from the query string, clamped to 1–24. A
 * negative value used to reach a raw SQL LIMIT (a 500) and a huge one asked
 * the database for everything.
 */
function recommendationLimit(raw: unknown): number {
  const n = Math.trunc(Number(raw));
  if (raw === undefined || raw === null || raw === '' || !Number.isFinite(n)) {
    return 8;
  }
  return Math.min(24, Math.max(1, n));
}

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ─── Public Endpoints ──────────────────────────────────

  @Public()
  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    // QA P2-4: a malformed id or price used to reach Prisma and come back as a
    // 500; it is a client mistake, so it is now a 400 at the door.
    @Query('categoryId', new ParseUUIDPipe({ optional: true }))
    categoryId?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('category') category?: string,
    @Query('subCategory') subCategory?: string,
    @Query('collection') collection?: string,
    @Query('offers') offers?: string,
    @Query('tier') tier?: string,
    @Query('period') period?: string,
    @Query('minPrice', new ParseFloatPipe({ optional: true }))
    minPrice?: number,
    @Query('maxPrice', new ParseFloatPipe({ optional: true }))
    maxPrice?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.productsService.findAll({
      page,
      limit,
      search,
      categoryId,
      categorySlug: categorySlug || category,
      subCategory,
      collection,
      offers,
      tier,
      period,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
    });
  }

  @Public()
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Public()
  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findById(id);
  }

  /** "Customers also bought" — market-basket recommendation for the product
   *  page. Public; two path segments so it never collides with ':id'. */
  @Public()
  @Get(':id/frequently-bought-together')
  frequentlyBoughtTogether(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.frequentlyBoughtTogether(
      id,
      recommendationLimit(limit),
    );
  }

  /** "You may also like" — content-based (same category/fabric/colour) related
   *  products. Public. */
  @Public()
  @Get(':id/related')
  relatedProducts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.relatedProducts(id, recommendationLimit(limit));
  }

  // ─── Admin Endpoints ───────────────────────────────────
  // 'admin/all' is two path segments, so it can never be shadowed by the
  // single-segment ':id' route above regardless of declaration order — but it
  // lives here, not there, because an admin listing (sees archived, extra
  // filters) is conceptually an admin operation, not a public read.

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAllAdmin(@Query() query: AdminProductsQueryDto) {
    return this.productsService.findAllAdmin(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }

  // Read side of the same rule: lets the UI show up front whether a product
  // can be deleted or only archived, before the owner commits.
  @Get(':id/deletion-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  deletionCheck(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.deletionCheck(id);
  }

  // Two path segments, so it can never collide with the ':id' archive route
  // above. This is the true delete — allowed only for a product with no order
  // history (the service enforces it), otherwise it 409s and asks for archive.
  @Delete(':id/permanent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  hardDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.hardDelete(id);
  }
}

// ─── Categories Controller ─────────────────────────────

@Controller('categories')
export class CategoriesController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  findAll() {
    return this.productsService.findAllCategories();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateCategoryDto) {
    return this.productsService.createCategory(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.productsService.updateCategory(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.removeCategory(id);
  }
}
