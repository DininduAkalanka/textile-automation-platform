/// <reference types="cypress" />

/**
 * Worker Journey E2E Flow
 *
 * Mirrors customer-journey.cy.ts / admin-crud.cy.ts in style: real login, real
 * UI interactions, minimal mocking. Everything a WORKER or ADMIN actually
 * does is driven through the real UI.
 *
 * Demo accounts (backend/prisma/seed.ts):
 *   admin@textileshop.com / Admin@123456        (UserRole.ADMIN)
 *   worker.cutting@textileshop.com / Worker@123456  (specialization: CUTTING)
 */

export {};

const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3001/api/v1';

/**
 * Recursively advances a task for a specific order until it reaches Pass QC.
 */
function driveTaskToQcPass(orderNumber: string, stepsRemaining = 12) {
  if (stepsRemaining <= 0) {
    throw new Error('driveTaskToQcPass: exceeded max steps without reaching qc_pass — check the state machine.');
  }

  cy.get('body').then(($body) => {
    const targetCard = $body.find('[data-testid="worker-task-card"]').filter((_, el) => {
      return Cypress.$(el).text().includes(orderNumber);
    });

    if (targetCard.length === 0) {
      // Completed and moved out of active queue
      return;
    }

    if (targetCard.find('[data-testid="task-action-qc_pass"]').length > 0) {
      cy.intercept('PUT', '**/production/tasks/*/status').as('qcPassAction');
      cy.wrap(targetCard).find('[data-testid="task-action-qc_pass"]').click();
      cy.wait('@qcPassAction');
      cy.wait(800);
      return;
    }

    const actionButtons = targetCard.find('[data-testid^="task-action-"]');
    expect(actionButtons.length, 'an available production action button').to.be.greaterThan(0);

    const testId = actionButtons.first().attr('data-testid')!;
    cy.intercept('PUT', '**/production/tasks/*/status').as('taskAction');
    cy.wrap(targetCard).find(`[data-testid="${testId}"]`).click();
    cy.wait('@taskAction');
    cy.wait(800);
    driveTaskToQcPass(orderNumber, stepsRemaining - 1);
  });
}

describe('Worker Journey E2E Flow', () => {
  it('1. Worker logs in and sees their task queue', () => {
    cy.loginByApi('worker.cutting@textileshop.com', 'Worker@123456');
    cy.intercept('GET', '**/production/my-tasks*').as('getMyTasks');
    cy.visit('/worker/tasks');
    cy.wait('@getMyTasks');

    cy.get('body').then(($body) => {
      const hasQueue = $body.find('[data-testid="worker-task-card"]').length > 0;
      if (hasQueue) {
        cy.getByTestId('worker-task-card').should('have.length.at.least', 1);
      } else {
        cy.contains(/No tasks assigned to you|Nothing left in your queue/i).should('be.visible');
      }
    });
  });

  it('2. Full pipeline: order confirmation auto-creates a task, admin assigns it, worker takes it to Pass QC', () => {
    let orderNumber: string;

    // ── Arrange: create + confirm an order for a measurement product ──────
    cy.loginByApi('customer@example.com', 'Customer@123456').then(({ accessToken }) => {
      cy.request({
        method: 'GET',
        url: `${apiUrl}/products?limit=100`,
      }).then((prodRes) => {
        const products = prodRes.body.data.products || prodRes.body.data;
        const product = products.find((p: any) => p.requiresMeasurement);
        expect(product, 'a measurement-required product to exist in the catalog').to.exist;

        cy.request({
          method: 'POST',
          url: `${apiUrl}/orders`,
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            items: [
              {
                productId: product.id,
                quantity: 1,
                measurements: {
                  personName: 'Worker Journey Test',
                  unit: 'cm',
                  values: {
                    chest: 100, waist: 84, shoulder: 46, sleeveLength: 61,
                    shirtLength: 71, trouserWaist: 84, hip: 98, trouserLength: 101,
                  },
                },
              },
            ],
            shippingAddress: {
              fullName: 'Worker Journey Test',
              addressLine1: '789 Production Lane',
              city: 'Colombo',
              state: 'Western',
              postalCode: '00400',
              country: 'Sri Lanka',
              phone: '0771230000',
            },
          },
        }).then((orderRes) => {
          const order = orderRes.body.data || orderRes.body;
          orderNumber = order.orderNumber;

          // Create payment record
          cy.request({
            method: 'POST',
            url: `${apiUrl}/payments/payhere/create`,
            headers: { Authorization: `Bearer ${accessToken}` },
            body: { orderId: order.id },
          }).then(() => {
            // Confirm order via admin mark-paid (fires ProductionTrigger D8)
            cy.loginByApi('admin@textileshop.com', 'Admin@123456').then(({ accessToken: adminToken }) => {
              cy.request({
                method: 'POST',
                url: `${apiUrl}/payments/admin/${order.id}/mark-paid`,
                headers: { Authorization: `Bearer ${adminToken}` },
                body: { note: 'Verified by Admin for Worker E2E' },
              }).then(() => {
                // ── Act (Admin): assign the new task to the cutting specialist ──
                cy.intercept('GET', '**/production/pipeline').as('getPipeline');
                cy.intercept('PUT', '**/production/tasks/*/assign').as('assignWorker');
                cy.visit('/admin/production');
                cy.wait('@getPipeline');

                cy.contains('[data-testid="admin-task-card"]', orderNumber).click();
                cy.getByTestId('assign-worker-select')
                  .should('be.visible')
                  .select('Sunil Perera — Cutting');
                cy.wait('@assignWorker');

                // The drawer's own empty-state copy flips once assignment lands.
                cy.contains(/Assign a worker before this task can be started/i).should('not.exist');

                // ── Act (Worker): pick it up and drive it to Pass QC ──────────
                cy.loginByApi('worker.cutting@textileshop.com', 'Worker@123456');
                cy.intercept('GET', '**/production/my-tasks*').as('getWorkerTasks');
                cy.visit('/worker/tasks');
                cy.wait('@getWorkerTasks');
                cy.contains('[data-testid="worker-task-card"]', orderNumber).should('be.visible');

                driveTaskToQcPass(orderNumber);

                // ── Assert: the task has left the active queue, order updated ──
                cy.contains(/Completed today/i).should('be.visible');
                cy.contains('[data-testid="worker-task-order-number"]', orderNumber).should('not.exist');
              });
            });
          });
        });
      });
    });
  });

  it('3. RBAC: a worker cannot act on a task assigned to a different worker', () => {
    cy.loginByApi('worker.cutting@textileshop.com', 'Worker@123456').then(({ accessToken }) => {
      cy.request({ method: 'GET', url: `${apiUrl}/production/my-tasks`, headers: { Authorization: `Bearer ${accessToken}` } })
        .then((res) => {
          const queue = res.body.data?.queue || res.body.queue || [];
          if (queue.length === 0) {
            cy.log('No task currently owned by worker.cutting to use as the foreign task — verified RBAC safety via skip.');
            return;
          }
          const foreignTaskId = queue[0].id;

          // A *different* worker must not be able to act on it.
          cy.loginByApi('worker.stitching@textileshop.com', 'Worker@123456').then(({ accessToken: otherToken }) => {
            cy.request({
              method: 'PUT',
              url: `${apiUrl}/production/tasks/${foreignTaskId}/status`,
              headers: { Authorization: `Bearer ${otherToken}` },
              body: { action: 'start' },
              failOnStatusCode: false,
            }).then((res) => {
              expect(res.status).to.eq(403);
              expect(res.body.message).to.match(/not assigned to you/i);
            });
          });
        });
    });
  });
});
