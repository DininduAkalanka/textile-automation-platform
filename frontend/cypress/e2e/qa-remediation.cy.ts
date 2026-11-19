/// <reference types="cypress" />

/**
 * QA remediation — live browser regression (independent QA report, 2026-11-19).
 *
 * Drives the real storefront + API for the P0/P1 fixes that a shopper, a
 * worker or an attacker can reach through the UI, and replays the report's
 * API attacks against the running stack. Every PayHere hand-off is captured
 * in the page (the form submit is stubbed), so no request ever leaves the
 * local stack.
 */

export {};

const apiUrl: string = Cypress.env('apiUrl') || 'http://localhost:3001/api/v1';
const merchantId: string = Cypress.env('payhereMerchantId') || '1221149';

const uniq = () => `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
const lkPhone = () => `077${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`;
const body = (res: Cypress.Response<any>) => res.body.data ?? res.body;

const address = {
  fullName: 'QA Cypress Buyer',
  addressLine1: '45 Beach Road',
  city: 'Mount Lavinia',
  state: 'Western Province',
  postalCode: '10370',
  country: 'Sri Lanka',
  phone: '0771234567',
};

const allMeasurements = {
  personName: 'QA Child',
  unit: 'cm',
  values: {
    chest: 90,
    waist: 75,
    shoulder: 42,
    sleeveLength: 55,
    shirtLength: 68,
    frockLength: 80,
    trouserWaist: 75,
    hip: 88,
    trouserLength: 95,
  },
};

/** An in-stock ready-made product with no per-size stock (so any size works). */
function readyProduct(): Cypress.Chainable<any> {
  return cy.request('GET', `${apiUrl}/products?limit=100`).then((res) => {
    const products = body(res).products ?? body(res);
    const product = products.find(
      (p: any) => !p.requiresMeasurement && p.stockQuantity > 5 && !p.attributes?.sizeStock,
    );
    expect(product, 'an in-stock ready-made product').to.exist;
    return product;
  });
}

function signedNotify(orderRef: string, amount: string, paymentId: string) {
  return cy
    .task('payhereNotifySig', {
      merchantId,
      orderId: orderRef,
      amount,
      currency: 'LKR',
      statusCode: '2',
    })
    .then((md5sig) => ({
      merchant_id: merchantId,
      order_id: orderRef,
      payment_id: paymentId,
      payhere_amount: amount,
      payhere_currency: 'LKR',
      status_code: '2',
      md5sig,
    }));
}

/** Add one unit to the cart through the product page, then open checkout. */
function addToCartAndCheckout(product: any) {
  cy.visit(`/products/${product.slug}`);
  cy.getByTestId('add-to-cart-btn').scrollIntoView().click({ force: true });
  cy.visit('/checkout');
  cy.contains(/Express Checkout/i).should('be.visible');
}

function fillShipping(contact: { email?: string; phone: string }) {
  cy.getByTestId('checkout-name-input').clear().type(address.fullName);
  if (contact.email) {
    cy.getByTestId('checkout-email-input').then(($el) => {
      if (!$el.prop('disabled')) cy.wrap($el).clear().type(contact.email!);
    });
  }
  cy.getByTestId('checkout-phone-input').clear().type(contact.phone);
  cy.getByTestId('checkout-address1-input').clear().type(address.addressLine1);
  cy.getByTestId('checkout-city-input').clear().type(address.city);
  cy.getByTestId('checkout-state-input').clear().type(address.state);
  cy.getByTestId('checkout-postal-input').clear().type(address.postalCode);
  cy.getByTestId('checkout-country-input').clear().type(address.country);
  cy.getByTestId('checkout-continue-to-payment-btn').click();
}

/** Capture the PayHere form instead of navigating to PayHere. */
function stubPayhereSubmit() {
  cy.window().then((win) => {
    cy.stub(win.HTMLFormElement.prototype, 'submit')
      .callsFake(function (this: HTMLFormElement) {
        (win as any).__payhere = {
          action: this.action,
          fields: Object.fromEntries(new win.FormData(this) as any),
        };
      })
      .as('payhereSubmit');
  });
}

describe('QA remediation — live regression', () => {
  beforeEach(() => {
    Cypress.env('token', null);
    Cypress.env('user', null);
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  // ─── P0-1 ────────────────────────────────────────────────────────────────
  it('P0-1 (API): guest checkout with the ADMIN email returns 409 and no session', () => {
    readyProduct().then((product) => {
      cy.request({
        method: 'POST',
        url: `${apiUrl}/orders/guest-checkout`,
        failOnStatusCode: false,
        body: {
          items: [{ productId: product.id, quantity: 1 }],
          shippingAddress: address,
          email: 'admin@textileshop.com',
          phone: lkPhone(),
          fullName: 'Attacker',
          paymentMethod: 'PAYHERE',
        },
      }).then((res) => {
        expect(res.status).to.eq(409);
        expect(res.body.error.code).to.eq('LOGIN_REQUIRED');
        expect(JSON.stringify(res.body)).not.to.match(/accessToken/);
        const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
        expect(cookies.some((c) => c.startsWith('refresh_token='))).to.eq(false);
      });
    });
  });

  it('P0-1 (UI): a guest using an existing account email is asked to sign in — and is not logged in', () => {
    readyProduct().then((product) => {
      addToCartAndCheckout(product);
      fillShipping({ email: 'customer@example.com', phone: lkPhone() });
      cy.getByTestId('payment-method-payhere').click();
      cy.getByTestId('checkout-continue-to-review-btn').click();

      cy.intercept('POST', '**/orders/guest-checkout').as('guest');
      cy.getByTestId('checkout-place-order-btn').click();
      cy.wait('@guest').its('response.statusCode').should('eq', 409);

      cy.getByTestId('checkout-error').should('contain.text', 'already exists');
      cy.getByTestId('checkout-login-required-signin')
        .should('be.visible')
        .and('have.attr', 'href', '/login?returnTo=/checkout');
      cy.window().then((win) => expect(win.localStorage.getItem('user')).to.eq(null));
    });
  });

  // ─── P1-8 ────────────────────────────────────────────────────────────────
  it('P1-8 (UI): a guest pays Cash on Delivery — code sent, verified, order placed AND confirmed', () => {
    const email = `qa_cod_${uniq()}@example.com`;
    readyProduct().then((product) => {
      addToCartAndCheckout(product);
      fillShipping({ email, phone: lkPhone() });
      cy.getByTestId('payment-method-cod').click();
      cy.getByTestId('checkout-continue-to-review-btn').click();

      cy.intercept('POST', '**/orders/guest-checkout/send-code').as('sendCode');
      cy.intercept('POST', '**/orders/guest-checkout').as('guest');
      cy.getByTestId('checkout-place-order-btn').click();

      // First attempt: the API asks for a code; the page requests one for the guest.
      cy.wait('@guest').its('response.body.error.code').should('eq', 'VERIFICATION_REQUIRED');
      cy.wait('@sendCode').its('response.statusCode').should('eq', 201);
      cy.getByTestId('checkout-otp-hint').should('contain.text', email);

      // Non-production stacks accept the development bypass code.
      cy.getByTestId('checkout-otp-input').type('123456');
      cy.getByTestId('checkout-verify-confirm-btn').click();
      cy.wait('@guest').then(({ response }) => {
        expect(response!.statusCode).to.eq(201);
        expect(response!.body.data.order.status).to.eq('CONFIRMED');
        expect(response!.body.data.order.payment.method).to.eq('COD');
        expect(response!.body.data.session.user.emailVerified).to.eq(true);
      });
      cy.url({ timeout: 20_000 }).should('include', '/account/orders/');
      cy.contains(/Order Placed Successfully/i).should('be.visible');
    });
  });

  // ─── P1-7 ────────────────────────────────────────────────────────────────
  it('P1-7 (UI): an installment plan pays installment 1 through PayHere; the schedule then offers installment 2', () => {
    cy.loginByApi('customer@example.com', 'Customer@123456');
    readyProduct().then((product) => {
      addToCartAndCheckout(product);
      fillShipping({ phone: lkPhone() });
      cy.getByTestId('payment-method-installment').click();
      cy.getByTestId('checkout-continue-to-review-btn').click();

      stubPayhereSubmit();
      cy.intercept('POST', '**/payments/installments/create').as('plan');
      cy.intercept('POST', '**/payments/installments/payhere').as('payInstallment');
      cy.getByTestId('checkout-place-order-btn').click();

      cy.wait('@plan').then(({ response }) => {
        expect(response!.statusCode).to.eq(201);
        expect(response!.body.data.currency).to.eq('LKR');
        expect(response!.body.data.installments).to.have.length(3);
      });
      cy.wait('@payInstallment').its('response.statusCode').should('eq', 201);
      cy.get('@payhereSubmit').should('have.been.calledOnce');

      cy.window()
        .its('__payhere')
        .then((payhere: any) => {
          expect(payhere.action).to.match(/payhere\.lk\/pay\/checkout$/);
          expect(payhere.fields.order_id).to.match(/-I1$/);
          expect(payhere.fields.currency).to.eq('LKR');
          const orderId = /\/account\/orders\/([0-9a-f-]{36})\/installments/.exec(
            payhere.fields.return_url,
          )![1];

          // PayHere's server-to-server confirmation for installment 1.
          signedNotify(payhere.fields.order_id, payhere.fields.amount, `QA-CY-${uniq()}`).then(
            (notify) => {
              cy.request('POST', `${apiUrl}/payments/payhere/notify`, notify);
            },
          );

          cy.visit(`/account/orders/${orderId}/installments?paid=1`);
          cy.getByTestId('installment-payment-returned').should('be.visible');
          cy.contains('1 of 3 paid').should('be.visible');
          cy.getByTestId('installment-pay-2').should('be.visible').and('contain.text', 'PayHere');
          cy.getByTestId('installment-pay-3').should('not.exist'); // paid in order
        });
    });
  });

  // ─── P1-1 / P1-2 (API) ───────────────────────────────────────────────────
  it('P1-1 (API): a forged notify first cannot block the genuine one — the order is confirmed', () => {
    cy.loginByApi('customer@example.com', 'Customer@123456').then(({ accessToken }) => {
      readyProduct().then((product) => {
        const auth = { Authorization: `Bearer ${accessToken}` };
        cy.request({
          method: 'POST',
          url: `${apiUrl}/orders`,
          headers: auth,
          body: { items: [{ productId: product.id, quantity: 1 }], shippingAddress: address },
        }).then((orderRes) => {
          const order = body(orderRes);
          cy.request({
            method: 'POST',
            url: `${apiUrl}/payments/payhere/create`,
            headers: auth,
            body: { orderId: order.id },
          });
          const paymentId = `QA-CY-${uniq()}`;
          signedNotify(order.orderNumber, Number(order.total).toFixed(2), paymentId).then(
            (genuine) => {
              cy.request('POST', `${apiUrl}/payments/payhere/notify`, {
                ...genuine,
                md5sig: '0'.repeat(32),
              });
              cy.request('POST', `${apiUrl}/payments/payhere/notify`, genuine).then((res) => {
                expect(body(res).duplicate).to.eq(undefined);
              });
            },
          );
          cy.request({ url: `${apiUrl}/orders/${order.id}`, headers: auth }).then((res) => {
            expect(body(res).status).to.eq('CONFIRMED');
            expect(body(res).payment.status).to.eq('COMPLETED');
          });
        });
      });
    });
  });

  it('P1-2 (API): a cancelled order refuses Cash on Delivery and PayHere', () => {
    cy.loginByApi('customer@example.com', 'Customer@123456').then(({ accessToken }) => {
      readyProduct().then((product) => {
        const auth = { Authorization: `Bearer ${accessToken}` };
        cy.request({
          method: 'POST',
          url: `${apiUrl}/orders`,
          headers: auth,
          body: { items: [{ productId: product.id, quantity: 1 }], shippingAddress: address },
        }).then((orderRes) => {
          const orderId = body(orderRes).id;
          cy.request({ method: 'PUT', url: `${apiUrl}/orders/${orderId}/cancel`, headers: auth, body: {} });
          for (const path of ['/payments/cod', '/payments/payhere/create']) {
            cy.request({
              method: 'POST',
              url: `${apiUrl}${path}`,
              headers: auth,
              body: { orderId },
              failOnStatusCode: false,
            }).then((res) => {
              expect(res.status).to.eq(400);
              expect(res.body.error.code).to.eq('ORDER_NOT_PAYABLE');
            });
          }
          cy.request({ url: `${apiUrl}/orders/${orderId}`, headers: auth })
            .its('body.data.status')
            .should('eq', 'CANCELLED');
        });
      });
    });
  });

  // ─── P1-9 ────────────────────────────────────────────────────────────────
  it('P1-9: a worker cannot start, and no longer sees, a task whose order was cancelled', () => {
    cy.loginByApi('customer@example.com', 'Customer@123456').then(({ accessToken }) => {
      const auth = { Authorization: `Bearer ${accessToken}` };
      cy.request('GET', `${apiUrl}/products?limit=100`).then((res) => {
        const products = body(res).products ?? body(res);
        const made = products.find((p: any) => p.requiresMeasurement && p.stockQuantity > 2);
        expect(made, 'a made-to-measure product').to.exist;
        cy.request({
          method: 'POST',
          url: `${apiUrl}/orders`,
          headers: auth,
          body: {
            items: [
              {
                productId: made.id,
                quantity: 1,
                measurements: allMeasurements,
                ...(made.attributes?.sizeStock ? { selectedAttributes: { size: 'Custom' } } : {}),
              },
            ],
            shippingAddress: address,
          },
        }).then((orderRes) => {
          const order = body(orderRes);
          cy.request({ method: 'POST', url: `${apiUrl}/payments/cod`, headers: auth, body: { orderId: order.id } });
          cy.request({ url: `${apiUrl}/orders/${order.id}`, headers: auth }).then((detail) => {
            const taskId = body(detail).productionTasks[0].id;

            cy.loginByApi('admin@textileshop.com', 'Admin@123456').then(({ accessToken: adminToken }) => {
              const admin = { Authorization: `Bearer ${adminToken}` };
              cy.request({ url: `${apiUrl}/production/workers`, headers: admin }).then((w) => {
                const worker = body(w).find((x: any) => x.email === 'worker.cutting@textileshop.com');
                cy.request({
                  method: 'PUT',
                  url: `${apiUrl}/production/tasks/${taskId}/assign`,
                  headers: admin,
                  body: { workerId: worker.id },
                });
              });
              cy.request({
                method: 'PUT',
                url: `${apiUrl}/orders/admin/${order.id}/action`,
                headers: admin,
                body: { action: 'cancel' },
              });
            });

            cy.loginByApi('worker.cutting@textileshop.com', 'Worker@123456').then(({ accessToken: workerToken }) => {
              cy.request({
                method: 'PUT',
                url: `${apiUrl}/production/tasks/${taskId}/status`,
                headers: { Authorization: `Bearer ${workerToken}` },
                body: { action: 'start' },
                failOnStatusCode: false,
              }).its('status').should('eq', 409);
            });

            cy.visit('/worker/tasks');
            cy.contains(/task|queue/i, { timeout: 15_000 }).should('exist');
            cy.contains(order.orderNumber).should('not.exist');
          });
        });
      });
    });
  });
});
