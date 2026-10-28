import { NextResponse, type ProxyConfig, type NextRequest } from 'next/server';

import {
  APP_ROUTES,
  APP_STORAGE_KEYS,
  signInRouteFor
} from './common/constants';
import { isAccessTokenActive } from './lib/access-token';

/**
 * Drawn fresh from a CSPRNG for every response: a nonce an attacker can predict
 * authorizes their script. 16 bytes is the 128-bit floor the CSP spec asks for.
 */
const CSP_NONCE_BYTES = 16;

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * A script runs only if Next.js stamped it with this response's nonce or a
 * stamped script loaded it ('strict-dynamic'), so injected markup cannot run
 * code. Styles keep 'unsafe-inline' because components set style attributes,
 * which a nonce cannot authorize. React's development tooling needs eval.
 */
const contentSecurityPolicyWith = (nonce: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');

const isPubRoute = (pathname: string) =>
  pathname.startsWith(APP_ROUTES.Public.SignIn) ||
  pathname.startsWith(APP_ROUTES.Public.SignUp);

export const proxy = async (req: NextRequest) => {
  const token = req.cookies.get(APP_STORAGE_KEYS.Token)?.value;
  const isAuthenticated = !!token && isAccessTokenActive(token);

  const { pathname, search } = req.nextUrl;

  if (!isPubRoute(pathname) && !isAuthenticated) {
    const signInRoute = signInRouteFor({
      returnPath: `${pathname}${search}`,
      hasSessionExpired: !!token || req.cookies.has(APP_STORAGE_KEYS.Session)
    });
    const res = NextResponse.redirect(new URL(signInRoute, req.url));

    if (token) res.cookies.delete(APP_STORAGE_KEYS.Token);

    return res;
  }

  if (isPubRoute(pathname) && isAuthenticated)
    return NextResponse.redirect(
      new URL(APP_ROUTES.Protected.Overview, req.url)
    );

  const nonce = Buffer.from(
    crypto.getRandomValues(new Uint8Array(CSP_NONCE_BYTES))
  ).toString('base64');
  const contentSecurityPolicy = contentSecurityPolicyWith(nonce);

  // Next.js reads the nonce from the request's policy while rendering.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', contentSecurityPolicy);

  return res;
};

export const config: ProxyConfig = {
  matcher: [
    '/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.jpeg$|.*\\.ico$|.*\\.gif$|sitemap.xml|robots.txt).*)'
  ]
};
