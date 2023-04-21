import { z } from 'zod';

export const DeleteUserSchema = z.object({
  password: z
    .string()
    .min(3, 'Password must have at least 3 characters')
    .max(255, 'Password must have at most 255 characters')
    .transform((value) => value.trim())
});
