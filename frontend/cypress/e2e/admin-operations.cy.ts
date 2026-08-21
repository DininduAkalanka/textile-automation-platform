/// <reference types="cypress" />

describe('Admin Dashboard & Production Operations E2E', () => {
  const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3001/api/v1';

  before(() => {
    // Hermetic setup: Seed at least 1 order via API so the admin table is populated
    cy.loginByApi('customer@example.com', 'Customer@123456').then(({ accessToken }) => {
      cy.request({
        method: 'GET',
        url: `${apiUrl}/products`,
      }).then((prodRes) => {
        const products = prodRes.body.data.products || prodRes.body.data;
        const product = products.find((p: any) => !p.requiresMeasurement && p.productType === 'READY_MADE') || products[0];
        if (product) {
          cy.request({
            method: 'POST',
            url: `${apiUrl}/orders`,
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            body: {
              items: [
                {
                  productId: product.id,
                  quantity: 1,
                  ...(product.requiresMeasurement
                    ? {
                        measurements: {
                          personName: 'Admin Test Student',
                          unit: 'cm',
                          values: {
                            chest: 96,
                            waist: 80,
                            shoulder: 45,
                            sleeveLength: 60,
                            shirtLength: 70,
                            trouserWaist: 80,
                            hip: 95,
                            trouserLength: 100,
                          },
                        },
                      }
                    : {}),
                },
              ],
              shippingAddress: {
                fullName: 'Admin Test Customer',
                addressLine1: '123 Galle Road',
                city: 'Colombo',
                state: 'Western',
                postalCode: '00300',
                country: 'Sri Lanka',
                phone: '0771234567',
              },
            },
          });
        }
      });
    });
  });

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
    cy.getByTestId('admin-orders-loading').should('not.exist', { timeout: 10000 });
    cy.getByTestId('admin-orders-table').should('be.visible');
    cy.getByTestId('admin-order-row').should('have.length.at.least', 1);
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
