import { z } from 'zod';

export const boundedTextSchema = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${field} must have at least 1 character`)
    .max(maxLength, `${field} must have at most ${maxLength} characters`);
