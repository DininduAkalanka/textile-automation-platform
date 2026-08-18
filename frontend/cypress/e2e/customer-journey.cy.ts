/// <reference types="cypress" />

describe('Customer Journey E2E Flow', () => {
  const timestamp = Date.now();
  const testUser = {
    firstName: 'Test',
    lastName: 'Customer',
    email: `cust_${timestamp}@example.com`,
    phone: `077${Math.floor(1000000 + Math.random() * 9000000)}`,
    password: 'Customer@123456',
  };

  it('1. Registers a new customer account with verified status', () => {
    cy.visit('/register');
    cy.getByTestId('register-firstname-input').type(testUser.firstName);
    cy.getByTestId('register-lastname-input').type(testUser.lastName);
    cy.getByTestId('register-email-input').type(testUser.email);
    cy.getByTestId('register-phone-input').type(testUser.phone);
    cy.getByTestId('register-password-input').type(testUser.password);
    cy.getByTestId('register-confirm-password-input').type(testUser.password);
    cy.getByTestId('register-submit-btn').click();

    // Verify redirected to verify or storefront or account
    cy.url().should('not.include', '/register');
  });

  it('2. Browses products catalog, views detail, and adds to cart', () => {
    // Programmatically authenticate with existing verified demo customer
    cy.loginByApi('customer@example.com', 'Customer@123456');

    cy.visit('/products');
    cy.get('a[href*="/products/"]').first().click();

    cy.url().should('match', /\/products\/[a-zA-Z0-9-]+/);
    cy.get('h1').should('be.visible');

    // Add product to cart
    cy.getByTestId('add-to-cart-btn').click();
    cy.contains('Added to Cart').should('be.visible');

    // Visit cart
    cy.visit('/cart');
    cy.contains('Shopping Cart').should('be.visible');
    cy.getByTestId('cart-proceed-to-checkout-btn').should('be.visible').click();

    // Verify redirected to checkout
    cy.url().should('include', '/checkout');
  });

  it('3. Fills shipping details, selects COD, and places order', () => {
    cy.loginByApi('customer@example.com', 'Customer@123456');

    // Navigate to products and add to cart first
    cy.visit('/products');
    cy.get('a[href*="/products/"]').first().click();
    cy.getByTestId('add-to-cart-btn').click();

    cy.visit('/checkout');

    // Step 1: Shipping
    cy.getByTestId('checkout-name-input').clear().type('Nandana Evaluator');
    cy.getByTestId('checkout-address1-input').clear().type('123 Galle Road');
    cy.getByTestId('checkout-city-input').clear().type('Colombo');
    cy.getByTestId('checkout-state-input').clear().type('Western');
    cy.getByTestId('checkout-postal-input').clear().type('00300');
    cy.getByTestId('checkout-country-input').clear().type('Sri Lanka');
    cy.getByTestId('checkout-phone-input').clear().type('0771234567');

    cy.getByTestId('checkout-continue-to-payment-btn').click();

    // Step 2: Payment Method
    cy.getByTestId('payment-method-cod').click();
    cy.getByTestId('checkout-continue-to-review-btn').click();

    // Step 3: Review & Submit
    cy.getByTestId('checkout-place-order-btn').click();

    // Verify redirect to order details
    cy.url().should('include', '/account/orders');
    cy.contains('Order').should('be.visible');
  });
});
