import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';

import {
  BotChallenge,
  envs,
  Errors,
  ProxyHeaders,
  RateLimits,
  UserMessages
} from '@/config';
import { TurnstileVerifier } from '@/infra/bot-challenge';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { apiRequest, isAccountRateLimited } from '@/test/ApiClient';
import { createUser, FIXTURE_PASSWORD } from '@/test/Fixtures';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';

const SIGN_UP_ROUTE = '/v1/user/create';
const SIGN_IN_ROUTE = '/v1/user';
const SOLVED_TOKEN = 'solved-turnstile-token';
const WEB_HOSTNAME = 'ex3.app';
const CLIENT_ADDRESS = '192.0.2.10';
const OTHER_ADDRESS = '203.0.113.10';

const NEW_USER = {
  firstName: 'Maria Clara',
  email: 'newcomer@ex3.app',
  password: 'onboarding-password',
  baseCurrency: 'USD'
};

type Siteverify = (body: Record<string, string>) => Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const solvedFor = (action: string) => async () =>
  json({ success: true, hostname: WEB_HOSTNAME, action });

const answeringOnce = (action: string): Siteverify => {
  const spent = new Set<string>();

  return async ({ response = '' }) => {
    if (spent.has(response))
      return json({ success: false, 'error-codes': ['timeout-or-duplicate'] });

    spent.add(response);

    return json({ success: true, hostname: WEB_HOSTNAME, action });
  };
};

const enforceChallenge = (t: TestContext, siteverify: Siteverify) => {
  const requests: Array<Record<string, string>> = [];

  t.mock.method(
    TurnstileVerifier,
    'getInstance',
    () =>
      new TurnstileVerifier({
        secretKey: 'turnstile-secret-for-tests',
        checksSolvedContext: true,
        expectedHostnames: [WEB_HOSTNAME],
        fetchResponse: async (_input, init) => {
          assert.ok(typeof init?.body === 'string');
          const body = JSON.parse(init.body) as Record<string, string>;

          requests.push(body);

          return siteverify(body);
        }
      })
  );

  return requests;
};

const vouchedFor = (address: string) => {
  assert.ok(envs.apiProxySecret, 'API_PROXY_SECRET must be set for tests');

  return {
    [ProxyHeaders.CLIENT_ADDRESS]: address,
    [ProxyHeaders.PROXY_SECRET]: envs.apiProxySecret
  };
};

const post = async (
  route: string,
  body: object,
  { token, address = CLIENT_ADDRESS }: { token?: string; address?: string } = {}
) => {
  const req = (await apiRequest())
    .post(route)
    .set(vouchedFor(address))
    .send(body);

  return token === undefined ? req : req.set(BotChallenge.HEADER, token);
};

const accountCount = () => PrismaClient.getInstance().user.count();

describe('bot challenge', () => {
  registerIntegrationHooks();

  it('creates an account once Cloudflare confirms the token was solved for sign-up', async (t) => {
    const requests = enforceChallenge(
      t,
      solvedFor(BotChallenge.SIGN_UP_ACTION)
    );

    const res = await post(SIGN_UP_ROUTE, NEW_USER, { token: SOLVED_TOKEN });

    assert.equal(res.status, 201);
    assert.equal(await accountCount(), 1);
    assert.partialDeepStrictEqual(requests, [
      { response: SOLVED_TOKEN, remoteip: CLIENT_ADDRESS }
    ]);
  });

  it('refuses a sign-up without a token, creating nothing and asking Cloudflare nothing', async (t) => {
    const requests = enforceChallenge(
      t,
      solvedFor(BotChallenge.SIGN_UP_ACTION)
    );

    const res = await post(SIGN_UP_ROUTE, NEW_USER);

    assert.equal(res.status, Errors.AUTHORIZATION.status);
    assert.deepEqual(res.body, {
      code: Errors.AUTHORIZATION.code,
      message: UserMessages.CHALLENGE_FAILED,
      details: []
    });
    assert.equal(await accountCount(), 0);
    assert.equal(requests.length, 0);
  });

  it('refuses a token solved for sign-up when it is presented at sign-in', async (t) => {
    const user = await createUser();
    enforceChallenge(t, solvedFor(BotChallenge.SIGN_UP_ACTION));

    const res = await post(
      SIGN_IN_ROUTE,
      { email: user.email, password: FIXTURE_PASSWORD },
      { token: SOLVED_TOKEN }
    );

    assert.equal(res.status, Errors.AUTHORIZATION.status);
    assert.equal(res.body.accessToken, undefined);
  });

  it('refuses a token replayed after it signed someone in', async (t) => {
    const user = await createUser();
    enforceChallenge(t, answeringOnce(BotChallenge.SIGN_IN_ACTION));
    const credentials = { email: user.email, password: FIXTURE_PASSWORD };

    const first = await post(SIGN_IN_ROUTE, credentials, {
      token: SOLVED_TOKEN
    });
    const replayed = await post(SIGN_IN_ROUTE, credentials, {
      token: SOLVED_TOKEN
    });

    assert.equal(first.status, 200);
    assert.equal(replayed.status, Errors.AUTHORIZATION.status);
    assert.equal(replayed.body.accessToken, undefined);
  });

  it('answers unavailable, and creates nothing, while Cloudflare cannot be reached', async (t) => {
    enforceChallenge(t, () => Promise.reject(new TypeError('fetch failed')));

    const res = await post(SIGN_UP_ROUTE, NEW_USER, { token: SOLVED_TOKEN });

    assert.equal(res.status, Errors.UNAVAILABLE.status);
    assert.deepEqual(res.body, {
      code: Errors.UNAVAILABLE.code,
      message: UserMessages.CHALLENGE_UNAVAILABLE,
      details: []
    });
    assert.equal(await accountCount(), 0);
  });

  it("does not let unsolved sign-ins spend the budget of someone else's account", async (t) => {
    const user = await createUser();
    enforceChallenge(t, solvedFor(BotChallenge.SIGN_IN_ACTION));

    const res = await post(SIGN_IN_ROUTE, {
      email: user.email,
      password: 'wrong-password'
    });

    assert.equal(res.status, Errors.AUTHORIZATION.status);
    assert.equal(await isAccountRateLimited(user.email), false);
  });

  it('counts unsolved sign-ins against the budget of the address that sent them', async (t) => {
    enforceChallenge(t, solvedFor(BotChallenge.SIGN_IN_ACTION));
    const attempt = (address: string) =>
      post(
        SIGN_IN_ROUTE,
        { email: 'anyone@ex3.app', password: 'wrong-password' },
        { address }
      );

    for (
      let attempts = 0;
      attempts < RateLimits.SIGN_IN_PER_ADDRESS.limit;
      attempts += 1
    )
      assert.equal(
        (await attempt(CLIENT_ADDRESS)).status,
        Errors.AUTHORIZATION.status
      );

    assert.equal(
      (await attempt(CLIENT_ADDRESS)).status,
      Errors.THROTTLED.status
    );
    assert.equal(
      (await attempt(OTHER_ADDRESS)).status,
      Errors.AUTHORIZATION.status
    );
  });
});
