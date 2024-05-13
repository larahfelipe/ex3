import type { Request, Response } from 'express';

import {
  AssetRepository,
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';
import {
  CreateAssetService,
  DeleteAssetService,
  GetAllAssetsService,
  GetAssetService,
  UpdateAssetService
} from '@/services/asset';

import { CreateAssetController } from './CreateAssetController';
import { DeleteAssetController } from './DeleteAssetController';
import { GetAllAssetsController } from './GetAllAssetsController';
import { GetAssetController } from './GetAssetController';
import { UpdateAssetController } from './UpdateAssetController';

export const createAssetControllerHandler = (req: Request, res: Response) => {
  const assetRepository = AssetRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();

  const createAssetService = CreateAssetService.getInstance(
    assetRepository,
    portfolioRepository
  );

  const createAssetController =
    CreateAssetController.getInstance(createAssetService);

  return createAssetController.handle(req, res);
};

export const deleteAssetControllerHandler = (req: Request, res: Response) => {
  const assetRepository = AssetRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const transactionRepository = TransactionRepository.getInstance();

  const deleteAssetService = DeleteAssetService.getInstance(
    assetRepository,
    portfolioRepository,
    transactionRepository
  );

  const deleteAssetController =
    DeleteAssetController.getInstance(deleteAssetService);

  return deleteAssetController.handle(req, res);
};

export const getAllAssetsControllerHandler = (req: Request, res: Response) => {
  const assetRepository = AssetRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();

  const getAllAssetsService = GetAllAssetsService.getInstance(
    assetRepository,
    portfolioRepository
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

export const updateAssetControllerHandler = (req: Request, res: Response) => {
  const assetRepository = AssetRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();

  const updateAssetService = UpdateAssetService.getInstance(
    assetRepository,
    portfolioRepository
  );

  const updateAssetController =
    UpdateAssetController.getInstance(updateAssetService);

  return updateAssetController.handle(req, res);
};
