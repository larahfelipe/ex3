import { z } from 'zod';

import { PerformanceRanges } from '@/domain/PortfolioPerformance';

import { AssetSymbolSchema } from '../asset/AssetSymbolSchema';
import { PortfolioScopeSchema } from '../PortfolioScopeSchema';

const PERFORMANCE_RANGES = Object.values(PerformanceRanges);

export const GetPortfolioPerformanceSchema = z.object({
  ...PortfolioScopeSchema.shape,
  range: z
    .enum(
      PERFORMANCE_RANGES,
      `Range must be one of ${PERFORMANCE_RANGES.join(', ')}`
    )
    .default(PerformanceRanges.ONE_YEAR),
  benchmark: AssetSymbolSchema.optional()
});
