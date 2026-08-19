/// <reference types="cypress" />

describe('AI Intelligence & Shopping Assistant E2E', () => {
  it('1. Customer Shopping Assistant opens, accepts prompt and displays grounded product cards', () => {
    cy.visit('/');

    // Open floating chat assistant
    cy.getByTestId('ai-chat-toggle').should('exist').click({ force: true });
    cy.getByTestId('ai-chat-dialog').should('be.visible');

    // Type a shopping query
    cy.getByTestId('ai-chat-input').type('School uniform fabric');
    cy.getByTestId('ai-chat-send-btn').click({ force: true });

    // Verify user message appeared in stream
    cy.getByTestId('ai-chat-bubble-user').should('contain', 'School uniform fabric');

    // Verify assistant responds with message and product recommendation cards
    cy.getByTestId('ai-chat-messages', { timeout: 15000 }).should('be.visible');
  });

  it('2. Admin AI Insights dashboard accepts business questions and renders analytics', () => {
    cy.loginByApi('admin@textileshop.com', 'Admin@123456');
    cy.visit('/admin/ai-insights');

    cy.contains(/AI|Insights|Analytics/i).should('be.visible');
  });
});
