import { z } from 'zod';

import { FinanceLimits } from '@/config/Constants';
import { NOTIFICATION_KEY_PATTERN } from '@/domain/FinanceNotifications';

import { ReferenceDaySchema } from './FinanceFieldSchemas';

export const FinanceNotificationsQuerySchema = z.object({
  today: ReferenceDaySchema
});

export const MarkFinanceNotificationsSchema = z.object({
  today: ReferenceDaySchema,
  action: z.enum(['READ', 'DISMISS'], 'Action must be READ or DISMISS'),
  keys: z
    .array(
      z
        .string('Notification key must be a string')
        .regex(NOTIFICATION_KEY_PATTERN, 'Notification key is invalid'),
      'Keys must be a list'
    )
    .min(1, 'Keys must name at least one notification')
    .max(
      FinanceLimits.NOTIFICATION_ITEMS_LIMIT,
      `Keys name at most ${FinanceLimits.NOTIFICATION_ITEMS_LIMIT} notifications`
    )
    .optional()
});
