/// <reference types="cypress" />

describe('Customer Full CRUD (Read, Write, Edit) Suite', () => {
  beforeEach(() => {
    // Authenticate as a verified Customer
    cy.loginByApi('customer@example.com', 'Customer@123456');
  });

  /* ──────────────────────────────────────────────────────────
   * READ OPERATIONS
   * ────────────────────────────────────────────────────────── */
  describe('READ Operations', () => {
    it('1. Reads Products catalog, filters, and product details', () => {
      cy.visit('/products');
      cy.contains('h1', /Collection|Products|Fabrics/i).should('be.visible');

      // Click on the first product card to view product details
      cy.get('a[href*="/products/"]').first().click();

      // Assert single product detail is loaded
      cy.get('h1').should('be.visible');
      cy.contains(/Add to Cart|Custom Measurement|Price/i).should('be.visible');
    });

    it('2. Reads Customer Order History and Status', () => {
      cy.visit('/account/orders');
      cy.contains('h1', 'My Orders').should('be.visible');
    });
  });

  /* ──────────────────────────────────────────────────────────
   * WRITE & EDIT CART OPERATIONS
   * ────────────────────────────────────────────────────────── */
  describe('WRITE & EDIT Operations: Cart & Checkout', () => {
    it('3. WRITE & EDIT: Adds product to cart, edits quantity (+ / -), and removes item', () => {
      // Find a ready-made product without required measurements
      cy.request('GET', 'http://localhost:3001/api/v1/products').then((res) => {
        const products = res.body.data.products || res.body.data;
        const product = products.find((p: any) => !p.requiresMeasurement && p.productType === 'READY_MADE') || products[0];

        // 1. Visit product page and WRITE (Add to cart)
        cy.visit(`/products/${product.slug}`);
        cy.get('[data-testid="add-to-cart-btn"]').should('be.visible').click();

        // 2. READ Cart
        cy.visit('/cart');
        cy.contains('h1', 'Shopping Cart').should('be.visible');
        cy.contains(product.name).should('be.visible');

        // 3. EDIT Cart: Increase quantity
        cy.get('button[aria-label="Increase quantity"]').first().click();
        cy.contains('span', '2').should('be.visible');

        // 4. EDIT Cart: Decrease quantity
        cy.get('button[aria-label="Decrease quantity"]').first().click();
        cy.contains('span', '1').should('be.visible');

        // 5. DELETE / Remove from cart
        cy.get('button[aria-label*="Remove"]').first().click();
        cy.contains(/Your cart is empty|empty/i).should('be.visible');
      });
    });

    it('4. WRITE: Completes full checkout and places an order', () => {
      // Navigate to products and add to cart first
      cy.visit('/products?category=women');
      cy.get('a[href*="/products/"]').first().click();
      cy.getByTestId('add-to-cart-btn').click();

      cy.visit('/checkout');

      // Step 1: Shipping & Contact
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

      // Step 3: Review & Submit (Write Order)
      cy.getByTestId('checkout-place-order-btn').click();

      // Verify redirect to order details
      cy.url({ timeout: 15000 }).should('include', '/account/orders');
    });
  });
});
