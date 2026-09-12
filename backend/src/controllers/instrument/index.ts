import type { Request, Response } from 'express';

import { InstrumentRepository } from '@/infra/database';
import {
  CreateInstrumentService,
  GetAllInstrumentsService,
  UpdateInstrumentService
} from '@/services/instrument';

import { CreateInstrumentController } from './CreateInstrumentController';
import { GetAllInstrumentsController } from './GetAllInstrumentsController';
import { UpdateInstrumentController } from './UpdateInstrumentController';

export const createInstrumentControllerHandler = (
  req: Request,
  res: Response
) => {
  const instrumentRepository = InstrumentRepository.getInstance();

  const createInstrumentService =
    CreateInstrumentService.getInstance(instrumentRepository);

  const createInstrumentController = CreateInstrumentController.getInstance(
    createInstrumentService
  );

  return createInstrumentController.handle(req, res);
};

export const getAllInstrumentsControllerHandler = (
  req: Request,
  res: Response
) => {
  const instrumentRepository = InstrumentRepository.getInstance();

  const getAllInstrumentsService =
    GetAllInstrumentsService.getInstance(instrumentRepository);

  const getAllInstrumentsController = GetAllInstrumentsController.getInstance(
    getAllInstrumentsService
  );

  return getAllInstrumentsController.handle(req, res);
};

export const updateInstrumentControllerHandler = (
  req: Request,
  res: Response
) => {
  const instrumentRepository = InstrumentRepository.getInstance();

  const updateInstrumentService =
    UpdateInstrumentService.getInstance(instrumentRepository);

  const updateInstrumentController = UpdateInstrumentController.getInstance(
    updateInstrumentService
  );

  return updateInstrumentController.handle(req, res);
};
