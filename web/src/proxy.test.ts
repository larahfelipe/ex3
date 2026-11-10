import { NextRequest } from 'next/server';

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import { APP_ROUTES, APP_STORAGE_KEYS, CSRF_HEADER } from './common/constants';
import { proxy, TOASTER_STYLESHEET_HASH } from './proxy';

type ApiRequestOptions = {
  path?: string;
  fetchSite?: string;
  isFromApp?: boolean;
};

const apiRequest = (
  method: string,
  {
    path = '/api/v1/sign-in',
    fetchSite,
    isFromApp = true
  }: ApiRequestOptions = {}
) =>
  new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      ...(fetchSite === undefined ? {} : { 'sec-fetch-site': fetchSite }),
      ...(isFromApp ? { [CSRF_HEADER.Name]: CSRF_HEADER.Value } : {})
    }
  });

const REFUSAL = { message: 'Cross-site request refused', _error: null };

describe('the proxy, on an API route', () => {
  it('refuses a write another site sent, such as a form posting credentials', async () => {
    for (const fetchSite of ['cross-site', 'same-site', 'none']) {
      const res = proxy(apiRequest('POST', { fetchSite, isFromApp: false }));

      assert.equal(res.status, 403);
      assert.deepEqual(await res.json(), REFUSAL);
    }

    assert.equal(
      proxy(apiRequest('DELETE', { fetchSite: 'cross-site', isFromApp: false }))
        .status,
      403
    );
  });

  it('refuses a write the browser says came from elsewhere, whatever headers it carries', () => {
    for (const fetchSite of ['cross-site', 'same-site', 'none'])
      assert.equal(proxy(apiRequest('POST', { fetchSite })).status, 403);
  });

  it('refuses a write without the header the app sends, even where the browser does not say where it came from', async () => {
    for (const path of ['/api/v1/sign-in', '/api/v1/sign-out']) {
      const res = proxy(apiRequest('POST', { path, isFromApp: false }));

      assert.equal(res.status, 403);
      assert.deepEqual(await res.json(), REFUSAL);
    }

    assert.equal(
      proxy(
        apiRequest('PATCH', {
          path: '/api/v1/user',
          fetchSite: 'same-origin',
          isFromApp: false
        })
      ).status,
      403
    );
  });

  it('passes a write the app sent, from this origin or from a browser that does not say', () => {
    assert.equal(
      proxy(apiRequest('POST', { fetchSite: 'same-origin' })).status,
      200
    );
    assert.equal(
      proxy(apiRequest('PATCH', { fetchSite: 'same-origin' })).status,
      200
    );
    assert.equal(
      proxy(apiRequest('POST', { path: '/api/v1/sign-out' })).status,
      200
    );
  });

  it('lets no cache keep an answer, whether passed or refused', () => {
    for (const res of [
      proxy(apiRequest('GET')),
      proxy(apiRequest('POST', { fetchSite: 'same-origin' })),
      proxy(apiRequest('POST', { isFromApp: false }))
    ])
      assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  it('passes a read from anywhere, and sets no page policy on it', () => {
    const res = proxy(
      apiRequest('GET', { fetchSite: 'cross-site', isFromApp: false })
    );

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-security-policy'), null);
  });
});

describe('the proxy, on a page', () => {
  it('deletes a token it will not accept with the attributes the token was set with', () => {
    const res = proxy(
      new NextRequest(`http://localhost${APP_ROUTES.Protected.Overview}`, {
        headers: { cookie: `${APP_STORAGE_KEYS.Token}=not-a-token` }
      })
    );
    const setCookie = res.headers.get('set-cookie') ?? '';

    assert.equal(res.status, 307);
    assert.ok(setCookie.startsWith(`${APP_STORAGE_KEYS.Token}=;`));
    for (const attribute of [
      'Path=/',
      'HttpOnly',
      'SameSite=strict',
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    ])
      assert.ok(setCookie.includes(attribute), `${attribute} in ${setCookie}`);
  });
});

/** The CSS sonner adds as a `<style>` when it loads, read from the installed package. */
const toasterStylesheet = () => {
  const source = readFileSync(
    createRequire(import.meta.url).resolve('sonner'),
    'utf8'
  );
  const literal = /__insertCSS\(("(?:[^"\\]|\\.)*")\)/.exec(source)?.[1];

  assert.ok(literal, 'sonner no longer adds its CSS through __insertCSS');

  return JSON.parse(literal) as string;
};

const pagePolicy = () =>
  proxy(
    new NextRequest(`http://localhost${APP_ROUTES.Public.SignIn}`)
  ).headers.get('content-security-policy') ?? '';

const directiveOf = (policy: string, name: string) =>
  policy
    .split('; ')
    .find((directive) => directive.split(' ')[0] === name)
    ?.split(' ')
    .slice(1) ?? [];

describe('the page policy', () => {
  it('names the stylesheet the installed toaster adds by its hash', () => {
    const hash = `'sha256-${createHash('sha256').update(toasterStylesheet()).digest('base64')}'`;

    assert.equal(TOASTER_STYLESHEET_HASH, hash);
    assert.ok(directiveOf(pagePolicy(), 'style-src-elem').includes(hash));
  });

  it('admits a style element only with the nonce, or as the toaster, and a style attribute anywhere', () => {
    const policy = pagePolicy();
    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];

    assert.ok(nonce);
    assert.deepEqual(directiveOf(policy, 'style-src-elem'), [
      "'self'",
      `'nonce-${nonce}'`,
      TOASTER_STYLESHEET_HASH
    ]);
    assert.deepEqual(directiveOf(policy, 'style-src-attr'), [
      "'unsafe-inline'"
    ]);
  });

  it('draws a fresh nonce for every page', () => {
    const nonceOf = (policy: string) => /'nonce-([^']+)'/.exec(policy)?.[1];

    assert.notEqual(nonceOf(pagePolicy()), nonceOf(pagePolicy()));
  });

  it('lets in the Turnstile script and its frame, and nothing else from elsewhere', () => {
    const policy = pagePolicy();
    const turnstile = 'https://challenges.cloudflare.com';
    const origins = policy.match(/https?:\/\/[^\s;]+/g) ?? [];

    assert.ok(directiveOf(policy, 'script-src').includes(turnstile));
    assert.deepEqual(directiveOf(policy, 'frame-src'), [turnstile]);
    assert.deepEqual([...new Set(origins)], [turnstile]);
    assert.deepEqual(directiveOf(policy, 'connect-src'), ["'self'"]);
    assert.deepEqual(directiveOf(policy, 'object-src'), ["'none'"]);
    assert.deepEqual(directiveOf(policy, 'base-uri'), ["'none'"]);
    assert.deepEqual(directiveOf(policy, 'frame-ancestors'), ["'none'"]);
  });
});
