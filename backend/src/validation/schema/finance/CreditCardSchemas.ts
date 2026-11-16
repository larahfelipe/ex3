import { z } from 'zod';

import { FinanceLimits, FinanceMessages } from '@/config/Constants';

import { boundedTextSchema } from '../BoundedTextSchema';
import { CardBrandSchema, CreditCardIdSchema } from './FinanceFieldSchemas';

// Twelve or more digits, alone or in groups split by a space or a dash: the
// shape of a card number, which is never stored.
const CARD_NUMBER_PATTERN = /(?:\d[ -]?){12,}/;

const cardDaySchema = (field: string) =>
  z
    .number(`${field} must be a number`)
    .int(`${field} must be an integer`)
    .min(1, `${field} must be at least 1`)
    .max(31, `${field} must be at most 31`);

const CardFieldsSchema = z.object({
  name: boundedTextSchema(
    'Card name',
    FinanceLimits.CARD_NAME_MAX_LENGTH
  ).refine(
    (name) => !CARD_NUMBER_PATTERN.test(name),
    FinanceMessages.CARD_NAME_HAS_NUMBER
  ),
  lastFourDigits: z
    .string('Last four digits must be a string')
    .trim()
    .regex(/^\d{4}$/, 'Last four digits must be exactly 4 digits'),
  brand: CardBrandSchema,
  closingDay: cardDaySchema('Closing day'),
  dueDay: cardDaySchema('Due day')
});

export const CreditCardParamsSchema = z.object({ id: CreditCardIdSchema });

export const CreateCreditCardSchema = CardFieldsSchema.refine(
  ({ closingDay, dueDay }) => closingDay !== dueDay,
  { path: ['dueDay'], message: FinanceMessages.CARD_SAME_DAYS }
);

export const UpdateCreditCardSchema = z.object({
  ...CardFieldsSchema.partial().shape,
  id: CreditCardIdSchema
});
