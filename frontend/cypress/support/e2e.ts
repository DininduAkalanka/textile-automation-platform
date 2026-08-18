import './commands';

// Catch uncaught exceptions gracefully without failing tests unless they originate from the test runner
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false to prevent Cypress from failing the test on unhandled React/Next hydration warnings
  if (err.message.includes('NEXT_REDIRECT') || err.message.includes('Hydration')) {
    return false;
  }
  return true;
});
