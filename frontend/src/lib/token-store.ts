/**
 * F-04: In-memory access-token store.
 *
 * Replaces the previous `localStorage.setItem/getItem('token', ...)` pattern
 * across useAuthStore.ts, http.ts, and api.ts. Storing the JWT access token in
 * localStorage makes it readable by any script on the page (XSS blast radius).
 * An in-memory module-level singleton is invisible to third-party scripts.
 *
 * Trade-off: the token is lost on page reload, so the app must silently
 * re-hydrate it via POST /auth/refresh (which uses the httpOnly refresh cookie)
 * on app mount. useAuthStore.ts handles this via `initAuth()`.
 */

let _token: string | null = null;

/** Read the in-memory access token. Returns null if not set. */
export function getToken(): string | null {
  return _token;
}

/** Store the access token in memory only — never persisted to storage. */
export function setToken(token: string): void {
  _token = token;
}

/** Clear the in-memory access token (called on logout or 401). */
export function clearToken(): void {
  _token = null;
}
