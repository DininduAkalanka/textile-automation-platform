import './commands';

// Catch uncaught exceptions: only allow benign framework signals like NEXT_REDIRECT
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('NEXT_REDIRECT')) {
    return false;
  }
  return true;
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
