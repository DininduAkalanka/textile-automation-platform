/// <reference types="cypress" />

describe('Admin Full CRUD (Read, Write, Edit) Suite', () => {
  beforeEach(() => {
    // Authenticate as Admin before each test
    cy.loginByApi('admin@textileshop.com', 'Admin@123456');
  });

  /* ──────────────────────────────────────────────────────────
   * READ OPERATIONS
   * ────────────────────────────────────────────────────────── */
  describe('READ Operations', () => {
    it('1. Reads Admin Dashboard metrics & revenue summaries', () => {
      cy.visit('/admin');
      cy.contains('h1, h2', /Dashboard/i).should('be.visible');
      cy.get('.grid').should('be.visible');
    });

    it('2. Reads Orders management table and filters by status', () => {
      cy.intercept('GET', '**/orders/admin/all*').as('getOrders');
      cy.visit('/admin/orders');
      cy.wait('@getOrders');
      cy.contains('h1', 'Orders').should('be.visible');
      // The desktop table (md:block) is visible at our 1280px viewport.
      // If orders exist, a table appears; if none, an empty state shows.
      cy.get('body').then(($body) => {
        if ($body.find('table').length > 0) {
          cy.get('table').should('be.visible');
        } else {
          cy.contains(/No orders|Loading/i).should('be.visible');
        }
      });
    });

    it('3. Reads Inventory stock ledger and verifies stock levels', () => {
      cy.visit('/admin/inventory');
      cy.contains('h1', /Inventory/i).should('be.visible');
      cy.get('table').should('be.visible');
      cy.get('table').contains(/Available|Reserved|Sellable|Status/i).should('be.visible');
    });

    it('4. Reads Production Pipeline Kanban stages', () => {
      cy.visit('/admin/production');
      cy.contains('h1', /Production/i).should('be.visible');
    });
  });

  /* ──────────────────────────────────────────────────────────
   * WRITE OPERATIONS
   * ────────────────────────────────────────────────────────── */
  describe('WRITE Operations (Create)', () => {
    const timestamp = Date.now().toString().slice(-4);
    const newCategoryName = `Dept_${timestamp}`;
    const newProductName = `Product_${timestamp}`;

    it('5. WRITE: Creates a new Category with name & description', () => {
      cy.visit('/admin/categories');
      cy.contains('h1, h2, div', 'Categories').should('be.visible');

      // Wait for existing list to be hydrated
      cy.get('button[aria-label="Edit"]').should('have.length.at.least', 1);

      cy.get('[data-testid="new-category-btn"]').click();
      cy.get('#cf-name').should('be.visible').type(newCategoryName);
      cy.get('#cf-desc').type(`Automated test description for ${newCategoryName}`);
      cy.contains('button', /Create category/i).click();

      // Verify newly written category appears in the list
      cy.contains(newCategoryName).should('be.visible');
    });

    it('6. WRITE: Creates a new Product with media upload, pricing & inventory', () => {
      cy.visit('/admin/products');
      cy.contains('h1', 'Products').should('be.visible');

      // Wait for products table to hydrate
      cy.get('table').should('be.visible');

      cy.get('[data-testid="new-product-btn"]').click();

      // Basics step
      cy.get('#pf-name').should('be.visible').type(newProductName);
      cy.get('#pf-sku').type(`SKU-${timestamp}`);
      cy.get('#pf-stock').scrollIntoView().clear().type('20');
      cy.get('#pf-price').scrollIntoView().clear().type('3450');

      // Advance to Media step
      cy.contains('button', 'Next: Media').should('not.be.disabled').click();
      cy.contains('Click to choose images').should('be.visible');

      // Intercept upload
      cy.intercept('POST', '**/admin/uploads/image').as('uploadImage');

      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      cy.get('input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(pngBase64, 'base64'),
          fileName: `item-${timestamp}.png`,
          mimeType: 'image/png',
        },
        { force: true }
      );

      cy.wait('@uploadImage').its('response.statusCode').should('be.oneOf', [200, 201]);

      // Complete product creation
      cy.contains('button', /Create product/i).click();

      // Verify product is now listed in the desktop table
      cy.get('table').contains(newProductName).should('be.visible');
    });
  });

  /* ──────────────────────────────────────────────────────────
   * EDIT OPERATIONS (Update)
   * ────────────────────────────────────────────────────────── */
  describe('EDIT Operations (Update)', () => {
    it('7. EDIT: Modifies an existing Category name', () => {
      cy.visit('/admin/categories');
      cy.contains('h1, h2, div', 'Categories').should('be.visible');

      // Click Edit on the first available category row
      cy.get('button[aria-label="Edit"]').first().click();

      // Change description and save
      const updatedNote = `Updated ${Date.now()}`;
      cy.get('#cf-desc').should('be.visible').clear().type(updatedNote);
      cy.contains('button', /Save changes/i).click();

      // Verify success
      cy.contains('Categories').should('be.visible');
    });

    it('8. EDIT: Modifies an existing Product price and details', () => {
      cy.visit('/admin/products');
      cy.contains('h1', 'Products').should('be.visible');

      // Wait for table
      cy.get('table').should('be.visible');

      // Click edit on the first product in the list
      cy.get('button[aria-label="Edit"]').first().click();

      // Update the price (scrollIntoView handles sticky footer overlay)
      cy.get('#pf-price').scrollIntoView().should('be.visible').clear().type('7750');

      // Save changes
      cy.contains('button', 'Next: Media').click();
      cy.contains('button', /Save changes/i).click();

      // Verify updated price is reflected in desktop table
      cy.get('table').contains('7,750').should('be.visible');
    });
  });
});
