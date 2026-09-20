import type { ZodError, ZodType } from 'zod';

import { ValidationError } from '@/errors';

export const validate = async <T>(
  schema: ZodType<T>,
  payload: unknown
): Promise<T> => {
  try {
    const parsedPayload = await schema.parseAsync(payload);

    return parsedPayload;
  } catch (e) {
    const { issues } = e as ZodError;
    const parsedMessages = issues.map((issue) => issue.message).join(', ');

    throw new ValidationError(
      parsedMessages,
      issues.map(({ path, message }) => ({
        path: path.map(String).join('.'),
        message
      }))
    );
  }
};
