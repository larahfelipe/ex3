import { MarketDataMessages, TransactionImportMessages } from '@/config';
import type { ListingSource } from '@/domain/MarketDataProvider';
import { importKeysOf } from '@/domain/transaction-import';
import { ConflictError, UnavailableError } from '@/errors';
import type {
  PortfolioRepository,
  TransactionImport,
  TransactionImportRepository
} from '@/infra/database';

import { requireOwnedPortfolio } from '../PortfolioAccess';
import {
  lookUpListings,
  previewOf,
  readImportFile,
  type ImportPreview
} from './ImportFile';

/**
 * Records the rows a preview selected, all of them or none: the file is read
 * and planned again as the portfolio stands when it is recorded, and a plan
 * that would record any other rows, because the portfolio or the listings
 * changed since the preview, records nothing and asks for a new preview.
 */
export class CreateTransactionImportService {
  private static INSTANCE: CreateTransactionImportService;
  private readonly transactionImportRepository: TransactionImportRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly listingSource: ListingSource;

  private constructor(
    transactionImportRepository: TransactionImportRepository,
    portfolioRepository: PortfolioRepository,
    listingSource: ListingSource
  ) {
    this.transactionImportRepository = transactionImportRepository;
    this.portfolioRepository = portfolioRepository;
    this.listingSource = listingSource;
  }

  static getInstance(
    transactionImportRepository: TransactionImportRepository,
    portfolioRepository: PortfolioRepository,
    listingSource: ListingSource
  ) {
    if (!CreateTransactionImportService.INSTANCE)
      CreateTransactionImportService.INSTANCE =
        new CreateTransactionImportService(
          transactionImportRepository,
          portfolioRepository,
          listingSource
        );

    return CreateTransactionImportService.INSTANCE;
  }

  async execute({
    userId,
    portfolioId,
    file,
    selectedKeys
  }: CreateTransactionImportService.DTO): Promise<CreateTransactionImportService.Result> {
    const portfolio = await requireOwnedPortfolio(this.portfolioRepository, {
      userId,
      portfolioId
    });

    const importFile = readImportFile({
      name: file.name,
      content: Buffer.from(file.content, 'base64')
    });
    const { rows } = importFile;
    const selection = new Set(selectedKeys);
    const keys = importKeysOf(rows);
    const selectedSymbols = new Set(
      rows.flatMap(({ mapped }, index) => {
        const key = keys[index];

        return mapped.outcome === 'entry' && key !== null && selection.has(key)
          ? [mapped.entry.symbol]
          : [];
      })
    );
    const scope = { portfolioId: portfolio.id, userId, rows };
    const listings = await lookUpListings(this.listingSource, {
      symbols: await this.transactionImportRepository.getUnknownSymbols(scope),
      rows,
      described: selectedSymbols
    });

    if (
      [...selectedSymbols].some(
        (symbol) => listings.get(symbol)?.outcome === 'unavailable'
      )
    )
      throw new UnavailableError(MarketDataMessages.UNAVAILABLE);

    const recording = await this.transactionImportRepository.record({
      ...scope,
      listings,
      selection,
      file: importFile
    });

    if (recording.outcome !== 'recorded')
      throw new ConflictError(TransactionImportMessages.CHANGED);

    return {
      transactionImport: recording.transactionImport,
      result: previewOf(importFile, recording.plan),
      message: TransactionImportMessages.IMPORTED
    };
  }
}

namespace CreateTransactionImportService {
  export type DTO = Record<'userId' | 'portfolioId', string> &
    Record<'file', Record<'name' | 'content', string>> &
    Record<'selectedKeys', Array<string>>;
  export type Result = Record<'transactionImport', TransactionImport> &
    Record<'result', ImportPreview> &
    Record<'message', string>;
}
