import type { Request, Response } from 'express';

import {
  AssetRepository,
  ExchangeRateRepository,
  InstrumentRepository,
  MarketQuoteRepository,
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';
import { YahooFinanceProvider } from '@/infra/market-data';
import {
  GetExchangeRateHistoryService,
  GetPriceHistoryService
} from '@/services/market-data';
import {
  CreatePortfolioService,
  GetAllPortfoliosService,
  GetPortfolioAllocationService,
  GetPortfolioOverviewService,
  GetPortfolioPerformanceService,
  GetPortfolioPositionsService,
  GetPortfolioService
} from '@/services/portfolio';

import { CreatePortfolioController } from './CreatePortfolioController';
import { GetAllPortfoliosController } from './GetAllPortfoliosController';
import { GetPortfolioAllocationController } from './GetPortfolioAllocationController';
import { GetPortfolioController } from './GetPortfolioController';
import { GetPortfolioOverviewController } from './GetPortfolioOverviewController';
import { GetPortfolioPerformanceController } from './GetPortfolioPerformanceController';
import { GetPortfolioPositionsController } from './GetPortfolioPositionsController';

export const createPortfolioControllerHandler = (
  req: Request,
  res: Response
) => {
  const portfolioRepository = PortfolioRepository.getInstance();

  const createPortfolioService =
    CreatePortfolioService.getInstance(portfolioRepository);

  const createPortfolioController = CreatePortfolioController.getInstance(
    createPortfolioService
  );

  return createPortfolioController.handle(req, res);
};

export const getAllPortfoliosControllerHandler = (
  req: Request,
  res: Response
) => {
  const portfolioRepository = PortfolioRepository.getInstance();

  const getAllPortfoliosService =
    GetAllPortfoliosService.getInstance(portfolioRepository);

  const getAllPortfoliosController = GetAllPortfoliosController.getInstance(
    getAllPortfoliosService
  );

  return getAllPortfoliosController.handle(req, res);
};

export const getPortfolioControllerHandler = (req: Request, res: Response) => {
  const portfolioRepository = PortfolioRepository.getInstance();

  const getPortfolioService =
    GetPortfolioService.getInstance(portfolioRepository);

  const getPortfolioController =
    GetPortfolioController.getInstance(getPortfolioService);

  return getPortfolioController.handle(req, res);
};

export const getPortfolioAllocationControllerHandler = (
  req: Request,
  res: Response
) => {
  const assetRepository = AssetRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const marketDataProvider = YahooFinanceProvider.getInstance();

  const getPortfolioAllocationService =
    GetPortfolioAllocationService.getInstance(
      assetRepository,
      portfolioRepository,
      marketDataProvider
    );

  const getPortfolioAllocationController =
    GetPortfolioAllocationController.getInstance(getPortfolioAllocationService);

  return getPortfolioAllocationController.handle(req, res);
};

export const getPortfolioOverviewControllerHandler = (
  req: Request,
  res: Response
) => {
  const assetRepository = AssetRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const marketDataProvider = YahooFinanceProvider.getInstance();

  const getPortfolioOverviewService = GetPortfolioOverviewService.getInstance(
    assetRepository,
    portfolioRepository,
    marketDataProvider
  );

  const getPortfolioOverviewController =
    GetPortfolioOverviewController.getInstance(getPortfolioOverviewService);

  return getPortfolioOverviewController.handle(req, res);
};

export const getPortfolioPerformanceControllerHandler = (
  req: Request,
  res: Response
) => {
  const instrumentRepository = InstrumentRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const transactionRepository = TransactionRepository.getInstance();
  const marketQuoteRepository = MarketQuoteRepository.getInstance();
  const exchangeRateRepository = ExchangeRateRepository.getInstance();
  const marketDataProvider = YahooFinanceProvider.getInstance();

  const getPortfolioPerformanceService =
    GetPortfolioPerformanceService.getInstance(
      instrumentRepository,
      portfolioRepository,
      transactionRepository,
      GetPriceHistoryService.getInstance(
        instrumentRepository,
        marketQuoteRepository,
        marketDataProvider
      ),
      GetExchangeRateHistoryService.getInstance(
        exchangeRateRepository,
        marketDataProvider
      )
    );

  const getPortfolioPerformanceController =
    GetPortfolioPerformanceController.getInstance(
      getPortfolioPerformanceService
    );

  return getPortfolioPerformanceController.handle(req, res);
};

export const getPortfolioPositionsControllerHandler = (
  req: Request,
  res: Response
) => {
  const assetRepository = AssetRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const marketDataProvider = YahooFinanceProvider.getInstance();

  const getPortfolioPositionsService = GetPortfolioPositionsService.getInstance(
    assetRepository,
    portfolioRepository,
    marketDataProvider
  );

  const getPortfolioPositionsController =
    GetPortfolioPositionsController.getInstance(getPortfolioPositionsService);

  return getPortfolioPositionsController.handle(req, res);
};
