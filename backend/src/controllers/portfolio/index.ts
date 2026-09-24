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
  DeletePortfolioService,
  GetAllPortfoliosService,
  GetPortfolioAllocationService,
  GetPortfolioOverviewService,
  GetPortfolioPerformanceService,
  GetPortfolioPositionService,
  GetPortfolioPositionsService,
  GetPortfolioService,
  GetPositionFundamentalsService,
  GetPositionIndicatorsService,
  UpdatePortfolioService
} from '@/services/portfolio';

import { CreatePortfolioController } from './CreatePortfolioController';
import { DeletePortfolioController } from './DeletePortfolioController';
import { GetAllPortfoliosController } from './GetAllPortfoliosController';
import { GetPortfolioAllocationController } from './GetPortfolioAllocationController';
import { GetPortfolioController } from './GetPortfolioController';
import { GetPortfolioOverviewController } from './GetPortfolioOverviewController';
import { GetPortfolioPerformanceController } from './GetPortfolioPerformanceController';
import { GetPortfolioPositionController } from './GetPortfolioPositionController';
import { GetPortfolioPositionsController } from './GetPortfolioPositionsController';
import { GetPositionFundamentalsController } from './GetPositionFundamentalsController';
import { GetPositionIndicatorsController } from './GetPositionIndicatorsController';
import { UpdatePortfolioController } from './UpdatePortfolioController';

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

export const updatePortfolioControllerHandler = (
  req: Request,
  res: Response
) => {
  const portfolioRepository = PortfolioRepository.getInstance();

  const updatePortfolioService =
    UpdatePortfolioService.getInstance(portfolioRepository);

  const updatePortfolioController = UpdatePortfolioController.getInstance(
    updatePortfolioService
  );

  return updatePortfolioController.handle(req, res);
};

export const deletePortfolioControllerHandler = (
  req: Request,
  res: Response
) => {
  const portfolioRepository = PortfolioRepository.getInstance();

  const deletePortfolioService =
    DeletePortfolioService.getInstance(portfolioRepository);

  const deletePortfolioController = DeletePortfolioController.getInstance(
    deletePortfolioService
  );

  return deletePortfolioController.handle(req, res);
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
  const assetRepository = AssetRepository.getInstance();
  const instrumentRepository = InstrumentRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const transactionRepository = TransactionRepository.getInstance();
  const marketQuoteRepository = MarketQuoteRepository.getInstance();
  const exchangeRateRepository = ExchangeRateRepository.getInstance();
  const marketDataProvider = YahooFinanceProvider.getInstance();

  const getPortfolioPerformanceService =
    GetPortfolioPerformanceService.getInstance(
      assetRepository,
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

export const getPortfolioPositionControllerHandler = (
  req: Request,
  res: Response
) => {
  const assetRepository = AssetRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const marketDataProvider = YahooFinanceProvider.getInstance();

  const getPortfolioPositionService = GetPortfolioPositionService.getInstance(
    assetRepository,
    portfolioRepository,
    marketDataProvider
  );

  const getPortfolioPositionController =
    GetPortfolioPositionController.getInstance(getPortfolioPositionService);

  return getPortfolioPositionController.handle(req, res);
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

export const getPositionFundamentalsControllerHandler = (
  req: Request,
  res: Response
) => {
  const assetRepository = AssetRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const marketDataProvider = YahooFinanceProvider.getInstance();

  const getPositionFundamentalsService =
    GetPositionFundamentalsService.getInstance(
      assetRepository,
      portfolioRepository,
      marketDataProvider
    );

  const getPositionFundamentalsController =
    GetPositionFundamentalsController.getInstance(
      getPositionFundamentalsService
    );

  return getPositionFundamentalsController.handle(req, res);
};

export const getPositionIndicatorsControllerHandler = (
  req: Request,
  res: Response
) => {
  const assetRepository = AssetRepository.getInstance();
  const instrumentRepository = InstrumentRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const transactionRepository = TransactionRepository.getInstance();
  const marketQuoteRepository = MarketQuoteRepository.getInstance();
  const marketDataProvider = YahooFinanceProvider.getInstance();

  const getPositionIndicatorsService = GetPositionIndicatorsService.getInstance(
    assetRepository,
    portfolioRepository,
    transactionRepository,
    GetPriceHistoryService.getInstance(
      instrumentRepository,
      marketQuoteRepository,
      marketDataProvider
    )
  );

  const getPositionIndicatorsController =
    GetPositionIndicatorsController.getInstance(getPositionIndicatorsService);

  return getPositionIndicatorsController.handle(req, res);
};
