import type { Request, Response } from 'express';

import {
  AssetRepository,
  InstrumentRepository,
  PortfolioRepository
} from '@/infra/database';
import { YahooFinanceProvider } from '@/infra/market-data';
import {
  CreateAssetService,
  DeleteAssetService,
  UpdateAssetService
} from '@/services/asset';

import { CreateAssetController } from './CreateAssetController';
import { DeleteAssetController } from './DeleteAssetController';
import { UpdateAssetController } from './UpdateAssetController';

export const createAssetControllerHandler = (req: Request, res: Response) => {
  const assetRepository = AssetRepository.getInstance();
  const instrumentRepository = InstrumentRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const marketDataProvider = YahooFinanceProvider.getInstance();

  const createAssetService = CreateAssetService.getInstance(
    assetRepository,
    instrumentRepository,
    portfolioRepository,
    marketDataProvider
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
