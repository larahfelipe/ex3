import { z } from 'zod';

/** Mirrors `CreatePortfolioSchema` in the API. */
export const PORTFOLIO_NAME_MAX_LENGTH = 60;

const WHITESPACE_RUN = /\s+/g;

/** Mirrors `normalizePortfolioName` in the API: the name as it is stored. */
const normalizePortfolioName = (name: string) =>
  name.normalize('NFC').replace(WHITESPACE_RUN, ' ').trim();

/** Mirrors `portfolioNameKey` in the API: names with one key are one name for an owner. */
export const portfolioNameKey = (name: string) =>
  normalizePortfolioName(name).toLowerCase();

export const PORTFOLIO_NAME_TAKEN_MESSAGE =
  'You already have a portfolio with this name';

export const PortfolioNameSchema = z
  .string()
  .transform(normalizePortfolioName)
  .pipe(
    z
      .string()
      .min(1, 'Name is required')
      .max(
        PORTFOLIO_NAME_MAX_LENGTH,
        `Name must have at most ${PORTFOLIO_NAME_MAX_LENGTH} characters`
      )
  );
