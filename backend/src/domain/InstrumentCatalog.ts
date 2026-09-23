import {
  INSTRUMENT_SYMBOL_PATTERN,
  InstrumentLimits,
  InstrumentScopes,
  MarketQuoteCurrencies,
  type InstrumentScope
} from '@/config/Constants';

import type { Instrument } from './models';

export type VisibleInstrument = Omit<Instrument, 'ownerId'> &
  Record<'scope', InstrumentScope>;

const QUOTE_CURRENCY_BY_MARKET: ReadonlyMap<string, string | null> = new Map(
  Object.entries(MarketQuoteCurrencies)
);

/** Whether a search term could be the symbol of a new instrument, and so be looked up in the market. */
export const isListableSymbol = (term: string) =>
  term.length <= InstrumentLimits.SYMBOL_MAX_LENGTH &&
  INSTRUMENT_SYMBOL_PATTERN.test(term);

/** The owner stays internal: a caller only ever sees its own private instruments. */
export const toVisibleInstrument = ({
  ownerId,
  ...instrument
}: Instrument): VisibleInstrument => ({
  ...instrument,
  scope: ownerId === null ? InstrumentScopes.CATALOG : InstrumentScopes.PRIVATE
});

/** An attribute left unset, or a market registered before the known ones, constrains nothing. */
export const isQuotedCurrencyOf = ({
  market,
  currency
}: Pick<Instrument, 'market' | 'currency'>) => {
  if (market === null || currency === null) return true;

  const quoteCurrency = QUOTE_CURRENCY_BY_MARKET.get(market);

  return (
    quoteCurrency === undefined ||
    quoteCurrency === null ||
    quoteCurrency === currency
  );
};
