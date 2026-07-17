import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';

/**
 * The single HTTP client (doc 05 §3.5, CODING_STANDARDS §4.1).
 *
 * Components never call this directly — they go through /services (domain
 * functions) and /hooks (TanStack Query). That layering is what keeps API calls
 * out of components (CODING_STANDARDS §6.1).
 *
 * The 401 path is the interesting part. Access tokens live 15 minutes, so an
 * expiry mid-session is normal, not exceptional. When one happens:
 *
 *   - the FIRST 401 triggers POST /auth/refresh, which rotates the httpOnly
 *     refresh cookie and returns a fresh access token;
 *   - every OTHER request that 401s while that refresh is in flight waits on the
 *     SAME promise rather than firing its own refresh. Without this single-flight
 *     guard, a page issuing five parallel queries would fire five refreshes, and
 *     because the backend ROTATES refresh tokens and treats reuse of a revoked
 *     one as theft, four of them would look like an attack and revoke the user's
 *     whole session (see auth.service.ts token-reuse detection).
 *
 * Each request is retried exactly once. A second 401 means the session is truly
 * gone, so we clear it and let the caller redirect.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/** Set by the auth store. Kept out of module state so tests can reset it. */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

function setToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem('token', token);
}

function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem('token');
}

export const http: AxiosInstance = axios.create({
  baseURL: API_URL,
  // Carries the httpOnly refresh cookie. Without this, /auth/refresh has nothing
  // to rotate and every session dies after 15 minutes.
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** The in-flight refresh, shared by every request that 401s while it runs. */
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      // Bare axios, not `http`: going through the instance would re-enter this
      // interceptor on failure and recurse.
      const { data } = await axios.post<{ data?: { accessToken?: string } }>(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      );

      const token = data?.data?.accessToken ?? null;
      if (token) {
        setToken(token);
        return token;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

/** Endpoints where a 401 is the answer, not a stale token. */
const AUTH_ROUTES = ['/auth/login', '/auth/register', '/auth/refresh'];

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;

    const isAuthRoute = AUTH_ROUTES.some((route) =>
      original?.url?.includes(route),
    );

    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !isAuthRoute
    ) {
      original._retried = true;

      const token = await refreshAccessToken();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return http(original);
      }

      // Refresh failed: the session is genuinely over.
      clearToken();
      onSessionExpired?.();
    }

    return Promise.reject(error);
  },
);

/**
 * Unwraps the API envelope { success, message, data, error } down to `data`, and
 * turns a failure into an Error carrying the server's message so react-hook-form
 * and toasts have something human to show.
 */
export async function unwrap<T>(promise: Promise<{ data: unknown }>): Promise<T> {
  try {
    const response = await promise;
    const body = response.data as { data?: T } | T;
    return (body as { data?: T })?.data !== undefined
      ? ((body as { data: T }).data)
      : (body as T);
  } catch (error) {
    const axiosError = error as AxiosError<{
      message?: string | string[];
      error?: { code?: string };
    }>;
    const message = axiosError.response?.data?.message;
    const err = new Error(
      Array.isArray(message)
        ? message[0]
        : (message ?? axiosError.message ?? 'Request failed'),
    ) as Error & { code?: string };
    // Surface the envelope's machine-readable code (e.g. EMAIL_NOT_VERIFIED,
    // OTP_LOCKED) so callers can branch without parsing prose.
    err.code = axiosError.response?.data?.error?.code;
    throw err;
  }
}
