import { z } from 'zod';

import { SUPPORTED_LOCALES } from '@/domain/Locale';

export const LocaleSchema = z.enum(
  SUPPORTED_LOCALES,
  `Locale must be one of ${SUPPORTED_LOCALES.join(', ')}`
);
