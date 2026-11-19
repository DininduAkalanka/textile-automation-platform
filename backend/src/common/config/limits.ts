/**
 * Abuse limits added by the QA remediation (P0-2, P1-4, P1-8).
 *
 * Every limit can be overridden with an environment variable. The defaults are
 * production values. Under NODE_ENV=test the ORDER caps relax (the same
 * convention the throttler already uses) because the integration and browser
 * suites deliberately create many unpaid orders for one seeded customer; the
 * regression tests set the variables explicitly to exercise the real caps.
 *
 * Read lazily (functions, not constants) wherever a test needs to change a
 * value at runtime. Decorator arguments (DTO @Max, @Throttle) are evaluated
 * once at import, so those use the *_AT_LOAD constants.
 */

const isTest = () => process.env.NODE_ENV === 'test';

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

// ─── P0-2: unpaid reservations ──────────────────────────────────────────────

/** How long an unpaid order holds its stock before it is auto-cancelled. */
export const reservationTtlMinutes = () =>
  intFromEnv('ORDER_RESERVATION_TTL_MINUTES', 30);

/** How often the expiry sweep runs. */
export const expirySweepIntervalMs = () =>
  intFromEnv('ORDER_EXPIRY_SWEEP_INTERVAL_MS', 60_000);

/** The sweep is on everywhere except the Jest suites, which build many app instances. */
export const expirySweepEnabled = () => {
  const raw = process.env.ORDER_EXPIRY_SWEEP_ENABLED;
  if (raw !== undefined && raw.trim() !== '') return raw === 'true';
  return !isTest();
};

/** Most unpaid (PENDING, unexpired) orders one account may hold at once. */
export const maxOpenPendingPerUser = () =>
  intFromEnv('MAX_OPEN_PENDING_ORDERS_PER_USER', isTest() ? 1000 : 3);

/** Most unpaid guest orders one IP address may hold at once. */
export const maxOpenGuestOrdersPerIp = () =>
  intFromEnv('MAX_OPEN_GUEST_ORDERS_PER_IP', isTest() ? 1000 : 3);

/** Largest quantity of one product on one order line (bulk orders: contact the shop). */
export const MAX_QTY_PER_LINE_AT_LOAD = intFromEnv('MAX_QTY_PER_LINE', 20);

/** Most lines on one order. */
export const MAX_LINES_PER_ORDER_AT_LOAD = intFromEnv(
  'MAX_LINES_PER_ORDER',
  30,
);

/** Guest checkout + guest code requests per IP per minute. */
export const GUEST_CHECKOUT_THROTTLE_AT_LOAD = intFromEnv(
  'GUEST_CHECKOUT_THROTTLE_LIMIT',
  10,
);

// ─── P2-15: customer review photos ──────────────────────────────────────────

/** Review photos one customer may upload in any rolling 24 hours. */
export const reviewUploadsPerDay = () =>
  intFromEnv('REVIEW_UPLOADS_PER_DAY', 20);

/** Review-photo upload requests per user/IP per minute. */
export const REVIEW_UPLOAD_THROTTLE_AT_LOAD = intFromEnv(
  'REVIEW_UPLOAD_THROTTLE_LIMIT',
  10,
);

/** A review photo never attached to a review is deleted after this long. */
export const orphanUploadTtlHours = () =>
  intFromEnv('ORPHAN_UPLOAD_TTL_HOURS', 24);

/** How often the orphan-photo cleanup runs. */
export const uploadCleanupIntervalMs = () =>
  intFromEnv('UPLOAD_CLEANUP_INTERVAL_MS', 60 * 60 * 1000);

/** The cleanup is on everywhere except the Jest suites (same rule as the expiry sweep). */
export const uploadCleanupEnabled = () => {
  const raw = process.env.UPLOAD_CLEANUP_ENABLED;
  if (raw !== undefined && raw.trim() !== '') return raw === 'true';
  return !isTest();
};

// ─── P1-4: credential stuffing ──────────────────────────────────────────────

/** Wrong passwords in a row before an account is temporarily locked. */
export const loginMaxFailures = () => intFromEnv('LOGIN_MAX_FAILURES', 5);

/** How long that lock lasts. */
export const loginLockMinutes = () => intFromEnv('LOGIN_LOCK_MINUTES', 15);

/**
 * How many reverse-proxy hops to trust for the client IP (X-Forwarded-For).
 *
 * 0 means "trust none": req.ip is the socket address and a client-supplied
 * X-Forwarded-For header is ignored. That is the only safe value when the API
 * is exposed directly (docker-compose / a bare VPS). Render puts exactly one
 * proxy in front of the app and sets RENDER=true, so that platform gets 1.
 * Anywhere else, set TRUST_PROXY_HOPS to the real number of proxies.
 */
export function trustProxyHops(): number {
  const raw = process.env.TRUST_PROXY_HOPS;
  if (raw !== undefined && raw.trim() !== '')
    return intFromEnv('TRUST_PROXY_HOPS', 0);
  return process.env.RENDER ? 1 : 0;
}
