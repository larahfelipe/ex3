import { z } from 'zod';

import { NewPasswordSchema } from './PasswordSchema';

export const CreateUserSchema = z.object({
  name: z.string().optional(),
  email: z
    .email('Email must be a valid email')
    .min(3, 'Email must have at least 3 characters')
    .max(255, 'Email must have at most 255 characters')
    .transform((value) => value.trim().toLowerCase()),
  password: NewPasswordSchema
});
