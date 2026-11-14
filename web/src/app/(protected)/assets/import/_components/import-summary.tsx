import { useId, type FC } from 'react';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { ImportPreview } from '@/app/api/v1/transaction-imports';
import { Metric } from '@/components/financial';
import { InfoNote } from '@/components/info-note';
import { SectionHeader } from '@/components/section-header';
import { Button, Card, CardContent } from '@/components/ui';
import { useFormat } from '@/i18n/format';
import { countGroupsOf, type ImportCountGroup } from '@/lib/transaction-import';
import { cn } from '@/lib/utils';

type ImportSummaryProps = Record<'preview', ImportPreview> &
  Record<'selectedCount', number>;

type ImportConfirmBarProps = Record<'selectedCount', number> &
  Record<'isReplanning' | 'isImporting', boolean> &
  Record<'error', string | null> &
  Record<'onConfirm', VoidFunction>;

const COUNT_GROUPS: ReadonlyArray<ImportCountGroup> = [
  'ready',
  'toReview',
  'alreadyImported',
  'notImportable',
  'ignored'
];

const COUNT_TONES: Partial<Record<ImportCountGroup, string>> = {
  ready: 'text-positive',
  toReview: 'text-warning',
  notImportable: 'text-negative'
};

export const ImportSummary: FC<ImportSummaryProps> = ({
  preview,
  selectedCount
}) => {
  const t = useTranslations('imports');
  const { formatList } = useFormat();
  const headingId = useId();
  const groups = countGroupsOf(preview.counts);

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <Card>
        <SectionHeader
          id={headingId}
          title={t('summary.title')}
          description={t('summary.recognized', {
            formats: formatList(
              preview.file.formats.map((format) => t(`formats.${format}`))
            )
          })}
        />

        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
            <Metric
              label={t('summary.selected')}
              valueClassName="text-2xl font-semibold tabular-nums"
            >
              {selectedCount}
            </Metric>

            {COUNT_GROUPS.map((group) => (
              <Metric
                key={group}
                label={t(`summary.${group}`)}
                valueClassName={cn(
                  'text-2xl font-semibold tabular-nums',
                  groups[group] > 0
                    ? COUNT_TONES[group]
                    : 'text-muted-foreground'
                )}
              >
                {groups[group]}
              </Metric>
            ))}
          </dl>

          {preview.file.formats.includes('b3-movements') && (
            <InfoNote className="mt-5">{t('summary.settlementDates')}</InfoNote>
          )}
        </CardContent>
      </Card>
    </section>
  );
};

export const ImportConfirmBar: FC<ImportConfirmBarProps> = ({
  selectedCount,
  isReplanning,
  isImporting,
  error,
  onConfirm
}) => {
  const t = useTranslations('imports');
  const isBlocked = isReplanning || isImporting || selectedCount === 0;

  return (
    <div className="sticky bottom-4 z-10">
      <Card className="border-primary/30 shadow-lg">
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
          <div className="min-w-0 space-y-1">
            <InfoNote>{t('confirm.note')}</InfoNote>

            <p aria-live="polite" className="text-sm">
              {isReplanning && (
                <span className="text-muted-foreground">
                  {t('summary.replanning')}
                </span>
              )}

              {!isReplanning && error !== null && (
                <span role="alert" className="text-negative">
                  {error}
                </span>
              )}
            </p>
          </div>

          <Button
            className="shrink-0 gap-2 max-sm:w-full"
            aria-disabled={isBlocked}
            onClick={() => {
              if (!isBlocked) onConfirm();
            }}
          >
            {(isReplanning || isImporting) && (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            )}

            {isImporting
              ? t('confirm.importing')
              : isReplanning
                ? t('confirm.pending')
                : t('confirm.submit', { count: selectedCount })}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
