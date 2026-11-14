import { z } from 'zod';

import type { Translator } from '@/i18n/translator';

export const PORTFOLIO_NAME_MAX_LENGTH = 60;

const WHITESPACE_RUN = /\s+/g;

const normalizePortfolioName = (name: string) =>
  name.normalize('NFC').replace(WHITESPACE_RUN, ' ').trim();

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
