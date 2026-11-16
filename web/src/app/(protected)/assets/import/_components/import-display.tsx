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
import { STATUS_TONES } from '@/common/constants';
import type { Translator } from '@/i18n/translator';
import { cn } from '@/lib/utils';

const STATUS_BADGES: Record<
  ImportRowStatus,
  Record<'tone', string> & Record<'icon', LucideIcon>
> = {
  ready: {
    tone: STATUS_TONES.success,
    icon: CircleCheck
  },
  review: {
    tone: STATUS_TONES.warning,
    icon: CircleHelp
  },
  'possible-duplicate': {
    tone: STATUS_TONES.warning,
    icon: Copy
  },
  duplicate: {
    tone: STATUS_TONES.inactive,
    icon: CopyCheck
  },
  ignored: {
    tone: STATUS_TONES.inactive,
    icon: CircleMinus
  },
  unresolved: {
    tone: STATUS_TONES.error,
    icon: CircleAlert
  },
  refused: {
    tone: STATUS_TONES.error,
    icon: Ban
  },
  rejected: {
    tone: STATUS_TONES.error,
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

export const rowReferenceOf = (
  { sheet, rowNumber }: Pick<ImportPreviewRow, 'sheet' | 'rowNumber'>,
  t: Translator<'imports.assets'>
) =>
  sheet === ''
    ? t('rowReferenceWithoutSheet', { row: rowNumber })
    : t('rowReference', { sheet, row: rowNumber });

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
