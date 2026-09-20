import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LogSeverities, formatLogEntry, severityOfStatus } from './Logger';

const OCCURRED_AT = new Date('2026-09-19T14:32:07.123Z');

describe('formatLogEntry', () => {
  it('writes one object with the timestamp, the severity and the event fields', () => {
    const line = formatLogEntry(
      {
        severity: LogSeverities.INFO,
        event: 'http_request',
        requestId: 'a1b2c3d4-e5f6',
        method: 'GET',
        route: '/v1/portfolio/positions',
        status: 200,
        durationMs: 37,
        userId: 'user-1'
      },
      OCCURRED_AT
    );

    assert.deepEqual(JSON.parse(line), {
      timestamp: '2026-09-19T14:32:07.123Z',
      severity: 'INFO',
      event: 'http_request',
      requestId: 'a1b2c3d4-e5f6',
      method: 'GET',
      route: '/v1/portfolio/positions',
      status: 200,
      durationMs: 37,
      userId: 'user-1'
    });
  });

  it('leaves out the fields the event did not carry', () => {
    const line = formatLogEntry(
      {
        severity: LogSeverities.WARNING,
        event: 'http_request',
        requestId: 'a1b2c3d4-e5f6',
        method: 'GET',
        route: 'unmatched',
        status: 404,
        durationMs: 2,
        userId: undefined,
        errorCode: 'NOT_FOUND'
      },
      OCCURRED_AT
    );

    const entry = JSON.parse(line);

    assert.equal('userId' in entry, false);
    assert.equal(entry.errorCode, 'NOT_FOUND');
  });

  it('keeps an error message with newlines on a single line', () => {
    const line = formatLogEntry(
      {
        severity: LogSeverities.ERROR,
        event: 'request_failed',
        errorName: 'Error',
        errorMessage: 'first\n{"severity":"INFO","event":"server_started"}',
        stack: 'Error: first\n    at handler'
      },
      OCCURRED_AT
    );

    assert.equal(line.includes('\n'), false);
    assert.equal(
      JSON.parse(line).errorMessage,
      'first\n{"severity":"INFO","event":"server_started"}'
    );
  });
});

describe('severityOfStatus', () => {
  it('reports a served response as information', () => {
    assert.equal(severityOfStatus(200), LogSeverities.INFO);
    assert.equal(severityOfStatus(304), LogSeverities.INFO);
  });

  it('reports a rejected request as a warning', () => {
    assert.equal(severityOfStatus(400), LogSeverities.WARNING);
    assert.equal(severityOfStatus(429), LogSeverities.WARNING);
    assert.equal(severityOfStatus(499), LogSeverities.WARNING);
  });

  it('reports a failed request as an error', () => {
    assert.equal(severityOfStatus(500), LogSeverities.ERROR);
    assert.equal(severityOfStatus(503), LogSeverities.ERROR);
  });
});
