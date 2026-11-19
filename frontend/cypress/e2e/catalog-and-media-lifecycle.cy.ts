/// <reference types="cypress" />

import { uploadProductImage } from '../support/upload-product-image';

describe('Catalog Lifecycle, Dynamic Navigation & Media Upload E2E', () => {
  beforeEach(() => {
    // Authenticate as Admin before each test
    cy.loginByApi('admin@textileshop.com', 'Admin@123456');
  });

  it('1. A new category joins the storefront menu only once it has products to show', () => {
    const categoryName = `DynamicDept_${Date.now().toString().slice(-4)}`;
    const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3001/api/v1';
    const menu = () => cy.get('nav[aria-label="Main Store Categories"]');
    let token = '';
    let categoryId = '';
    let productId = '';

    cy.loginByApi('admin@textileshop.com', 'Admin@123456').then(({ accessToken }) => {
      token = accessToken;
    });

    // Admin creates the category through the real admin UI.
    cy.visit('/admin/categories');
    cy.contains('Categories').should('be.visible');
    cy.get('button[aria-label="Edit"]').should('have.length.at.least', 1);
    cy.get('[data-testid="new-category-btn"]').should('be.visible').click();
    cy.get('#cf-name').should('be.visible').type(categoryName);
    cy.contains('button', /Create category/i).click();
    cy.contains(categoryName).should('be.visible');

    // Empty: a menu link would open a page with nothing in it, so it is hidden.
    cy.visit('/');
    menu().should('be.visible').and('contain.text', 'WOMEN');
    menu().should('not.contain.text', categoryName.toUpperCase());

    // Add one active product to it: now it appears.
    cy.request(`${apiUrl}/categories`).then((res) => {
      const categories = res.body.data || res.body;
      categoryId = categories.find((c: { name: string }) => c.name === categoryName).id;
      cy.request({
        method: 'POST',
        url: `${apiUrl}/products`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          name: `${categoryName} Shirt`,
          sku: `${categoryName}-SKU`,
          price: 2500,
          stockQuantity: 5,
          categoryId,
        },
      }).then((created) => {
        productId = (created.body.data || created.body).id;
      });
    });
    cy.visit('/');
    menu().contains(categoryName.toUpperCase()).scrollIntoView().should('be.visible');

    // Archive that product: the category is empty for shoppers again.
    cy.then(() =>
      cy.request({ method: 'DELETE', url: `${apiUrl}/products/${productId}`, headers: { Authorization: `Bearer ${token}` } }),
    );
    cy.visit('/');
    menu().should('contain.text', 'WOMEN').and('not.contain.text', categoryName.toUpperCase());

    // Clean up so the test leaves nothing behind.
    cy.then(() => {
      cy.request({
        method: 'DELETE',
        url: `${apiUrl}/products/${productId}/permanent`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      });
      cy.request({
        method: 'DELETE',
        url: `${apiUrl}/categories/${categoryId}`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      });
    });
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

    uploadProductImage('qa-upload.png');

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
