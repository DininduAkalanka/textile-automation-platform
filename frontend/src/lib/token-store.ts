/**
 * Access-token store with memory cache and localStorage fallback.
 *
 * Provides instant in-memory retrieval while persisting across page reloads
 * and automated testing environments (Cypress / CI).
 */

let _token: string | null = null;

/** Read the access token. Checks in-memory cache, then localStorage fallback. */
export function getToken(): string | null {
  if (!_token && typeof window !== 'undefined') {
    return window.localStorage.getItem('token');
  }
  return _token;
}

/** Store the access token in memory and localStorage. */
export function setToken(token: string): void {
  _token = token;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('token', token);
  }
}

/** Clear the access token from memory and localStorage. */
export function clearToken(): void {
  _token = null;
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('token');
  }
}
