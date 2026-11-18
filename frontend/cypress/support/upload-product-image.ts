/// <reference types="cypress" />

/** Observe the browser's completed upload without sending its binary request body through cy.intercept. */
export function uploadProductImage(fileName: string) {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const apiUrl = Cypress.env('apiUrl') as string;

  cy.window().then((win) => {
    const sends = cy.spy(win.XMLHttpRequest.prototype, 'send');
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from(png, 'base64'),
      fileName,
      mimeType: 'image/png',
    }, { force: true }); // The visible picker delegates to a hidden native input.

    cy.wrap(sends, { log: false }).should((spy) => {
      const upload: XMLHttpRequest | undefined = spy.thisValues.find((xhr: XMLHttpRequest) =>
        xhr.readyState === win.XMLHttpRequest.DONE && xhr.responseURL === apiUrl + '/admin/uploads/image',
      );
      if (!upload) throw new Error('Waiting for the admin image upload to finish');
      expect(upload.status, 'upload response status').to.be.oneOf([200, 201]);
      const body = upload.responseType === 'json' ? upload.response : JSON.parse(upload.responseText);
      expect(body.data.url, 'uploaded image URL').to.include('/uploads/');
    });
  });
}
