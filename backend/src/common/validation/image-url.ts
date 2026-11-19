/**
 * What an image reference in the catalogue may look like: a full web address
 * (https://…, e.g. an upload or a CDN) or a path on this site ("/images/…",
 * "/uploads/…").
 *
 * Without this, any text was accepted — the live "shorts" category was saved
 * with the image "abcd", which every storefront page then requested as
 * /abcd and got a 404.
 */
export const IMAGE_URL_PATTERN = /^(https?:\/\/\S+|\/\S*)$/i;

export const IMAGE_URL_MESSAGE =
  'must be a full web address (https://…) or a site path starting with "/"';
