import type {
  ImportPreviewRow,
  ImportRowStatus
} from '@/app/api/v1/transaction-imports';
import { TRANSACTION_IMPORT } from '@/common/constants';
import type { DecimalString } from '@/types';

import { decimalOfUnits, decimalPlacesOf, unitsOf } from './decimal';

export type ImportFileRefusal = 'unsupported' | 'too-large' | 'empty';

export const importFileRefusalOf = ({
  name,
  size
}: Pick<File, 'name' | 'size'>): ImportFileRefusal | null => {
  const lowerName = name.toLowerCase();

  if (
    !TRANSACTION_IMPORT.Extensions.some((extension) =>
      lowerName.endsWith(extension)
    )
  )
    return 'unsupported';
  if (size === 0) return 'empty';
  if (size > TRANSACTION_IMPORT.FileMaxBytes) return 'too-large';

  return null;
};

/** Below the engines' limit on a call's arguments, which `fromCharCode` spreads the bytes into. */
const BASE64_CHUNK_BYTES = 0x8000;

export const base64Of = (bytes: Uint8Array) => {
  let binary = '';

  for (let start = 0; start < bytes.length; start += BASE64_CHUNK_BYTES)
    binary += String.fromCharCode(
      ...bytes.subarray(start, start + BASE64_CHUNK_BYTES)
    );

  return btoa(binary);
};

const SELECTABLE_STATUSES: ReadonlySet<ImportRowStatus> = new Set([
  'ready',
  'review',
  'possible-duplicate',
  'refused'
]);

export const isSelectableRow = (
  row: Pick<ImportPreviewRow, 'key' | 'status'>
): row is Pick<ImportPreviewRow, 'status'> & Record<'key', string> =>
  row.key !== null && SELECTABLE_STATUSES.has(row.status);

export const rowIdOf = ({
  sheet,
  rowNumber
}: Pick<ImportPreviewRow, 'sheet' | 'rowNumber'>) =>
  `${sheet}\u001f${rowNumber}`;

export type ImportRowFilter = 'all' | 'selected' | 'attention' | 'skipped';

export const IMPORT_ROW_FILTERS: ReadonlyArray<ImportRowFilter> = [
  'all',
  'selected',
  'attention',
  'skipped'
];

const ATTENTION_STATUSES: ReadonlySet<ImportRowStatus> = new Set([
  'review',
  'possible-duplicate',
  'unresolved',
  'refused',
  'rejected'
]);

const SKIPPED_STATUSES: ReadonlySet<ImportRowStatus> = new Set([
  'duplicate',
  'ignored'
]);

export const rowsMatching = (
  rows: ReadonlyArray<ImportPreviewRow>,
  filter: ImportRowFilter,
  selection: ReadonlySet<string>
) => {
  switch (filter) {
    case 'all':
      return rows;
    case 'selected':
      return rows.filter(({ key }) => key !== null && selection.has(key));
    case 'attention':
      return rows.filter(({ status }) => ATTENTION_STATUSES.has(status));
    case 'skipped':
      return rows.filter(({ status }) => SKIPPED_STATUSES.has(status));
  }
};

export type ImportCountGroup =
  'ready' | 'toReview' | 'alreadyImported' | 'notImportable' | 'ignored';

const COUNT_GROUPS: Record<ImportCountGroup, ReadonlyArray<ImportRowStatus>> = {
  ready: ['ready'],
  toReview: ['review', 'possible-duplicate'],
  alreadyImported: ['duplicate'],
  notImportable: ['unresolved', 'refused', 'rejected'],
  ignored: ['ignored']
};

export const countGroupsOf = (counts: Record<ImportRowStatus, number>) =>
  Object.fromEntries(
    Object.entries(COUNT_GROUPS).map(([group, statuses]) => [
      group,
      statuses.reduce((total, status) => total + counts[status], 0)
    ])
  ) as Record<ImportCountGroup, number>;

export const isSameSelection = (
  selection: ReadonlySet<string>,
  keys: ReadonlyArray<string>
) => selection.size === keys.length && keys.every((key) => selection.has(key));

export const costsOf = ({
  fees,
  taxes
}: Record<'fees' | 'taxes', DecimalString>) => {
  const scale = Math.max(decimalPlacesOf(fees), decimalPlacesOf(taxes));

  return decimalOfUnits(unitsOf(fees, scale) + unitsOf(taxes, scale), scale);
};
