import { z } from 'zod';

import type { Translator } from '@/i18n/translator';

/** Mirrors `CreatePortfolioSchema` in the API. */
export const PORTFOLIO_NAME_MAX_LENGTH = 60;

const WHITESPACE_RUN = /\s+/g;

/** Mirrors `normalizePortfolioName` in the API: the name as it is stored. */
const normalizePortfolioName = (name: string) =>
  name.normalize('NFC').replace(WHITESPACE_RUN, ' ').trim();

/** Mirrors `portfolioNameKey` in the API: names with one key are one name for an owner. */
export const portfolioNameKey = (name: string) =>
  normalizePortfolioName(name).toLowerCase();

export const portfolioNameSchemaFor = (t: Translator<'validation'>) =>
  z
    .string()
    .transform(normalizePortfolioName)
    .pipe(
      z
        .string()
        .min(1, t('name.required'))
        .max(
          PORTFOLIO_NAME_MAX_LENGTH,
          t('name.tooLong', { max: PORTFOLIO_NAME_MAX_LENGTH })
        )
    );
