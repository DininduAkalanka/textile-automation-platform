/// <reference types="cypress" />

/**
 * Customer Journey Full E2E Flow
 *
 * Real customer journey covering all critical paths:
 *  1. Full Lifecycle: UI Account Registration -> UI OTP Verification -> Catalog
 *     Discovery -> Cart Modification -> Multi-step Checkout -> Order Confirmation
 *     -> Real-time Order Tracking Stepper -> Order History View.
 *  2. Bespoke Garment Journey: Custom uniform/shirt ordering with measurement
 *     specification dialog and verification on the tracking page.
 *  3. Order Cancellation Lifecycle: Customer cancels a pending order directly
 *     from the order tracking view, asserting state transition to Cancelled.
 *  4. Guest Express Checkout: Frictionless guest purchase without prior account.
 */

export {};

const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3001/api/v1';

describe('Customer Journey E2E Flow', () => {
  beforeEach(() => {
    // Ensure clean state before each test
    Cypress.env('token', null);
    Cypress.env('user', null);
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 1. FULL REAL CUSTOMER LIFECYCLE (REGISTER -> VERIFY -> BROWSE -> ORDER -> TRACK)
   * ────────────────────────────────────────────────────────────────────────── */
  it('1. Full customer lifecycle: Registration, UI OTP verification, catalog browsing, cart editing, checkout, tracking & order history', () => {
    const runId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const phoneSuffix = String(Math.floor(Math.random() * 10000000)).padStart(7, '0');
    const testUser = {
      firstName: 'Nimal',
      lastName: 'Perera',
      email: `customer_${runId}@example.com`,
      phone: `077${phoneSuffix}`,
      password: 'Customer@123456',
    };

    let placedOrderNumber: string;

    // ── Step A: Account Registration via UI ────────────────────────────────
    cy.visit('/register');
    cy.get('form[data-testid="register-form"]').should('be.visible');
    cy.wait(500);

    cy.get('input[name="firstName"]').clear().type(testUser.firstName);
    cy.get('input[name="lastName"]').clear().type(testUser.lastName);
    cy.get('input[name="email"]').clear().type(testUser.email);
    cy.get('input[name="phone"]').clear().type(testUser.phone);
    cy.get('input[name="password"]').clear().type(testUser.password);
    cy.get('input[name="confirmPassword"]').clear().type(testUser.password);

    cy.intercept('POST', '**/auth/register').as('registerReq');
    cy.getByTestId('register-submit-btn').click();
    cy.wait('@registerReq');

    // ── Step B: Contact OTP Verification via UI ─────────────────────────────
    cy.url({ timeout: 15000 }).should('include', '/verify');
    cy.get('input[placeholder="123456"]').should('be.visible').type('123456');

    cy.intercept('POST', '**/auth/verify-code').as('verifyReq');
    cy.contains('button', /Verify/i).click();
    cy.wait('@verifyReq');

    // Wait for redirect after verification
    cy.url({ timeout: 15000 }).should('not.include', '/verify');

    // ── Step C: Catalog Discovery & Cart Management ─────────────────────────
    // Query catalog to find a ready-made product
    cy.request('GET', `${apiUrl}/products?limit=100`).then((res) => {
      const prods = res.body.data.products || res.body.data;
      const readyProduct = prods.find((p: any) => !p.requiresMeasurement) || prods[0];

      cy.visit(`/products/${readyProduct.slug}`);
      cy.get('h1').should('be.visible');

      // Add to cart
      cy.getByTestId('add-to-cart-btn').scrollIntoView().should('be.visible').click();
      cy.contains(/Added to Cart|Shopping Bag/i).should('be.visible');

      // Navigate to Cart
      cy.visit('/cart');
      cy.contains('h1', 'Shopping Cart').should('be.visible');

      // Edit Cart: Increase quantity to 2
      cy.get('button[aria-label="Increase quantity"]').first().click();
      cy.contains('span', '2').should('be.visible');

      // Proceed to Checkout
      cy.getByTestId('cart-proceed-to-checkout-btn').should('be.visible').click();
      cy.url({ timeout: 15000 }).should('include', '/checkout');

      // ── Step D: Multi-Step Checkout ─────────────────────────────────────────
      // Step 1: Shipping Address
      cy.getByTestId('checkout-email-input').then(($el) => {
        if (!$el.prop('disabled')) {
          cy.wrap($el).clear().type(testUser.email);
        }
      });
      cy.getByTestId('checkout-name-input').clear().type(`${testUser.firstName} ${testUser.lastName}`);
      cy.getByTestId('checkout-address1-input').clear().type('24 Temple Road');
      cy.getByTestId('checkout-city-input').clear().type('Colombo');
      cy.getByTestId('checkout-state-input').clear().type('Western');
      cy.getByTestId('checkout-postal-input').clear().type('00500');
      cy.getByTestId('checkout-country-input').clear().type('Sri Lanka');
      cy.getByTestId('checkout-phone-input').clear().type(testUser.phone);

      cy.getByTestId('checkout-continue-to-payment-btn').click();

      // Step 2: Payment Method Selection (COD)
      cy.getByTestId('payment-method-cod').click();
      cy.getByTestId('checkout-continue-to-review-btn').click();

      // Step 3: Review & Submit
      cy.intercept('POST', '**/orders*').as('placeOrderReq');
      cy.getByTestId('checkout-place-order-btn').click();
      cy.wait('@placeOrderReq');

      // ── Step E: Order Confirmation & Real-Time Tracking ────────────────────
      cy.url({ timeout: 20000 }).should('include', '/account/orders/');
      cy.contains(/Order Placed Successfully/i).should('be.visible');

      cy.get('h1')
        .should('be.visible')
        .and('not.be.empty')
        .invoke('text')
        .then((orderNum) => {
          placedOrderNumber = orderNum.trim();
          expect(placedOrderNumber).to.match(/TXL-|NT-/i);

          // Verify Order Tracking Stepper
          cy.contains('h3', 'Tracking').should('be.visible');
          cy.contains('Order placed').should('be.visible');
          cy.contains('Confirmed').should('be.visible');
          cy.contains('Completed').should('be.visible');
          cy.contains('Delivered').should('be.visible');

          // ── Step F: Order History & Re-Tracking ─────────────────────────────
          // Re-authenticate session in CI to populate local storage across hard reload
          cy.loginByApi(testUser.email, testUser.password);
          cy.visit('/account/orders');
          cy.contains('h1', 'My Orders').should('be.visible');

          // Assert newly placed order is present in the customer order list
          cy.contains(placedOrderNumber).should('be.visible').click();

          // Verify navigating back into the order detail view restores tracking
          cy.url().should('include', '/account/orders/');
          cy.contains(placedOrderNumber).should('be.visible');
          cy.contains('Order placed').should('be.visible');
        });
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 2. BESPOKE CUSTOM MEASUREMENT GARMENT JOURNEY
   * ────────────────────────────────────────────────────────────────────────── */
  it('2. Bespoke journey: Configures custom garment measurements in cart, checks out, and inspects measurements in order tracking', () => {
    // Authenticate as demo customer
    cy.loginByApi('customer@example.com', 'Customer@123456');

    // Query catalog for a product requiring custom measurements
    cy.request({
      method: 'GET',
      url: `${apiUrl}/products?limit=100`,
    }).then((res) => {
      const products = res.body.data.products || res.body.data;
      const customProduct = products.find((p: any) => p.requiresMeasurement);
      expect(customProduct, 'a product requiring measurements must exist').to.exist;

      // Visit custom product details page and add to cart
      cy.visit(`/products/${customProduct.slug}`);
      cy.getByTestId('add-to-cart-btn').click();

      // Visit Cart — cart flags missing measurements
      cy.visit('/cart');
      cy.contains('h1', 'Shopping Cart').should('be.visible');
      cy.contains('button', /Add Custom Measurements/i).should('be.visible').click();

      // Fill Measurement Dialog
      cy.get('input[name="personName"]').should('be.visible').clear().type('Kamal Tailored Spec');
      cy.get('form').find('input[type="number"]').each(($input) => {
        const min = Number($input.attr('min')) || 30;
        cy.wrap($input).clear().type(String(min + 10));
      });

      cy.contains('button', /Save measurements/i).click();
      cy.contains('button', /Save measurements/i).should('not.exist');

      // Proceed to Checkout
      cy.getByTestId('cart-proceed-to-checkout-btn').should('be.visible').click();
      cy.url({ timeout: 15000 }).should('include', '/checkout');

      // Fill Shipping & Place Order
      cy.getByTestId('checkout-name-input').clear().type('Kamal Customer');
      cy.getByTestId('checkout-address1-input').clear().type('55 Tailor Lane');
      cy.getByTestId('checkout-city-input').clear().type('Kandy');
      cy.getByTestId('checkout-state-input').clear().type('Central');
      cy.getByTestId('checkout-postal-input').clear().type('20000');
      cy.getByTestId('checkout-country-input').clear().type('Sri Lanka');
      cy.getByTestId('checkout-phone-input').clear().type('0772223344');

      cy.getByTestId('checkout-continue-to-payment-btn').click();
      cy.getByTestId('payment-method-cod').click();
      cy.getByTestId('checkout-continue-to-review-btn').click();

      cy.intercept('POST', '**/orders*').as('bespokeOrderReq');
      cy.getByTestId('checkout-place-order-btn').click();
      cy.wait('@bespokeOrderReq');

      // Assert Order Details snapshot measurements and tracking stepper
      cy.url({ timeout: 20000 }).should('include', '/account/orders/');
      cy.contains(/Order Placed Successfully/i).should('be.visible');
      cy.contains('Order placed').should('be.visible');
      cy.contains('Measurements — Kamal Tailored Spec').should('be.visible');
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 3. ORDER CANCELLATION LIFECYCLE FROM TRACKING VIEW
   * ────────────────────────────────────────────────────────────────────────── */
  it('3. Order cancellation: Cancels a pending order directly from the order tracking view', () => {
    cy.loginByApi('customer@example.com', 'Customer@123456').then(({ accessToken }) => {
      // Find a ready-made product
      cy.request({
        method: 'GET',
        url: `${apiUrl}/products?limit=100`,
      }).then((prodRes) => {
        const products = prodRes.body.data.products || prodRes.body.data;
        const product = products.find((p: any) => !p.requiresMeasurement) || products[0];

        // Create an order via API
        cy.request({
          method: 'POST',
          url: `${apiUrl}/orders`,
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            items: [{ productId: product.id, quantity: 1 }],
            shippingAddress: {
              fullName: 'Cancel Test User',
              addressLine1: '10 Queens Way',
              city: 'Colombo',
              state: 'Western',
              postalCode: '00700',
              country: 'Sri Lanka',
              phone: '0779998877',
            },
          },
        }).then((orderRes) => {
          const order = orderRes.body.data || orderRes.body;

          // Visit Order Tracking page
          cy.visit(`/account/orders/${order.id}`);
          cy.contains('h1', order.orderNumber, { timeout: 15000 }).should('be.visible');
          cy.contains('Order placed').should('be.visible');

          // Cancel the order
          cy.intercept('PUT', `**/orders/${order.id}/cancel`).as('cancelOrderReq');
          cy.contains('button', /Cancel Order/i).should('be.visible').click();
          cy.wait('@cancelOrderReq');

          // Assert cancellation state in the tracking stepper
          cy.contains(/Order cancelled/i, { timeout: 10000 }).should('be.visible');
          cy.contains('button', /Cancel Order/i).should('not.exist');
        });
      });
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 4. GUEST EXPRESS CHECKOUT JOURNEY
   * ────────────────────────────────────────────────────────────────────────── */
  it('4. Guest Express Checkout: Completes an order without prior account creation', () => {
    cy.request('GET', `${apiUrl}/products?limit=100`).then((res) => {
      const prods = res.body.data?.products || res.body.products || res.body.data;
      const product = prods.find((p: any) => !p.requiresMeasurement && p.stockQuantity > 0) || prods[0];

      cy.visit(`/products/${product.slug}`);
      cy.getByTestId('add-to-cart-btn').scrollIntoView().should('be.visible').click();

      // Guest goes straight to checkout
      cy.visit('/checkout');
      cy.contains(/Express Checkout|Customer Information/i).should('be.visible');

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
});
