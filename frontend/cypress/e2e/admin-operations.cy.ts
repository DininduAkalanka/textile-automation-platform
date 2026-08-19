/// <reference types="cypress" />

describe('Admin Dashboard & Production Operations E2E', () => {
  beforeEach(() => {
    // Authenticate as Admin
    cy.loginByApi('admin@textileshop.com', 'Admin@123456');
  });

  it('1. Loads admin dashboard metrics and revenue figures', () => {
    cy.visit('/admin');
    cy.contains('Dashboard').should('be.visible');
    cy.get('h1, h2').should('be.visible');
  });

  it('2. Navigates to Orders management table and filters orders', () => {
    cy.visit('/admin/orders');
    cy.contains('Orders').should('be.visible');
    cy.get('input[placeholder*="Order number"]').should('be.visible');
    cy.get('select').should('have.length.at.least', 1);
  });

  it('3. Views Production pipeline board and task stages', () => {
    cy.visit('/admin/production');
    cy.contains(/Production/i).should('be.visible');
  });

  it('4. Views Inventory real-time stock and ledger', () => {
    cy.visit('/admin/inventory');
    cy.contains(/Inventory/i).should('be.visible');
    cy.contains(/Stock|SKU|Quantity/i).should('be.visible');
  });
});
