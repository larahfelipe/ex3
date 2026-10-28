import {
  MarketSearchStatuses,
  Pagination,
  type MarketSearchStatus
} from '@/config/Constants';
import {
  isListableSymbol,
  toVisibleInstrument,
  type VisibleInstrument
} from '@/domain/InstrumentCatalog';
import type { Listing, MarketDataProvider } from '@/domain/MarketDataProvider';
import type { InstrumentRepository } from '@/infra/database';

/** Assumed, not measured: more matches than fit a picker ask for a longer term, not a next page. */
const SEARCH_RESULT_LIMIT = 20;

export class SearchInstrumentsService {
  private static INSTANCE: SearchInstrumentsService;
  private readonly instrumentRepository: InstrumentRepository;
  private readonly marketDataProvider: MarketDataProvider;

  private constructor(
    instrumentRepository: InstrumentRepository,
    marketDataProvider: MarketDataProvider
  ) {
    this.instrumentRepository = instrumentRepository;
    this.marketDataProvider = marketDataProvider;
  }

  static getInstance(
    instrumentRepository: InstrumentRepository,
    marketDataProvider: MarketDataProvider
  ) {
    if (!SearchInstrumentsService.INSTANCE)
      SearchInstrumentsService.INSTANCE = new SearchInstrumentsService(
        instrumentRepository,
        marketDataProvider
      );

    return SearchInstrumentsService.INSTANCE;
  }

  /**
   * The quote provider is asked only for a term that could be a new symbol and
   * names no instrument the caller already sees: that one is added as it is,
   * and a listing under its symbol could not be registered beside it.
   */
  async execute({
    userId,
    query
  }: SearchInstrumentsService.DTO): Promise<SearchInstrumentsService.Result> {
    const symbol = query.toUpperCase();
    const isSymbolTerm = isListableSymbol(symbol);

    const [{ docs }, seenInstrument] = await Promise.all([
      this.instrumentRepository.getAllVisible({
        userId,
        search: query,
        page: Pagination.FIRST_PAGE,
        limit: SEARCH_RESULT_LIMIT
      }),
      isSymbolTerm
        ? this.instrumentRepository.getVisibleBySymbol({ symbol, userId })
        : null
    ]);

    const instruments = docs.map(toVisibleInstrument);

    if (!isSymbolTerm || seenInstrument !== null)
      return {
        instruments,
        listings: [],
        marketSearch: MarketSearchStatuses.SKIPPED
      };

    const search = await this.marketDataProvider.findListings(symbol);

    return search.outcome === 'unavailable'
      ? {
          instruments,
          listings: [],
          marketSearch: MarketSearchStatuses.UNAVAILABLE
        }
      : {
          instruments,
          listings: search.listings,
          marketSearch: MarketSearchStatuses.SEARCHED
        };
  }
}

namespace SearchInstrumentsService {
  export type DTO = Record<'userId' | 'query', string>;
  export type Result = {
    instruments: Array<VisibleInstrument>;
    listings: Array<Listing>;
    marketSearch: MarketSearchStatus;
  };
}
