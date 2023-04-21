import { z } from 'zod';

export const UpdateUserSchema = z.object({
  name: z.string().optional(),
  oldPassword: z
    .string()
    .min(3, 'Password must have at least 3 characters')
    .max(255, 'Password must have at most 255 characters')
    .transform((value) => value.trim())
    .optional(),
  newPassword: z
    .string()
    .min(3, 'Password must have at least 3 characters')
    .max(255, 'Password must have at most 255 characters')
    .transform((value) => value.trim())
    .optional()
});
