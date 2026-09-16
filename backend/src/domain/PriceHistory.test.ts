import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { missingRangesOf, startOfDayInUtc } from './PriceHistory';

const closeOn = (day: string) => ({ timestamp: new Date(day) });

const NOW = new Date('2026-09-16T14:30:00.000Z');
const TODAY = new Date('2026-09-16T00:00:00.000Z');

describe('startOfDayInUtc', () => {
  it('takes an instant to the start of its own day in UTC', () => {
    assert.deepEqual(startOfDayInUtc(NOW), TODAY);
    assert.deepEqual(
      startOfDayInUtc(new Date('2026-09-16T23:59:59.999Z')),
      TODAY
    );
  });
});

describe('missingRangesOf', () => {
  it('asks for the whole range up to the current day when nothing is stored', () => {
    assert.deepEqual(
      missingRangesOf(
        [],
        { from: new Date('2026-09-10T00:00:00.000Z'), to: NOW },
        NOW
      ),
      [{ from: new Date('2026-09-10T00:00:00.000Z'), to: TODAY }]
    );
  });

  it('asks for nothing when the stored closes reach the current day', () => {
    assert.deepEqual(
      missingRangesOf(
        [
          closeOn('2026-09-14T00:00:00.000Z'),
          closeOn('2026-09-15T00:00:00.000Z')
        ],
        { from: new Date('2026-09-14T00:00:00.000Z'), to: NOW },
        NOW
      ),
      []
    );
  });

  it('asks only for what comes before the oldest close stored', () => {
    assert.deepEqual(
      missingRangesOf(
        [
          closeOn('2026-09-14T00:00:00.000Z'),
          closeOn('2026-09-15T00:00:00.000Z')
        ],
        { from: new Date('2026-09-10T00:00:00.000Z'), to: NOW },
        NOW
      ),
      [
        {
          from: new Date('2026-09-10T00:00:00.000Z'),
          to: new Date('2026-09-14T00:00:00.000Z')
        }
      ]
    );
  });

  it('asks only for what comes after the newest close stored', () => {
    assert.deepEqual(
      missingRangesOf(
        [
          closeOn('2026-09-10T00:00:00.000Z'),
          closeOn('2026-09-11T00:00:00.000Z')
        ],
        { from: new Date('2026-09-10T00:00:00.000Z'), to: NOW },
        NOW
      ),
      [{ from: new Date('2026-09-12T00:00:00.000Z'), to: TODAY }]
    );
  });

  it('asks for both edges at once', () => {
    assert.deepEqual(
      missingRangesOf(
        [closeOn('2026-09-11T00:00:00.000Z')],
        { from: new Date('2026-09-09T00:00:00.000Z'), to: NOW },
        NOW
      ),
      [
        {
          from: new Date('2026-09-09T00:00:00.000Z'),
          to: new Date('2026-09-11T00:00:00.000Z')
        },
        { from: new Date('2026-09-12T00:00:00.000Z'), to: TODAY }
      ]
    );
  });

  it('never asks for a day the market did not trade between the extremes', () => {
    assert.deepEqual(
      missingRangesOf(
        [
          closeOn('2026-09-14T00:00:00.000Z'),
          closeOn('2026-09-16T00:00:00.000Z')
        ],
        {
          from: new Date('2026-09-14T00:00:00.000Z'),
          to: new Date('2026-09-17T00:00:00.000Z')
        },
        new Date('2026-09-17T10:00:00.000Z')
      ),
      []
    );
  });

  it('keeps a range that ends in the past whole', () => {
    assert.deepEqual(
      missingRangesOf(
        [],
        {
          from: new Date('2026-09-01T00:00:00.000Z'),
          to: new Date('2026-09-05T00:00:00.000Z')
        },
        NOW
      ),
      [
        {
          from: new Date('2026-09-01T00:00:00.000Z'),
          to: new Date('2026-09-05T00:00:00.000Z')
        }
      ]
    );
  });

  it('asks for nothing when the range covers only the current day', () => {
    assert.deepEqual(missingRangesOf([], { from: TODAY, to: NOW }, NOW), []);
  });
});
