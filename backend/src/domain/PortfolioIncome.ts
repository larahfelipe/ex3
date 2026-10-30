import { IncomeTransactionTypes } from '@/config/Constants';

import { isIncome, netIncomeOf, yearStartOf } from './PositionIndicators';
import type { LedgerEntry } from './PositionLedger';

export type IncomeType =
  (typeof IncomeTransactionTypes)[keyof typeof IncomeTransactionTypes];

/** Net amounts in one currency: all that was recorded, and what was executed since `trailingFrom`. */
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

/**
 * The income recorded in the ledger, each DIVIDEND, JCP and INTEREST net of
 * its fees and taxes (`q · p − f − t`), per currency and per type: in all, and
 * executed since `trailingFrom`, the start of the same one-year window as a
 * position's `trailingIncome`. Amounts in different currencies are not added:
 * converting them would need a rate the ledger does not settle, the day's of
 * each payment or today's. The base currency comes first and the others follow
 * in code order; a currency or a type without income is left out. Only what
 * was recorded counts, so nothing here is a forecast.
 */
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
