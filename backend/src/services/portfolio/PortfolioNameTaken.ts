import { PortfolioMessages } from '@/config';
import { ConflictError } from '@/errors';

/** Carries the `name` path, so a form shows it under the name field. */
export const portfolioNameTakenError = () =>
  new ConflictError(PortfolioMessages.NAME_TAKEN, [
    { path: 'name', message: PortfolioMessages.NAME_TAKEN }
  ]);
