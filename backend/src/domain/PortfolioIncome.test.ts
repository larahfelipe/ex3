import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { summarizeIncome } from './PortfolioIncome';
import type { LedgerEntry } from './PositionLedger';

const NOW = new Date('2026-09-23T15:00:00.000Z');

const ledgerEntry = (
  entry: Pick<LedgerEntry, 'type' | 'quantity' | 'unitPrice' | 'executedAt'> &
    Partial<LedgerEntry>
): LedgerEntry => ({
  fees: '0',
  taxes: '0',
  currency: 'BRL',
  ...entry
});

describe('summarizeIncome', () => {
  it('nets each payment of its fees and taxes and adds those of the last year apart', () => {
    const income = summarizeIncome(
      [
        ledgerEntry({
          type: 'BUY',
          quantity: '100',
          unitPrice: '40',
          executedAt: new Date('2025-01-10T12:00:00.000Z')
        }),
        ledgerEntry({
          type: 'DIVIDEND',
          quantity: '100',
          unitPrice: '0.5',
          executedAt: new Date('2025-06-10T12:00:00.000Z')
        }),
        ledgerEntry({
          type: 'DIVIDEND',
          quantity: '100',
          unitPrice: '0.75',
          fees: '1',
          executedAt: new Date('2025-09-23T00:00:00.000Z')
        }),
        ledgerEntry({
          type: 'JCP',
          quantity: '100',
          unitPrice: '0.4',
          taxes: '6',
          executedAt: new Date('2026-03-02T12:00:00.000Z')
        }),
        ledgerEntry({
          type: 'SELL',
          quantity: '50',
          unitPrice: '45',
          executedAt: new Date('2026-04-01T12:00:00.000Z')
        })
      ],
      'BRL',
      NOW
    );

    assert.deepEqual(income, {
      trailingFrom: new Date('2025-09-23T00:00:00.000Z'),
      byCurrency: [
        {
          currency: 'BRL',
          total: '158',
          trailingTotal: '108',
          byType: [
            { type: 'DIVIDEND', total: '124', trailingTotal: '74' },
            { type: 'JCP', total: '34', trailingTotal: '34' }
          ]
        }
      ]
    });
  });

  it('keeps each currency apart, the base currency first, without converting any', () => {
    const income = summarizeIncome(
      [
        ledgerEntry({
          type: 'INTEREST',
          quantity: '1',
          unitPrice: '12.5',
          currency: 'EUR',
          executedAt: new Date('2026-01-05T12:00:00.000Z')
        }),
        ledgerEntry({
          type: 'DIVIDEND',
          quantity: '2',
          unitPrice: '0.25',
          currency: 'USD',
          executedAt: new Date('2026-02-05T12:00:00.000Z')
        }),
        ledgerEntry({
          type: 'DIVIDEND',
          quantity: '10',
          unitPrice: '1',
          currency: 'BRL',
          executedAt: new Date('2024-02-05T12:00:00.000Z')
        })
      ],
      'USD',
      NOW
    );

    assert.deepEqual(
      income.byCurrency.map(({ currency, total, trailingTotal }) => ({
        currency,
        total,
        trailingTotal
      })),
      [
        { currency: 'USD', total: '0.5', trailingTotal: '0.5' },
        { currency: 'BRL', total: '10', trailingTotal: '0' },
        { currency: 'EUR', total: '12.5', trailingTotal: '12.5' }
      ]
    );
  });

  it('has nothing to summarize without recorded income', () => {
    assert.deepEqual(
      summarizeIncome(
        [
          ledgerEntry({
            type: 'BUY',
            quantity: '1',
            unitPrice: '10',
            executedAt: new Date('2026-01-05T12:00:00.000Z')
          })
        ],
        'BRL',
        NOW
      ).byCurrency,
      []
    );
  });
});
