import { z } from 'zod';

import { ImportLimits, TransactionImportMessages } from '@/config/Constants';

import { boundedTextSchema } from '../BoundedTextSchema';
import { PageQuerySchema } from '../PaginationQuerySchema';
import { PortfolioScopeSchema } from '../PortfolioScopeSchema';

/** Padded base64, four characters for every three bytes: linear to match. */
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BASE64_MAX_LENGTH = Math.ceil(ImportLimits.FILE_BYTES / 3) * 4;
const IMPORT_KEY = /^[0-9a-f]{64}$/;
const CONTROL_CHARACTER = /\p{Cc}/u;

/** The file in the body, read in memory and never stored; its name is only shown back. */
const ImportFileSchema = z.object({
  name: boundedTextSchema(
    'File name',
    ImportLimits.FILE_NAME_MAX_LENGTH
  ).refine(
    (name) => !CONTROL_CHARACTER.test(name),
    'File name must not contain control characters'
  ),
  content: z
    .string()
    .min(1, TransactionImportMessages.NO_ROWS)
    .max(BASE64_MAX_LENGTH, TransactionImportMessages.FILE_TOO_LARGE)
    .regex(BASE64, 'File content must be encoded in base64')
});

const ImportKeysSchema = z
  .array(z.string().regex(IMPORT_KEY, 'Import key must be a SHA-256 digest'))
  .max(
    ImportLimits.DATA_ROWS,
    `At most ${ImportLimits.DATA_ROWS} rows can be selected`
  );

export const PreviewTransactionImportSchema = z.object({
  ...PortfolioScopeSchema.shape,
  file: ImportFileSchema,
  selectedKeys: ImportKeysSchema.optional()
});

export const CreateTransactionImportSchema = z.object({
  ...PortfolioScopeSchema.shape,
  file: ImportFileSchema,
  selectedKeys: ImportKeysSchema.min(1, 'Select at least one row to import')
});

export const GetTransactionImportsQuerySchema = z.object({
  ...PortfolioScopeSchema.shape,
  ...PageQuerySchema.shape
});

export const UndoTransactionImportSchema = z.object({
  id: z.uuid('Import id must be a UUID')
});
