import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';

import { translatorOf } from '@/i18n/translator';

import {
  earliestEndOf,
  earliestStartOf,
  requireEndOf
} from './recurrence-fields';

const t = translatorOf('pt-BR', 'validation');

const TODAY = '2026-11-15';

const issuesOf = (
  endDate: string,
  bounds: Parameters<typeof requireEndOf>[1]
) =>
  (
    z
      .object({ endDate: z.string() })
      .superRefine(({ endDate: end }, ctx) =>
        requireEndOf(
          { endMode: 'date', amountKind: 'fixed', endDate: end },
          bounds,
          ctx,
          t
        )
      )
      .safeParse({ endDate }).error?.issues ?? []
  ).map(({ message }) => message);

describe('a recurring expense’s end', () => {
  it('is today at the earliest, or its first bill when that comes later', () => {
    assert.equal(earliestEndOf(TODAY, '2026-10-01'), TODAY);
    assert.equal(earliestEndOf(TODAY, TODAY), TODAY);
    assert.equal(earliestEndOf(TODAY, '2027-02-28'), '2027-02-28');
  });

  it('refuses a new end before today but keeps one already saved', () => {
    const started = { startDate: '2026-01-10', today: TODAY };

    assert.deepEqual(issuesOf('2026-11-14', started), [
      'Escolha hoje ou uma data posterior'
    ]);
    assert.deepEqual(issuesOf(TODAY, started), []);
    assert.deepEqual(
      issuesOf('2026-06-30', { ...started, currentEnd: '2026-06-30' }),
      []
    );
    assert.deepEqual(
      issuesOf('2026-07-31', { ...started, currentEnd: '2026-06-30' }),
      ['Escolha hoje ou uma data posterior']
    );
  });

  it('names the first bill when the end comes before it', () => {
    assert.deepEqual(
      issuesOf('2026-12-01', { startDate: '2027-01-05', today: TODAY }),
      ['Escolha uma data igual ou posterior ao primeiro vencimento']
    );
  });
});

describe('a recurring expense’s start', () => {
  it('reaches back the occurrence horizon from today', () => {
    assert.equal(earliestStartOf(TODAY), '2025-11-15');
  });
});
