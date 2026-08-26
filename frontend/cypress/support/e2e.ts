import './commands';

// Catch uncaught exceptions gracefully without failing tests unless they originate from the test runner
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false to prevent Cypress from failing the test on unhandled React/Next hydration warnings.
  // In development builds the message says "Hydration"; in production builds React minifies it to
  // "Minified React error #418" (text-content mismatch) or "#423" (tag mismatch).
  if (
    err.message.includes('NEXT_REDIRECT') ||
    err.message.includes('Hydration') ||
    err.message.includes('Minified React error #418') ||
    err.message.includes('Minified React error #423')
  ) {
    return false;
  }
  return true;
});
