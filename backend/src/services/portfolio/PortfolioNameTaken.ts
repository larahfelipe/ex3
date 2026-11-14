import { PortfolioMessages } from '@/config';
import { ConflictError } from '@/errors';

export const portfolioNameTakenError = () =>
  new ConflictError(PortfolioMessages.NAME_TAKEN, [
    { path: 'name', message: PortfolioMessages.NAME_TAKEN }
  ]);
