import { z } from 'zod';

import { SubmittedPasswordSchema } from './PasswordSchema';

export const DeleteUserSchema = z.object({
  password: SubmittedPasswordSchema
});
