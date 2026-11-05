import type { FC } from 'react';

import {
  Ban,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleMinus,
  CircleX,
  Copy,
  CopyCheck,
  type LucideIcon
} from 'lucide-react';
import { useTranslations } from 'use-intl';

import type {
  ImportPreviewRow,
  ImportRowStatus
} from '@/app/api/v1/transaction-imports';
import type { Translator } from '@/i18n/translator';
import { cn } from '@/lib/utils';

/** A status is never told by its color alone: each one has its own icon beside its name. */
const STATUS_BADGES: Record<
  ImportRowStatus,
  Record<'tone', string> & Record<'icon', LucideIcon>
> = {
  ready: {
    tone: 'border-positive/40 bg-positive/10 text-positive',
    icon: CircleCheck
  },
  review: {
    tone: 'border-warning/40 bg-warning/10 text-warning',
    icon: CircleHelp
  },
  'possible-duplicate': {
    tone: 'border-warning/40 bg-warning/10 text-warning',
    icon: Copy
  },
  duplicate: {
    tone: 'border-border bg-muted text-muted-foreground',
    icon: CopyCheck
  },
  ignored: {
    tone: 'border-border bg-muted text-muted-foreground',
    icon: CircleMinus
  },
  unresolved: {
    tone: 'border-negative/40 bg-negative/10 text-negative',
    icon: CircleAlert
  },
  refused: {
    tone: 'border-negative/40 bg-negative/10 text-negative',
    icon: Ban
  },
  rejected: {
    tone: 'border-negative/40 bg-negative/10 text-negative',
    icon: CircleX
  }
};

export const ImportStatusBadge: FC<Record<'status', ImportRowStatus>> = ({
  status
}) => {
  const t = useTranslations('imports.rows.statuses');
  const { tone, icon: Icon } = STATUS_BADGES[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border py-0.5 pr-2 pl-1.5 text-xs font-medium whitespace-nowrap',
        tone
      )}
    >
      <Icon aria-hidden className="size-3 shrink-0" />

      {t(status)}
    </span>
  );
};

/** How a statement names a row: its sheet, when the file has several, and the number the spreadsheet shows. */
export const rowReferenceOf = (
  { sheet, rowNumber }: Pick<ImportPreviewRow, 'sheet' | 'rowNumber'>,
  t: Translator<'imports.assets'>
) =>
  sheet === ''
    ? t('rowReferenceWithoutSheet', { row: rowNumber })
    : t('rowReference', { sheet, row: rowNumber });

/**
 * Everything the preview says about a row beyond its status: why it has it,
 * what was derived or cut to become a transaction, and what is wrong with it.
 */
export const rowNotesOf = (
  row: Pick<
    ImportPreviewRow,
    'reason' | 'warnings' | 'problems' | 'matchedTransactionId'
  >,
  t: Translator<'imports.rows'>
) => [
  ...(row.reason === null ? [] : [t(`reasons.${row.reason}`)]),
  ...(row.matchedTransactionId === null ? [] : [t('matched')]),
  ...row.warnings
    .filter((warning) => warning !== row.reason)
    .map((warning) => t(`warnings.${warning}`)),
  ...row.problems.map(({ code, field }) =>
    t(`problems.${code}`, { field: t(`fields.${field ?? 'unknown'}`) })
  )
];
