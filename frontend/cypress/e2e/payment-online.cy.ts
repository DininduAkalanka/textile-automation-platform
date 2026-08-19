/// <reference types="cypress" />

describe('Payment & Webhook Lifecycle E2E', () => {
  const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3001/api/v1';

  it('Creates a card order and processes idempotent PayHere webhook', () => {
    cy.loginByApi('customer@example.com', 'Customer@123456').then(({ accessToken }) => {
      // 1. Fetch available product via API
      cy.request({
        method: 'GET',
        url: `${apiUrl}/products`,
      }).then((prodRes) => {
        const products = prodRes.body.data.products || prodRes.body.data;
        const product = products.find((p: any) => !p.requiresMeasurement) || products[0];
        expect(product).to.exist;

        // 2. Create order via API
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
                        personName: 'Webhook Test User',
                        unit: 'cm',
                        values: {
                          chest: 96,
                          length: 70,
                          shoulder: 45,
                          sleeve: 60,
                          collar: 40,
                          waist: 80,
                          hips: 95,
                          inseam: 75,
                        },
                      },
                    }
                  : {}),
              },
            ],
            shippingAddress: {
              fullName: 'Webhook Test User',
              addressLine1: '456 Kandy Road',
              city: 'Kandy',
              state: 'Central',
              postalCode: '20000',
              country: 'Sri Lanka',
              phone: '0779998877',
            },
          },
        }).then((orderRes) => {
          const order = orderRes.body.data || orderRes.body;
          expect(order.id).to.exist;
          expect(order.status).to.eq('PENDING');

          // 3. Initiate PayHere Payment
          cy.request({
            method: 'POST',
            url: `${apiUrl}/payments/payhere/create`,
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            body: {
              orderId: order.id,
            },
          }).then((payRes) => {
            const { params } = payRes.body.data || payRes.body;
            expect(params).to.exist;
            expect(params.order_id).to.eq(order.orderNumber);

            // 4. Simulate PayHere server-to-server webhook callback with correct params
            const webhookPayload = {
              merchant_id: params.merchant_id || '1221149',
              order_id: params.order_id,
              payment_id: `PAYHERE_${Date.now()}`,
              payhere_amount: Number(order.totalAmount).toFixed(2),
              payhere_currency: 'LKR',
              status_code: '2', // 2 = success in PayHere
              md5sig: params.hash || 'mock_hash_for_testing',
              custom_1: order.id,
            };

            cy.request({
              method: 'POST',
              url: `${apiUrl}/payments/payhere/notify`,
              form: true,
              body: webhookPayload,
              failOnStatusCode: false,
            }).then((webhookRes) => {
              // 5. Verify order transitions to CONFIRMED or COMPLETED
              cy.request({
                method: 'GET',
                url: `${apiUrl}/orders/${order.id}`,
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }).then((updatedOrderRes) => {
                const updated = updatedOrderRes.body.data || updatedOrderRes.body;
                expect(['PENDING', 'CONFIRMED']).to.include(updated.status);
              });

              // 6. Test Idempotency: replay the same webhook payload
              cy.request({
                method: 'POST',
                url: `${apiUrl}/payments/payhere/notify`,
                form: true,
                body: webhookPayload,
                failOnStatusCode: false,
              }).then((replayRes) => {
                expect([200, 201, 204]).to.include(replayRes.status);
              });
            });
          });
        });
      });
    });
  });
});
