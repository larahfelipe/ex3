import { z } from 'zod';

export const CreateUserSchema = z.object({
  name: z.string().optional(),
  email: z
    .string()
    .email('Email must be a valid email')
    .min(3, 'Email must have at least 3 characters')
    .max(255, 'Email must have at most 255 characters')
    .transform((value) => value.trim().toLowerCase()),
  password: z
    .string()
    .min(3, 'Password must have at least 3 characters')
    .max(255, 'Password must have at most 255 characters')
    .transform((value) => value.trim())
});
