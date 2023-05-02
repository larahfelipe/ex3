import type { Request, Response } from 'express';

import { PortfolioRepository } from '@/infra/database';
import {
  GetAllPortfoliosService,
  GetPortfolioService
} from '@/services/portfolio';

import { GetAllPortfoliosController } from './GetAllPortfoliosController';
import { GetPortfolioController } from './GetPortfolioController';

export const GetAllPortfoliosControllerHandler = (
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

export const GetPortfolioControllerHandler = (req: Request, res: Response) => {
  const portfolioRepository = PortfolioRepository.getInstance();

  const getPortfolioService =
    GetPortfolioService.getInstance(portfolioRepository);

  const getPortfolioController =
    GetPortfolioController.getInstance(getPortfolioService);

  return getPortfolioController.handle(req, res);
};
