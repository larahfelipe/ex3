import { IncomeTransactionTypes } from '@/config/Constants';

import { isIncome, netIncomeOf, yearStartOf } from './PositionIndicators';
import type { LedgerEntry } from './PositionLedger';

export type IncomeType =
  (typeof IncomeTransactionTypes)[keyof typeof IncomeTransactionTypes];

export type IncomeTotals = Record<'total' | 'trailingTotal', string>;

export type CurrencyIncome = Record<'currency', string> &
  IncomeTotals &
  Record<'byType', Array<Record<'type', IncomeType> & IncomeTotals>>;

export type PortfolioIncome = Record<'trailingFrom', Date> &
  Record<'byCurrency', Array<CurrencyIncome>>;

const INCOME_TYPES = Object.values(IncomeTransactionTypes);

const totalsOf = (
  entries: ReadonlyArray<LedgerEntry>,
  trailingFrom: number
): IncomeTotals => ({
  total: netIncomeOf(entries).toFixed(),
  trailingTotal: netIncomeOf(
    entries.filter(({ executedAt }) => executedAt.getTime() >= trailingFrom)
  ).toFixed()
});

export const summarizeIncome = (
  ledger: ReadonlyArray<LedgerEntry>,
  baseCurrency: string,
  now: Date
): PortfolioIncome => {
  const trailingFrom = yearStartOf(now);
  const income = ledger.filter(isIncome);
  const currencies = [...new Set(income.map(({ currency }) => currency))]
    .toSorted()
    .toSorted(
      (left, right) =>
        Number(right === baseCurrency) - Number(left === baseCurrency)
    );

  return {
    trailingFrom,
    byCurrency: currencies.map((currency) => {
      const inCurrency = income.filter((entry) => entry.currency === currency);

      return {
        currency,
        ...totalsOf(inCurrency, trailingFrom.getTime()),
        byType: INCOME_TYPES.flatMap((type) => {
          const ofType = inCurrency.filter((entry) => entry.type === type);

          return ofType.length === 0
            ? []
            : [{ type, ...totalsOf(ofType, trailingFrom.getTime()) }];
        })
      };
    })
  };
};
