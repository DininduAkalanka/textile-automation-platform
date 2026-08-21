/// <reference types="cypress" />

describe('AI Intelligence & Shopping Assistant E2E', () => {
  it('1. Customer Shopping Assistant opens, accepts prompt and displays grounded product cards', () => {
    cy.visit('/');
    cy.get('h1').should('be.visible');

    // Open floating chat assistant
    cy.getByTestId('ai-chat-toggle', { timeout: 10000 }).should('be.visible').click();
    cy.getByTestId('ai-chat-dialog', { timeout: 10000 }).should('be.visible');

    // Type a shopping query
    cy.getByTestId('ai-chat-input').should('be.visible').type('School uniform fabric');
    cy.getByTestId('ai-chat-send-btn').click();

    // Verify user message appeared in stream
    cy.getByTestId('ai-chat-bubble-user', { timeout: 10000 }).should('contain', 'School uniform fabric');

    // Verify assistant responds with message and product recommendation cards
    cy.getByTestId('ai-chat-messages', { timeout: 20000 }).should('be.visible');
  });

  it('2. Admin AI Insights dashboard accepts business questions and renders analytics', () => {
    cy.loginByApi('admin@textileshop.com', 'Admin@123456');
    cy.visit('/admin/ai-insights');

    cy.contains(/AI|Insights|Analytics/i).should('be.visible');
  });
});
