import { z } from 'zod';

/** Mirrors `CreatePortfolioSchema` in the API. */
export const PORTFOLIO_NAME_MAX_LENGTH = 60;

export const PortfolioNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(
    PORTFOLIO_NAME_MAX_LENGTH,
    `Name must have at most ${PORTFOLIO_NAME_MAX_LENGTH} characters`
  );
