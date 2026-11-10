import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  ImportPreviewRow,
  ImportRowStatus
} from '@/app/api/v1/transaction-imports';
import { TRANSACTION_IMPORT } from '@/common/constants';

import {
  base64Of,
  costsOf,
  countGroupsOf,
  importFileRefusalOf,
  isSameSelection,
  isSelectableRow,
  rowIdOf,
  rowsMatching
} from './transaction-import';

const rowWith = (
  status: ImportRowStatus,
  key: string | null = status,
  rowNumber = 2
): ImportPreviewRow => ({
  key,
  format: 'b3-trades',
  entry: null,
  status,
  isSelected: false,
  warnings: [],
  problems: [],
  reason: null,
  matchedTransactionId: null,
  sheet: 'Negociação',
  rowNumber,
  cells: {}
});

const countsWith = (
  counts: Partial<Record<ImportRowStatus, number>>
): Record<ImportRowStatus, number> => ({
  ready: 0,
  review: 0,
  'possible-duplicate': 0,
  duplicate: 0,
  unresolved: 0,
  refused: 0,
  ignored: 0,
  rejected: 0,
  ...counts
});

describe('a chosen file', () => {
  it('is sent when it is a spreadsheet EX3 reads, whatever the case of its extension', () => {
    assert.equal(
      importFileRefusalOf({ name: 'negociacao.xlsx', size: 10 }),
      null
    );
    assert.equal(importFileRefusalOf({ name: 'EXTRATO.CSV', size: 10 }), null);
  });

  it('is refused before sending by its extension, its emptiness or its size', () => {
    assert.equal(
      importFileRefusalOf({ name: 'extrato.xls', size: 10 }),
      'unsupported'
    );
    assert.equal(
      importFileRefusalOf({ name: 'extrato.xlsx.pdf', size: 10 }),
      'unsupported'
    );
    assert.equal(
      importFileRefusalOf({ name: 'extrato.csv', size: 0 }),
      'empty'
    );
    assert.equal(
      importFileRefusalOf({
        name: 'extrato.xlsx',
        size: TRANSACTION_IMPORT.FileMaxBytes
      }),
      null
    );
    assert.equal(
      importFileRefusalOf({
        name: 'extrato.xlsx',
        size: TRANSACTION_IMPORT.FileMaxBytes + 1
      }),
      'too-large'
    );
  });

  it('is encoded byte for byte, across the chunks it is read in', () => {
    const bytes = Uint8Array.from(
      { length: 0x8000 * 2 + 17 },
      (_, index) => (index * 31) % 256
    );

    assert.equal(base64Of(bytes), Buffer.from(bytes).toString('base64'));
    assert.equal(base64Of(new Uint8Array()), '');
    assert.equal(
      base64Of(new TextEncoder().encode('Data;Preço\r\n')),
      Buffer.from('Data;Preço\r\n').toString('base64')
    );
  });
});

describe('a preview row', () => {
  it('may be selected when it becomes a transaction the person may include', () => {
    for (const status of [
      'ready',
      'review',
      'possible-duplicate',
      'refused'
    ] as const)
      assert.equal(isSelectableRow(rowWith(status)), true, status);

    for (const status of [
      'duplicate',
      'unresolved',
      'ignored',
      'rejected'
    ] as const)
      assert.equal(isSelectableRow(rowWith(status)), false, status);

    assert.equal(isSelectableRow(rowWith('ready', null)), false);
  });

  it('is named by its sheet and number, so two sheets never collide', () => {
    assert.notEqual(
      rowIdOf({ sheet: 'A', rowNumber: 12 }),
      rowIdOf({ sheet: 'A1', rowNumber: 2 })
    );
    assert.equal(
      rowIdOf({ sheet: '', rowNumber: 3 }),
      rowIdOf({ sheet: '', rowNumber: 3 })
    );
  });

  it('is listed by what the person does about it', () => {
    const rows = [
      rowWith('ready', 'a', 2),
      rowWith('review', 'b', 3),
      rowWith('duplicate', 'c', 4),
      rowWith('ignored', null, 5),
      rowWith('rejected', null, 6),
      rowWith('possible-duplicate', 'd', 7)
    ];
    const selection = new Set(['a', 'd']);
    const numbersOf = (filtered: ReadonlyArray<ImportPreviewRow>) =>
      filtered.map(({ rowNumber }) => rowNumber);

    assert.deepEqual(
      numbersOf(rowsMatching(rows, 'all', selection)),
      [2, 3, 4, 5, 6, 7]
    );
    assert.deepEqual(
      numbersOf(rowsMatching(rows, 'selected', selection)),
      [2, 7]
    );
    assert.deepEqual(
      numbersOf(rowsMatching(rows, 'attention', selection)),
      [3, 6, 7]
    );
    assert.deepEqual(
      numbersOf(rowsMatching(rows, 'skipped', selection)),
      [4, 5]
    );
  });
});

describe('a preview’s counts', () => {
  it('group every status once', () => {
    assert.deepEqual(
      countGroupsOf(
        countsWith({
          ready: 5,
          review: 2,
          'possible-duplicate': 1,
          duplicate: 3,
          unresolved: 1,
          refused: 2,
          rejected: 4,
          ignored: 6
        })
      ),
      {
        ready: 5,
        toReview: 3,
        alreadyImported: 3,
        notImportable: 7,
        ignored: 6
      }
    );
  });
});

describe('a selection', () => {
  it('matches a plan only with the same keys', () => {
    assert.equal(isSameSelection(new Set(['a', 'b']), ['b', 'a']), true);
    assert.equal(isSameSelection(new Set(), []), true);
    assert.equal(isSameSelection(new Set(['a']), ['a', 'b']), false);
    assert.equal(isSameSelection(new Set(['a', 'c']), ['a', 'b']), false);
  });
});

describe('a row’s costs', () => {
  it('add fees and taxes exactly, at the finer of their scales', () => {
    assert.equal(costsOf({ fees: '0.1', taxes: '0.2' }), '0.3');
    assert.equal(costsOf({ fees: '4.9', taxes: '0.01' }), '4.91');
    assert.equal(costsOf({ fees: '0', taxes: '0' }), '0');
    assert.equal(
      costsOf({ fees: '12345678901234.5678', taxes: '0.0001' }),
      '12345678901234.5679'
    );
  });
});
