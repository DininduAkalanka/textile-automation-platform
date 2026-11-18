import './commands';

// Catch uncaught exceptions: only allow benign framework signals like NEXT_REDIRECT and hydration mismatch warnings in dev mode
Cypress.on('uncaught:exception', (err) => {
  if (
    err.message.includes('NEXT_REDIRECT') ||
    err.message.includes('hydration') ||
    err.message.includes('Hydration') ||
    err.message.includes('Minified React error')
  ) {
    return false;
  }
  return true;
});

// Guard against leaking any test traffic to live production onrender.com
beforeEach(() => {
  cy.intercept('*', (req) => {
    if (req.url.includes('onrender.com')) {
      req.destroy();
      throw new Error(`SAFETY VIOLATION: Request attempted to live production domain: ${req.url}`);
    }
  });
});

// Hydrate test token and user profile into AUT window.localStorage on every page navigation
Cypress.on('window:before:load', (win) => {
  const token = Cypress.env('token');
  const user = Cypress.env('user');
  if (token) {
    win.localStorage.setItem('token', token);
  } else {
    win.localStorage.removeItem('token');
  }
  if (user) {
    win.localStorage.setItem(
      'user',
      typeof user === 'string' ? user : JSON.stringify(user),
    );
  } else {
    win.localStorage.removeItem('user');
  }
});
