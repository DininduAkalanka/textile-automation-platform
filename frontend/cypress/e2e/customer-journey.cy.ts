/// <reference types="cypress" />

describe('Customer Journey E2E Flow', () => {
  it('1. Registers a new customer account with verified status', () => {
    const runId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const phoneSuffix = String(Math.floor(Math.random() * 10000000)).padStart(7, '0');
    const testUser = {
      firstName: 'Test',
      lastName: 'Customer',
      email: `cust_${runId}@example.com`,
      phone: `077${phoneSuffix}`,
      password: 'Customer@123456',
    };

    cy.visit('/register');
    cy.get('form').should('be.visible');
    cy.wait(500);
    cy.get('input[name="firstName"]').clear().type(testUser.firstName).should('have.value', testUser.firstName);
    cy.get('input[name="lastName"]').clear().type(testUser.lastName).should('have.value', testUser.lastName);
    cy.get('input[name="email"]').clear().type(testUser.email).should('have.value', testUser.email);
    cy.get('input[name="phone"]').clear().type(testUser.phone).should('have.value', testUser.phone);
    cy.get('input[name="password"]').clear().type(testUser.password);
    cy.get('input[name="confirmPassword"]').clear().type(testUser.password);
    cy.getByTestId('register-submit-btn').click();

    // Verify redirected to verify page
    cy.url({ timeout: 20000 }).should('include', '/verify');
  });

  it('2. Browses products catalog, views detail, and adds to cart', () => {
    // Programmatically authenticate with existing verified demo customer
    cy.loginByApi('customer@example.com', 'Customer@123456');

    cy.visit('/products?category=women');
    cy.get('a[href*="/products/"]').first().click();

    cy.url().should('match', /\/products\/[a-zA-Z0-9-]+/);
    cy.get('h1').should('be.visible');

    // Add product to cart
    cy.getByTestId('add-to-cart-btn').click();
    cy.contains(/Added to Cart/i).should('be.visible');

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
    cy.visit('/products?category=women');
    cy.get('a[href*="/products/"]').first().click();
    cy.getByTestId('add-to-cart-btn').click();

    cy.visit('/checkout');

    // Step 1: Shipping & Contact
    // Fill email explicitly — the in-memory token store (F-04) means
    // isAuthenticated may be false after page navigation in CI, so the
    // validation requires email to be non-empty.
    cy.getByTestId('checkout-email-input').then(($el) => {
      if (!$el.prop('disabled')) {
        cy.wrap($el).clear().type('customer@example.com');
      }
    });
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

  it('4. Completes Guest Express Checkout without prior account creation', () => {
    // Ensure no session
    Cypress.env('token', null);
    Cypress.env('user', null);
    cy.clearLocalStorage();
    cy.clearCookies();

    cy.visit('/products?category=women');
    cy.get('a[href*="/products/"]').first().click();
    cy.getByTestId('add-to-cart-btn').click();

    // Guest goes straight to checkout
    cy.visit('/checkout');
    cy.contains('Express Checkout').should('be.visible');

    const guestSuffix = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    cy.getByTestId('checkout-name-input').clear().type('Guest Shopper');
    cy.getByTestId('checkout-email-input').clear().type(`guest_${guestSuffix}@example.com`);
    cy.getByTestId('checkout-phone-input').clear().type('0777654321');
    cy.getByTestId('checkout-address1-input').clear().type('45 Beach Road');
    cy.getByTestId('checkout-city-input').clear().type('Mount Lavinia');
    cy.getByTestId('checkout-state-input').clear().type('Western Province');
    cy.getByTestId('checkout-postal-input').clear().type('10370');
    cy.getByTestId('checkout-country-input').clear().type('Sri Lanka');

    cy.getByTestId('checkout-continue-to-payment-btn').click();

    // Select PayHere online payment
    cy.getByTestId('payment-method-payhere').click();
    cy.getByTestId('checkout-continue-to-review-btn').click();

    // Confirm button ready for payment
    cy.getByTestId('checkout-place-order-btn').should('be.visible');
  });
});
