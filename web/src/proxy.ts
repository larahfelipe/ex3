import { NextResponse, type NextRequest, type ProxyConfig } from 'next/server';

import {
  APP_ROUTES,
  APP_STORAGE_KEYS,
  COOKIE_OPTIONS,
  CSRF_HEADER,
  NONCE_HEADER,
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
 * Sonner adds its stylesheet as a `<style>` it cannot stamp with a nonce, so the
 * policy names that one stylesheet by its hash. The proxy's test recomputes it
 * from the installed package, so an upgrade that changes the CSS fails there.
 */
export const TOASTER_STYLESHEET_HASH =
  "'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY='";

const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/**
 * A script runs only if Next.js stamped it with this response's nonce or a
 * stamped script loaded it ('strict-dynamic'), so injected markup cannot run
 * code. A `<style>` element needs the nonce too, or to be the toaster's, so
 * injected markup cannot restyle the page or read it back through selectors.
 * Style attributes stay allowed: components size bars and charts from data,
 * which neither a nonce nor a hash can authorize. A browser too old for the
 * `-elem` and `-attr` directives falls back to `style-src`. React's and
 * Next.js's development tooling needs eval and inline styles.
 */
const contentSecurityPolicyWith = (nonce: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE_ORIGIN}${isDevelopment ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    isDevelopment
      ? "style-src-elem 'self' 'unsafe-inline'"
      : `style-src-elem 'self' 'nonce-${nonce}' ${TOASTER_STYLESHEET_HASH}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${TURNSTILE_ORIGIN}`,
    "worker-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');

const isPubRoute = (pathname: string) =>
  pathname.startsWith(APP_ROUTES.Public.SignIn) ||
  pathname.startsWith(APP_ROUTES.Public.SignUp);

const API_PATH_PREFIX = '/api/';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The session cookie's `SameSite=Strict` keeps it off cross-site requests, but
 * not off a sibling subdomain's, which is the same site, and signing in or up
 * needs no session: a form on another site could post an attacker's
 * credentials and leave the visitor signed in to the attacker's account. So
 * every write, signing out included, must carry the header only the app sends,
 * and must not be one the browser says came from elsewhere.
 */
export const isCrossSiteWrite = (req: NextRequest) => {
  if (SAFE_METHODS.has(req.method)) return false;

  const fetchSite = req.headers.get('sec-fetch-site');

  return (
    (fetchSite !== null && fetchSite !== 'same-origin') ||
    req.headers.get(CSRF_HEADER.Name) !== CSRF_HEADER.Value
  );
};

const API_RESPONSE_HEADERS = { 'Cache-Control': 'no-store' };

export const proxy = (req: NextRequest) => {
  if (req.nextUrl.pathname.startsWith(API_PATH_PREFIX))
    return isCrossSiteWrite(req)
      ? NextResponse.json(
          { message: 'Cross-site request refused', _error: null },
          {
            status: 403,
            statusText: 'Forbidden',
            headers: API_RESPONSE_HEADERS
          }
        )
      : NextResponse.next({ headers: API_RESPONSE_HEADERS });

  const token = req.cookies.get(APP_STORAGE_KEYS.Token)?.value;
  const isAuthenticated = !!token && isAccessTokenActive(token);

  const { pathname, search } = req.nextUrl;

  if (!isPubRoute(pathname) && !isAuthenticated) {
    const signInRoute = signInRouteFor({
      returnPath: `${pathname}${search}`,
      hasSessionExpired: !!token || req.cookies.has(APP_STORAGE_KEYS.Session)
    });
    const res = NextResponse.redirect(new URL(signInRoute, req.url));

    if (token)
      res.cookies.delete({ ...COOKIE_OPTIONS, name: APP_STORAGE_KEYS.Token });

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

  // Next.js reads the nonce from the request's policy while rendering, and
  // the layout hands it to the components that add their own styles.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);
  requestHeaders.set(NONCE_HEADER, nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', contentSecurityPolicy);

  return res;
};

export const config: ProxyConfig = {
  matcher: [
    '/api/:path*',
    '/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.jpeg$|.*\\.ico$|.*\\.gif$|sitemap.xml|robots.txt).*)'
  ]
};
