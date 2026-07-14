import {
  ConflictException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductType, UserRole } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { InventoryService } from '../src/inventory/inventory.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductsService } from '../src/products/products.service';

/**
 * Admin catalog management — plan Session 2.2.
 *
 * Two things this suite exists to pin down, both found by re-reading the plan
 * against the code rather than trusting what already worked:
 *
 * 1. The admin product listing is a SEPARATE visibility default from the
 *    public storefront (sees archived on request; the public list never
 *    can). Before this session there was no way for an admin to even find an
 *    archived product again.
 * 2. A category cannot be deleted, or have a product silently orphaned onto
 *    it, while it is still in use — enforced at TWO layers (a friendly
 *    service-level pre-check, and a real Postgres FK RESTRICT underneath
 *    it), and the depth-2 cap the plan specifies (category -> sub-category,
 *    no deeper) is enforced on both create and reparent.
 *
 *   npm run test:integration
 */

const TAG = `prodtest-${Date.now()}`;

describe('Admin catalog management (plan Session 2.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let products: ProductsService;
  let inventory: InventoryService;
  let adminId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    products = app.get(ProductsService);
    inventory = app.get(InventoryService);

    const admin = await prisma.user.create({
      data: {
        email: `${TAG}-admin@example.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Cat',
        lastName: 'Admin',
        role: UserRole.ADMIN,
      },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId: adminId } });
    await prisma.inventoryMovement.deleteMany({
      where: { inventory: { product: { sku: { startsWith: TAG } } } },
    });
    await prisma.product.deleteMany({ where: { sku: { startsWith: TAG } } });
    // Children before parents: a top-level category can't be removed while a
    // same-batch child (self-FK, RESTRICT) still points at it.
    await prisma.category.deleteMany({
      where: { name: { startsWith: TAG }, parentId: { not: null } },
    });
    await prisma.category.deleteMany({
      where: { name: { startsWith: TAG } },
    });
    await prisma.user.deleteMany({ where: { id: adminId } });
    await app.close();
  });

  async function seedProduct(opts: {
    label: string;
    categoryId?: string;
    stock?: number;
    productType?: ProductType;
    description?: string;
  }) {
    return products.create({
      name: `${TAG} ${opts.label}`,
      sku: `${TAG}-${opts.label}`,
      price: 1000,
      stockQuantity: opts.stock ?? 10,
      categoryId: opts.categoryId,
      productType: opts.productType,
      description: opts.description,
    });
  }

  const seedCategory = (label: string, parentId?: string) =>
    products.createCategory({ name: `${TAG} ${label}`, parentId });

  // ═══ Admin product listing sees what the storefront must not ═════════════

  describe('findAllAdmin — visibility (the reason this endpoint exists)', () => {
    it('defaults to active products, same as the public storefront', async () => {
      const active = await seedProduct({ label: 'vis-active' });
      const archived = await seedProduct({ label: 'vis-archived' });
      await products.remove(archived.id);

      const { products: rows } = await products.findAllAdmin({
        search: `${TAG}-vis`,
      });
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(active.id);
      expect(ids).not.toContain(archived.id);
    });

    it('archivedOnly reveals exactly the archived ones — the actual gap being closed', async () => {
      const active = await seedProduct({ label: 'arch-active' });
      const archived = await seedProduct({ label: 'arch-archived' });
      await products.remove(archived.id);

      const { products: rows } = await products.findAllAdmin({
        search: `${TAG}-arch`,
        archivedOnly: true,
      });
      expect(rows.map((r) => r.id)).toEqual([archived.id]);
    });
  });

  describe('findAllAdmin — filters', () => {
    it('filters by category', async () => {
      const catA = await seedCategory('filt-cat-a');
      const catB = await seedCategory('filt-cat-b');
      const inA = await seedProduct({
        label: 'filt-in-a',
        categoryId: catA.id,
      });
      await seedProduct({ label: 'filt-in-b', categoryId: catB.id });

      const { products: rows } = await products.findAllAdmin({
        categoryId: catA.id,
      });
      expect(rows.map((r) => r.id)).toEqual([inA.id]);
    });

    it('filters by productType', async () => {
      const uniform = await seedProduct({
        label: 'type-uniform',
        productType: ProductType.UNIFORM,
      });
      await seedProduct({
        label: 'type-fabric',
        productType: ProductType.FABRIC,
      });

      const { products: rows } = await products.findAllAdmin({
        search: `${TAG}-type`,
        productType: ProductType.UNIFORM,
      });
      expect(rows.map((r) => r.id)).toEqual([uniform.id]);
    });

    it('search matches name, sku and description', async () => {
      const p = await seedProduct({
        label: 'search-target',
        description: 'a very particular embroidered collar',
      });

      const bySku = await products.findAllAdmin({ search: p.sku });
      expect(bySku.products.map((r) => r.id)).toEqual([p.id]);

      const byDescription = await products.findAllAdmin({
        search: 'embroidered collar',
      });
      expect(byDescription.products.map((r) => r.id)).toContain(p.id);
    });

    it("lowStockOnly matches inventory.service.ts's own definition of low", async () => {
      const low = await seedProduct({ label: 'low-yes', stock: 5 });
      await inventory.setMinimum(low.id, 10, adminId); // 5 <= 10

      const fine = await seedProduct({ label: 'low-no', stock: 100 });
      await inventory.setMinimum(fine.id, 10, adminId); // 100 > 10

      const { products: rows } = await products.findAllAdmin({
        search: `${TAG}-low`,
        lowStockOnly: true,
      });
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(low.id);
      expect(ids).not.toContain(fine.id);
    });

    it('paginates and reports accurate totals', async () => {
      for (let i = 0; i < 5; i++) {
        await seedProduct({ label: `page-${i}` });
      }

      const first = await products.findAllAdmin({
        search: `${TAG}-page`,
        page: 1,
        limit: 2,
      });
      expect(first.products).toHaveLength(2);
      expect(first.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 5,
        totalPages: 3,
      });

      const last = await products.findAllAdmin({
        search: `${TAG}-page`,
        page: 3,
        limit: 2,
      });
      expect(last.products).toHaveLength(1);
    });
  });

  // ═══ Category depth cap: 2 levels, enforced on create AND reparent ════════

  describe('Category — parentId + depth cap on create', () => {
    it('creates a top-level category', async () => {
      const cat = await seedCategory('top');
      expect(cat.parentId).toBeNull();
    });

    it('creates a sub-category under a top-level parent', async () => {
      const parent = await seedCategory('depth-parent');
      const child = await seedCategory('depth-child', parent.id);
      expect(child.parentId).toBe(parent.id);
    });

    it('refuses a third level — a sub-category cannot itself be a parent', async () => {
      const parent = await seedCategory('depth3-parent');
      const child = await seedCategory('depth3-child', parent.id);

      await expect(
        products.createCategory({
          name: `${TAG} depth3-grandchild`,
          parentId: child.id,
        }),
      ).rejects.toThrow(/depth is limited to 2/i);
    });

    it('refuses a parentId that does not exist', async () => {
      await expect(
        products.createCategory({
          name: `${TAG} orphan`,
          parentId: '00000000-0000-0000-0000-000000000000',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a duplicate category name', async () => {
      await seedCategory('dup');
      await expect(seedCategory('dup')).rejects.toThrow(ConflictException);
    });
  });

  describe('Category — update (rename / reparent)', () => {
    it('renames a category and regenerates its slug', async () => {
      const cat = await seedCategory('rename-before');
      const updated = await products.updateCategory(cat.id, {
        name: `${TAG} rename-after`,
      });
      expect(updated.name).toBe(`${TAG} rename-after`);
      expect(updated.slug).not.toBe(cat.slug);
    });

    /**
     * Found by re-reading the code, not by a failing test: the first version
     * of this method de-duplicated the SLUG on a naming collision but still
     * wrote the colliding NAME unchanged. Category.name is independently
     * @unique in the schema, so that write would have reached Postgres and
     * come back as an unhandled P2002 — the generic 500 http-exception.filter
     * gives any error it doesn't recognise, not the clean 409 this is
     * supposed to be. Mutation-tested below.
     */
    it("rejects a rename that collides with another category's name — cleanly, not as a raw DB error", async () => {
      const other = await seedCategory('collide-existing');
      const mine = await seedCategory('collide-mine');

      await expect(
        products.updateCategory(mine.id, { name: other.name }),
      ).rejects.toThrow(ConflictException);

      const reloaded = await prisma.category.findUniqueOrThrow({
        where: { id: mine.id },
      });
      expect(reloaded.name).toContain('collide-mine');
    });

    it('reparents a top-level category under another top-level category', async () => {
      const newParent = await seedCategory('reparent-target');
      const cat = await seedCategory('reparent-subject');

      const updated = await products.updateCategory(cat.id, {
        parentId: newParent.id,
      });
      expect(updated.parentId).toBe(newParent.id);
    });

    it('promotes a sub-category back to top-level with an explicit null', async () => {
      const parent = await seedCategory('promote-parent');
      const child = await seedCategory('promote-child', parent.id);

      const updated = await products.updateCategory(child.id, {
        parentId: null,
      });
      expect(updated.parentId).toBeNull();
    });

    it('refuses to reparent under a category that is itself a sub-category', async () => {
      const parent = await seedCategory('reparent-depth-parent');
      const child = await seedCategory('reparent-depth-child', parent.id);
      const other = await seedCategory('reparent-depth-other');

      await expect(
        products.updateCategory(other.id, { parentId: child.id }),
      ).rejects.toThrow(/depth is limited to 2/i);
    });

    it('refuses to reparent a category that already has children of its own', async () => {
      const parent = await seedCategory('reparent-haschild-parent');
      await seedCategory('reparent-haschild-child', parent.id);
      const newHome = await seedCategory('reparent-haschild-newhome');

      await expect(
        products.updateCategory(parent.id, { parentId: newHome.id }),
      ).rejects.toThrow(/has sub-categories of its own/i);
    });

    it('refuses to make a category its own parent', async () => {
      const cat = await seedCategory('self-parent');
      await expect(
        products.updateCategory(cat.id, { parentId: cat.id }),
      ).rejects.toThrow(/cannot be its own parent/i);
    });
  });

  // ═══ Delete is blocked while a category is still in use ═══════════════════

  describe('Category — delete is blocked while it is still in use (409, not a raw DB error)', () => {
    it('refuses to delete a category that still has products', async () => {
      const cat = await seedCategory('del-has-products');
      await seedProduct({ label: 'del-product', categoryId: cat.id });

      await expect(products.removeCategory(cat.id)).rejects.toThrow(
        ConflictException,
      );
      await expect(products.removeCategory(cat.id)).rejects.toThrow(
        /1 product/,
      );

      await expect(
        prisma.category.findUniqueOrThrow({ where: { id: cat.id } }),
      ).resolves.toBeDefined();
    });

    it('refuses to delete a category that still has sub-categories', async () => {
      const parent = await seedCategory('del-has-children');
      await seedCategory('del-child', parent.id);

      await expect(products.removeCategory(parent.id)).rejects.toThrow(
        ConflictException,
      );
      await expect(products.removeCategory(parent.id)).rejects.toThrow(
        /1 sub-category/,
      );
    });

    it('deletes cleanly once it is actually empty', async () => {
      const cat = await seedCategory('del-empty');
      const result = await products.removeCategory(cat.id);
      expect(result).toEqual({ success: true });

      await expect(
        prisma.category.findUnique({ where: { id: cat.id } }),
      ).resolves.toBeNull();
    });

    /**
     * Bypasses removeCategory()'s own pre-check entirely, so this pins the
     * migration (20260714000000_restrict_category_delete_with_products)
     * itself, independent of the service-level guard tested above. If that
     * migration were ever reverted, this is the test that would notice —
     * the product would come back with categoryId: null instead of the
     * delete failing.
     */
    it('the database itself refuses to orphan a product (FK RESTRICT)', async () => {
      const cat = await seedCategory('raw-fk');
      await seedProduct({ label: 'raw-fk-product', categoryId: cat.id });

      await expect(
        prisma.category.delete({ where: { id: cat.id } }),
      ).rejects.toThrow();

      const product = await prisma.product.findFirstOrThrow({
        where: { categoryId: cat.id },
      });
      expect(product.categoryId).toBe(cat.id);
    });
  });
});
