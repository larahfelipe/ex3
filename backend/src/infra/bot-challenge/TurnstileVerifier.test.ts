import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { LogEntry } from '@/infra/observability';

import {
  ChallengeVerdicts,
  TURNSTILE_TOKEN_MAX_LENGTH,
  TurnstileVerifier
} from './TurnstileVerifier';

const SECRET_KEY = 'turnstile-secret-key-for-tests';
const TOKEN = 'solved-turnstile-token';
const ACTION = 'sign-in';
const OTHER_ACTION = 'sign-up';
const HOSTNAME = 'ex3.app';
const OTHER_HOSTNAME = 'attacker.example';
const REMOTE_ADDRESS = '192.0.2.10';
const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type SiteverifyCall = { url: string; init: RequestInit };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const solved = (overrides: Record<string, unknown> = {}) =>
  json({
    success: true,
    'error-codes': [],
    hostname: HOSTNAME,
    action: ACTION,
    ...overrides
  });

const failed = (...errorCodes: string[]) =>
  json({ success: false, 'error-codes': errorCodes });

const verifierAnswering = (
  answer: () => Promise<Response>,
  options: Partial<TurnstileVerifier.Options> = {}
) => {
  const calls: SiteverifyCall[] = [];
  const entries: LogEntry[] = [];
  const verifier = new TurnstileVerifier({
    secretKey: SECRET_KEY,
    checksSolvedContext: true,
    expectedHostnames: [HOSTNAME],
    fetchResponse: async (input, init = {}) => {
      calls.push({
        url: input instanceof Request ? input.url : input.toString(),
        init
      });

      return answer();
    },
    logEntry: (entry) => entries.push(entry),
    ...options
  });

  const verify = (token = TOKEN, action = ACTION) =>
    verifier.verify({ token, action, remoteAddress: REMOTE_ADDRESS });

  return { verifier, verify, calls, entries };
};

describe('Turnstile verifier', () => {
  it('passes a token Cloudflare confirms was solved here, for the action', async () => {
    const { verify } = verifierAnswering(async () => solved());

    assert.equal(await verify(), ChallengeVerdicts.PASSED);
  });

  it('sends the secret, the token and the client address to siteverify alone', async () => {
    const { verify, calls } = verifierAnswering(async () => solved());

    await verify();

    assert.equal(calls.length, 1);
    const [{ url, init }] = calls as [SiteverifyCall];

    assert.ok(typeof init.body === 'string');
    const body = JSON.parse(init.body) as Record<string, string>;

    assert.equal(url, SITEVERIFY_URL);
    assert.equal(init.method, 'POST');
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(body.secret, SECRET_KEY);
    assert.equal(body.response, TOKEN);
    assert.equal(body.remoteip, REMOTE_ADDRESS);
    assert.match(body.idempotency_key ?? '', /^[0-9a-f-]{36}$/);
  });

  it('refuses a token solved for another action', async () => {
    const { verify } = verifierAnswering(async () => solved());

    assert.equal(await verify(TOKEN, OTHER_ACTION), ChallengeVerdicts.REFUSED);
  });

  it('refuses a token solved on another site', async () => {
    const { verify } = verifierAnswering(async () =>
      solved({ hostname: OTHER_HOSTNAME })
    );

    assert.equal(await verify(), ChallengeVerdicts.REFUSED);
  });

  it('refuses a token Cloudflare already answered once', async () => {
    const { verify, entries } = verifierAnswering(async () =>
      failed('timeout-or-duplicate')
    );

    assert.equal(await verify(), ChallengeVerdicts.REFUSED);
    assert.deepEqual(entries, []);
  });

  it('refuses a token Cloudflare did not issue', async () => {
    const { verify } = verifierAnswering(async () =>
      failed('invalid-input-response')
    );

    assert.equal(await verify(), ChallengeVerdicts.REFUSED);
  });

  for (const [description, token] of [
    ['a missing token', ''],
    [
      'a token longer than any Cloudflare issues',
      'x'.repeat(TURNSTILE_TOKEN_MAX_LENGTH + 1)
    ]
  ] as const)
    it(`refuses ${description} without asking Cloudflare`, async () => {
      const { verify, calls } = verifierAnswering(async () => solved());

      assert.equal(await verify(token), ChallengeVerdicts.REFUSED);
      assert.equal(calls.length, 0);
    });

  const unanswered = {
    'Cloudflare cannot be reached': () =>
      Promise.reject(new TypeError('fetch failed')),
    'siteverify times out': () =>
      Promise.reject(
        new DOMException(
          'The operation was aborted due to timeout',
          'TimeoutError'
        )
      ),
    'siteverify answers an error status': async () =>
      json({ success: false }, 500),
    'siteverify answers a body that is not its own': async () =>
      new Response('<html>gateway</html>', { status: 200 }),
    'Cloudflare rejects the secret': async () => failed('invalid-input-secret'),
    'Cloudflare fails internally': async () => failed('internal-error')
  };

  for (const [description, answer] of Object.entries(unanswered))
    it(`reports the check unavailable, never passed, when ${description}`, async () => {
      const { verify, entries } = verifierAnswering(answer);

      assert.equal(await verify(), ChallengeVerdicts.UNAVAILABLE);
      assert.partialDeepStrictEqual(entries, [
        { severity: 'ERROR', event: 'bot_challenge_unavailable' }
      ]);
    });

  it('never writes the secret or the token to the log', async () => {
    const { verify, entries } = verifierAnswering(async () =>
      failed('invalid-input-secret', 'invalid-input-response')
    );

    await verify();

    const logged = JSON.stringify(entries);

    assert.ok(entries.length > 0);
    assert.ok(!logged.includes(SECRET_KEY));
    assert.ok(!logged.includes(TOKEN));
  });

  it('accepts any action and site under a test secret, which answers fixed ones', async () => {
    const { verify } = verifierAnswering(
      async () => solved({ action: 'test', hostname: 'example.com' }),
      { checksSolvedContext: false }
    );

    assert.equal(await verify(), ChallengeVerdicts.PASSED);
  });

  it('accepts any site while no web origin is configured', async () => {
    const { verify } = verifierAnswering(
      async () => solved({ hostname: OTHER_HOSTNAME }),
      { expectedHostnames: [] }
    );

    assert.equal(await verify(), ChallengeVerdicts.PASSED);
  });

  it('enforces nothing without a secret, and verifies nothing either', async () => {
    const { verifier, verify, calls } = verifierAnswering(
      async () => solved(),
      { secretKey: undefined }
    );

    assert.equal(verifier.isEnforced, false);
    assert.equal(await verify(), ChallengeVerdicts.UNAVAILABLE);
    assert.equal(calls.length, 0);
  });
});
