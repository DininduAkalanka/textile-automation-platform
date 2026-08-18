/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /** Get DOM element by data-testid attribute */
      getByTestId(testId: string, options?: Partial<Cypress.Timeoutable>): Chainable<JQuery<HTMLElement>>;
      /** Programmatic login via API to bypass UI for test efficiency when testing non-auth flows */
      loginByApi(email?: string, password?: string): Chainable<any>;
      /** Set up auth state in localStorage directly */
      setSessionUser(user: any, token: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add('getByTestId', (testId: string, options?: Partial<Cypress.Timeoutable>) => {
  return cy.get(`[data-testid="${testId}"]`, options);
});

Cypress.Commands.add(
  'loginByApi',
  (email = 'customer@example.com', password = 'Customer@123456') => {
    const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3001/api/v1';
    return cy
      .request({
        method: 'POST',
        url: `${apiUrl}/auth/login`,
        body: {
          identifier: email,
          password,
        },
      })
      .then((response) => {
        const { user, accessToken } = response.body.data || response.body;
        // Sync with zustand store in localStorage
        window.localStorage.setItem(
          'auth-storage',
          JSON.stringify({
            state: {
              user,
              accessToken,
              isAuthenticated: true,
            },
            version: 0,
          }),
        );
        return { user, accessToken };
      });
  },
);

Cypress.Commands.add('setSessionUser', (user: any, token: string) => {
  window.localStorage.setItem(
    'auth-storage',
    JSON.stringify({
      state: {
        user,
        accessToken: token,
        isAuthenticated: true,
      },
      version: 0,
    }),
  );
});

export {};
