/// <reference types="cypress" />

describe('Catalog Lifecycle, Dynamic Navigation & Media Upload E2E', () => {
  beforeEach(() => {
    // Authenticate as Admin before each test
    cy.loginByApi('admin@textileshop.com', 'Admin@123456');
  });

  it('1. Admin creates a new category and it dynamically appears in Storefront navigation', () => {
    const categoryName = `DynamicDept_${Date.now().toString().slice(-4)}`;

    // Visit categories management
    cy.visit('/admin/categories');
    cy.contains('Categories').should('be.visible');
    cy.get('button[aria-label="Edit"]').should('have.length.at.least', 1);

    // Open form
    cy.get('[data-testid="new-category-btn"]').should('be.visible').click();
    cy.get('#cf-name').should('be.visible').type(categoryName);
    cy.contains('button', /Create category/i).click();

    // Verify it exists in admin category list
    cy.contains(categoryName).should('be.visible');

    // Visit Storefront home
    cy.visit('/');
    cy.get('nav[aria-label="Main Store Categories"]').should('be.visible');
    
    // Assert the new category appears in the top red category bar
    cy.get('nav[aria-label="Main Store Categories"]')
      .contains(categoryName.toUpperCase())
      .should('be.visible');
  });

  it('2. Admin uploads a product image successfully without 500 permission errors', () => {
    cy.visit('/admin/products');
    cy.contains('h1', 'Products').should('be.visible');
    cy.get('table').should('be.visible');
    cy.get('[data-testid="new-product-btn"]').should('be.visible').click();

    // Fill Step 1 using exact element IDs
    cy.get('#pf-name').should('be.visible').type('Automated QA Product');
    cy.get('#pf-sku').type(`QA-SKU-${Date.now().toString().slice(-4)}`);
    cy.get('#pf-stock').scrollIntoView().clear().type('15');
    cy.get('#pf-price').scrollIntoView().clear().type('2500');

    // Advance to Step 2 (Media)
    cy.contains('button', 'Next: Media').should('not.be.disabled').click();
    cy.contains('Click to choose images').should('be.visible');

    // Intercept image upload
    cy.intercept('POST', '**/admin/uploads/image').as('uploadImage');

    // Select file using a minimal valid PNG
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    cy.get('input[type="file"]').selectFile(
      {
        contents: Cypress.Buffer.from(pngBase64, 'base64'),
        fileName: 'qa-upload.png',
        mimeType: 'image/png',
      },
      { force: true }
    );

    // Assert upload was successful
    cy.wait('@uploadImage').then((interception) => {
      expect(interception.response?.statusCode).to.be.oneOf([200, 201]);
      expect(interception.response?.body.data.url).to.include('/uploads/');
    });

    // Check thumbnail is visible
    cy.get('img[src*="/uploads/"]').should('be.visible');
  });

  it('3. Mobile Viewport (iPhone 14 Pro Max) renders production board without hydration or runtime errors', () => {
    // Emulate mobile screen
    cy.viewport(430, 932);

    cy.visit('/admin/production');
    cy.contains('h1', 'Production').should('be.visible');

    // The mobile stage switcher only renders when totalTasks > 0.
    // In a fresh CI seed, there may be no production tasks → empty state.
    // Use a single retryable assertion: Cypress will keep retrying until
    // either outcome appears (handles the loading delay naturally).
    cy.contains(/All Stages|Nothing in production/i, { timeout: 12000 })
      .should('be.visible');
  });
});
