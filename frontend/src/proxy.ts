import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Route gating (plan Session 1.2, task 5).
 *
 * NOTE ON THE NAME: this is `proxy.ts`, not `middleware.ts`. Next.js 16 renamed
 * Middleware to Proxy; a file called `middleware.ts` is simply never invoked, so
 * the gate would silently do nothing while appearing to work.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS NOT A SECURITY BOUNDARY. It is a redirect for user experience only.
 *
 * It reads a `role` cookie that is deliberately NOT httpOnly, so any user can
 * edit it and reach /admin. That is fine and expected: the pages behind it hold
 * no data of their own — every byte they render comes from the API, which
 * enforces the real check with JwtAuthGuard + RolesGuard and answers a forged
 * role with 401/403. Doc 09 §2 calls this Zero Trust: the API is the gate, the
 * client is a hint.
 *
 * What this buys us is that a customer clicking an /admin link gets a clean
 * redirect instead of a page that renders and then fills with permission errors.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ROLE_COOKIE = 'role';

/** Prefix -> roles allowed to see it. */
const GATED: Array<{ prefix: string; allow: string[] }> = [
  { prefix: '/admin', allow: ['ADMIN'] },
  { prefix: '/worker', allow: ['WORKER', 'ADMIN'] },
  { prefix: '/account', allow: ['CUSTOMER', 'ADMIN', 'WORKER'] },
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const gate = GATED.find(
    (g) => pathname === g.prefix || pathname.startsWith(`${g.prefix}/`),
  );
  if (!gate) return NextResponse.next();

  const role = request.cookies.get(ROLE_COOKIE)?.value;

  // Not signed in -> login, remembering where they were headed.
  if (!role) {
    const login = new URL('/login', request.url);
    login.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(login);
  }

  // Signed in as the wrong role -> home. (The API would refuse anyway.)
  if (!gate.allow.includes(role)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Without a matcher this runs on every request including _next/static, which
  // would gate the CSS and JS themselves.
  matcher: ['/admin/:path*', '/worker/:path*', '/account/:path*'],
};
