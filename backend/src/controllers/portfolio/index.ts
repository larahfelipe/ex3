import type { Request, Response } from 'express';

import { AssetRepository, PortfolioRepository } from '@/infra/database';
import { YahooFinanceProvider } from '@/infra/market-data';
import {
  CreatePortfolioService,
  GetAllPortfoliosService,
  GetPortfolioOverviewService,
  GetPortfolioPositionsService,
  GetPortfolioService
} from '@/services/portfolio';

import { CreatePortfolioController } from './CreatePortfolioController';
import { GetAllPortfoliosController } from './GetAllPortfoliosController';
import { GetPortfolioController } from './GetPortfolioController';
import { GetPortfolioOverviewController } from './GetPortfolioOverviewController';
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
