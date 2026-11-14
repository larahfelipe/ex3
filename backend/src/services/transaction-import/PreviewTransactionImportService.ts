import type { ListingSource } from '@/domain/MarketDataProvider';
import type {
  PortfolioRepository,
  TransactionImportRepository
} from '@/infra/database';

import { requireOwnedPortfolio } from '../PortfolioAccess';
import {
  lookUpListings,
  previewOf,
  readImportFile,
  type ImportPreview
} from './ImportFile';

export class PreviewTransactionImportService {
  private static INSTANCE: PreviewTransactionImportService;
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
    if (!PreviewTransactionImportService.INSTANCE)
      PreviewTransactionImportService.INSTANCE =
        new PreviewTransactionImportService(
          transactionImportRepository,
          portfolioRepository,
          listingSource
        );

    return PreviewTransactionImportService.INSTANCE;
  }

  async execute({
    userId,
    portfolioId,
    file,
    selectedKeys
  }: PreviewTransactionImportService.DTO): Promise<PreviewTransactionImportService.Result> {
    const portfolio = await requireOwnedPortfolio(this.portfolioRepository, {
      userId,
      portfolioId
    });

    const importFile = readImportFile({
      name: file.name,
      content: Buffer.from(file.content, 'base64')
    });
    const scope = { portfolioId: portfolio.id, userId, rows: importFile.rows };
    const listings = await lookUpListings(this.listingSource, {
      symbols: await this.transactionImportRepository.getUnknownSymbols(scope),
      rows: importFile.rows
    });
    const plan = await this.transactionImportRepository.plan({
      ...scope,
      listings,
      selection: selectedKeys === undefined ? null : new Set(selectedKeys)
    });

    return { preview: previewOf(importFile, plan) };
  }
}

namespace PreviewTransactionImportService {
  export type DTO = Record<'userId' | 'portfolioId', string> &
    Record<'file', Record<'name' | 'content', string>> &
    Partial<Record<'selectedKeys', Array<string>>>;
  export type Result = Record<'preview', ImportPreview>;
}
