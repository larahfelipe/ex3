import {
  InstrumentScopes,
  InstrumentTypes,
  MarketQuoteCurrencies,
  Markets,
  type InstrumentScope
} from '@/config/Constants';

import type { Instrument } from './models';

export type VisibleInstrument = Omit<Instrument, 'ownerId'> &
  Record<'scope', InstrumentScope>;

const QUOTE_CURRENCY_BY_MARKET: ReadonlyMap<string, string | null> = new Map(
  Object.entries(MarketQuoteCurrencies)
);

/** What an instrument can be registered with, so a client offers only these. */
export const INSTRUMENT_REGISTRATION_OPTIONS = {
  types: Object.values(InstrumentTypes),
  markets: Object.values(Markets).map((market) => ({
    market,
    currency: MarketQuoteCurrencies[market]
  }))
};

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
