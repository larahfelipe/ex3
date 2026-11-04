import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BOT_CHALLENGE } from '@/common/constants';
import { ApiProxyError } from '@/lib/axios';

import { botChallengeHeadersOf, hasDotSegment, jsonPayload } from './api-proxy';

const requestWith = (contentType: string | null, body = '{"a":1}') =>
  new Request('http://localhost/api/v1/sign-in', {
    method: 'POST',
    headers: contentType === null ? {} : { 'content-type': contentType },
    body
  });

describe('a forwarded path', () => {
  it('is refused with a segment of dots, which the upstream URL would resolve', () => {
    assert.equal(hasDotSegment('/v1/finances/expenses/abc/payments/..'), true);
    assert.equal(hasDotSegment('/v1/transaction/.'), true);
    assert.equal(hasDotSegment('/v1/asset/%2E%2e'), true);
    assert.equal(hasDotSegment('/v1/asset/.%2e/payments'), true);
  });

  it('passes ids and symbols, even ones holding dots', () => {
    assert.equal(
      hasDotSegment('/v1/finances/expenses/abc/payments/def'),
      false
    );
    assert.equal(hasDotSegment('/v1/asset/BRK.B'), false);
    assert.equal(hasDotSegment('/v1/asset/...'), false);
  });
});

describe('a request body', () => {
  it('is read as JSON when sent as JSON', async () => {
    assert.deepEqual(await jsonPayload(requestWith('application/json')), {
      a: 1
    });
    assert.deepEqual(
      await jsonPayload(requestWith('Application/JSON; charset=utf-8')),
      { a: 1 }
    );
  });

  it('is refused under any other media type, as a cross-site form sends it', async () => {
    for (const contentType of [
      'text/plain',
      'application/x-www-form-urlencoded',
      'multipart/form-data; boundary=x',
      'application/jsonp',
      null
    ])
      await assert.rejects(
        jsonPayload(requestWith(contentType)),
        (error) => error instanceof ApiProxyError && error.status === 415
      );
  });

  it('is refused as malformed when it does not parse', async () => {
    await assert.rejects(
      jsonPayload(requestWith('application/json', '{')),
      (error) => error instanceof ApiProxyError && error.status === 400
    );
  });
});

describe('a bot challenge token', () => {
  const requestCarrying = (token?: string) =>
    new Request('http://localhost/api/v1/sign-in', {
      method: 'POST',
      headers: token === undefined ? {} : { [BOT_CHALLENGE.Header]: token }
    });

  it('is passed on as the browser sent it', () => {
    assert.deepEqual(botChallengeHeadersOf(requestCarrying('solved-token')), {
      [BOT_CHALLENGE.Header]: 'solved-token'
    });
  });

  it('is dropped when missing, empty or longer than Cloudflare issues', () => {
    for (const token of [
      undefined,
      '',
      'x'.repeat(BOT_CHALLENGE.TokenMaxLength + 1)
    ])
      assert.deepEqual(botChallengeHeadersOf(requestCarrying(token)), {});
  });
});
