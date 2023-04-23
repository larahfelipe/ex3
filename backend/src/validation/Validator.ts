import type { ZodError, ZodSchema } from 'zod';

import { BadRequestError } from '@/errors';

export const validate = async <T>(
  schema: ZodSchema<T>,
  payload: unknown
): Promise<T> => {
  try {
    const parsedPayload = await schema.parseAsync(payload);

    return parsedPayload;
  } catch (e) {
    const { issues } = e as ZodError;
    const parsedMessages = issues.map((issue) => issue.message).join(', ');

    throw new BadRequestError(parsedMessages);
  }
};
