import type { Request, Response } from 'express';

import { PortfolioRepository } from '@/infra/database';
import {
  CreatePortfolioService,
  GetAllPortfoliosService,
  GetPortfolioService
} from '@/services/portfolio';

import { CreatePortfolioController } from './CreatePortfolioController';
import { GetAllPortfoliosController } from './GetAllPortfoliosController';
import { GetPortfolioController } from './GetPortfolioController';

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
