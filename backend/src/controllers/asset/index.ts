import type { Request, Response } from 'express';

import {
  AssetRepository,
  InstrumentRepository,
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';
import { YahooFinanceProvider } from '@/infra/market-data';
import {
  CreateAssetService,
  DeleteAssetService,
  GetAllAssetsService,
  GetAssetService,
  GetAssetValuationsService,
  UpdateAssetService
} from '@/services/asset';

import { CreateAssetController } from './CreateAssetController';
import { DeleteAssetController } from './DeleteAssetController';
import { GetAllAssetsController } from './GetAllAssetsController';
import { GetAssetController } from './GetAssetController';
import { GetAssetValuationsController } from './GetAssetValuationsController';
import { UpdateAssetController } from './UpdateAssetController';

export const createAssetControllerHandler = (req: Request, res: Response) => {
  const assetRepository = AssetRepository.getInstance();
  const instrumentRepository = InstrumentRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();

  const createAssetService = CreateAssetService.getInstance(
    assetRepository,
    instrumentRepository,
    portfolioRepository
  );

  const createAssetController =
    CreateAssetController.getInstance(createAssetService);

  return createAssetController.handle(req, res);
};

export const deleteAssetControllerHandler = (req: Request, res: Response) => {
  const assetRepository = AssetRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();

  const deleteAssetService = DeleteAssetService.getInstance(
    assetRepository,
    portfolioRepository
  );

  const deleteAssetController =
    DeleteAssetController.getInstance(deleteAssetService);

  return deleteAssetController.handle(req, res);
};

export const getAllAssetsControllerHandler = (req: Request, res: Response) => {
  const assetRepository = AssetRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const transactionRepository = TransactionRepository.getInstance();

  const getAllAssetsService = GetAllAssetsService.getInstance(
    assetRepository,
    portfolioRepository,
    transactionRepository
  );

  const getAllAssetsController =
    GetAllAssetsController.getInstance(getAllAssetsService);

  return getAllAssetsController.handle(req, res);
};

export const getAssetControllerHandler = (req: Request, res: Response) => {
  const assetRepository = AssetRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();

  const getAssetService = GetAssetService.getInstance(
    assetRepository,
    portfolioRepository
  );

  const getAssetController = GetAssetController.getInstance(getAssetService);

  return getAssetController.handle(req, res);
};

export const getAssetValuationsControllerHandler = (
  req: Request,
  res: Response
) => {
  const assetRepository = AssetRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const marketDataProvider = YahooFinanceProvider.getInstance();

  const getAssetValuationsService = GetAssetValuationsService.getInstance(
    assetRepository,
    portfolioRepository,
    marketDataProvider
  );

  const getAssetValuationsController = GetAssetValuationsController.getInstance(
    getAssetValuationsService
  );

  return getAssetValuationsController.handle(req, res);
};

export const updateAssetControllerHandler = (req: Request, res: Response) => {
  const assetRepository = AssetRepository.getInstance();
  const instrumentRepository = InstrumentRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();

  const updateAssetService = UpdateAssetService.getInstance(
    assetRepository,
    instrumentRepository,
    portfolioRepository
  );

  const updateAssetController =
    UpdateAssetController.getInstance(updateAssetService);

  return updateAssetController.handle(req, res);
};
