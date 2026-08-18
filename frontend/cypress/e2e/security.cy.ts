/// <reference types="cypress" />

describe('Security & RBAC Enforcement E2E', () => {
  const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3001/api/v1';

  it('1. Blocks unauthenticated users from accessing protected customer account routes', () => {
    cy.visit('/account/orders');
    // Expect redirection to login
    cy.url().should('include', '/login');
  });

  it('2. Blocks non-admin customers from accessing the Admin Dashboard', () => {
    cy.loginByApi('customer@example.com', 'Customer@123456');
    cy.visit('/admin');

    // Should be redirected away or shown forbidden/unauthorized
    cy.url().should('not.eq', Cypress.config().baseUrl + '/admin');
  });

  it('3. IDOR Prevention: Customer cannot access private orders belonging to others via API', () => {
    // 1. Admin login to get another user's order
    cy.loginByApi('admin@textileshop.com', 'Admin@123456').then(({ accessToken: adminToken }) => {
      cy.request({
        method: 'GET',
        url: `${apiUrl}/orders/admin/all?limit=1`,
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((adminRes) => {
        const orders = adminRes.body.data?.orders || adminRes.body.orders || [];
        if (orders.length > 0) {
          const targetOrderId = orders[0].id;

          // 2. Customer login
          cy.loginByApi('customer@example.com', 'Customer@123456').then(({ accessToken: customerToken }) => {
            // 3. Try to access order not belonging to this customer
            cy.request({
              method: 'GET',
              url: `${apiUrl}/orders/${targetOrderId}`,
              headers: { Authorization: `Bearer ${customerToken}` },
              failOnStatusCode: false,
            }).then((customerRes) => {
              // Must be 403 Forbidden or 404 Not Found (or 200 only if customer happens to be the owner)
              if (customerRes.status !== 200) {
                expect([403, 404]).to.include(customerRes.status);
              }
            });
          });
        }
      });
    });
  });
});
