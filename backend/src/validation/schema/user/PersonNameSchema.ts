import { z } from 'zod';

import { boundedTextSchema } from '../BoundedTextSchema';

const PERSON_NAME_MAX_LENGTH = 255;

export const FirstNameSchema = boundedTextSchema(
  'First name',
  PERSON_NAME_MAX_LENGTH
);

/** The last name is optional, so an empty one clears it. */
export const LastNameSchema = z
  .string()
  .trim()
  .max(
    PERSON_NAME_MAX_LENGTH,
    `Last name must have at most ${PERSON_NAME_MAX_LENGTH} characters`
  )
  .transform((lastName) => (lastName === '' ? null : lastName));
