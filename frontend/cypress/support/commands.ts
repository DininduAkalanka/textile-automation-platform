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
        Cypress.env('token', accessToken);
        Cypress.env('user', user);
        window.localStorage.setItem('token', accessToken);
        window.localStorage.setItem('user', JSON.stringify(user));
        return cy.setCookie('role', user.role).then(() => {
          return { user, accessToken };
        });
      });
  },
);

Cypress.Commands.add('setSessionUser', (user: any, token: string) => {
  Cypress.env('token', token);
  Cypress.env('user', user);
  window.localStorage.setItem('token', token);
  window.localStorage.setItem('user', JSON.stringify(user));
  cy.setCookie('role', user.role);
});

export {};
