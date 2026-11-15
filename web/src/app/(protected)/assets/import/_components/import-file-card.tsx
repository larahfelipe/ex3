import { useId, useState, type DragEvent, type FC } from 'react';

import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { ImportFilePayload } from '@/app/api/v1/transaction-imports';
import { TRANSACTION_IMPORT } from '@/common/constants';
import { InfoNote } from '@/components/info-note';
import { SectionHeader } from '@/components/section-header';
import { Card, CardContent } from '@/components/ui';
import { useFormat } from '@/i18n/format';
import {
  base64Of,
  importFileRefusalOf,
  type ImportFileRefusal
} from '@/lib/transaction-import';
import { cn } from '@/lib/utils';

export type ChosenImportFile = ImportFilePayload & Record<'size', number>;

type ImportFileCardProps = Record<'isReading', boolean> &
  Record<'file', ChosenImportFile | null> &
  Record<'error', string | null> &
  Record<'onFileChosen', (file: ChosenImportFile) => void>;

const ACCEPTED_TYPES = [
  ...TRANSACTION_IMPORT.Extensions,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv'
].join(',');

type LocalRefusal = ImportFileRefusal | 'read-failed';

export const ImportFileCard: FC<ImportFileCardProps> = ({
  isReading,
  file,
  error,
  onFileChosen
}) => {
  const t = useTranslations('imports.file');
  const { formatFileSize } = useFormat();
  const headingId = useId();
  const inputId = useId();
  const statusId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const [refusal, setRefusal] = useState<
    (Record<'reason', LocalRefusal> & Record<'size', number>) | null
  >(null);

  const chooseFile = async (chosen: File | undefined) => {
    if (chosen === undefined || isReading) return;

    const reason = importFileRefusalOf(chosen);

    if (reason !== null) {
      setRefusal({ reason, size: chosen.size });
      return;
    }

    try {
      const content = base64Of(new Uint8Array(await chosen.arrayBuffer()));

      setRefusal(null);
      onFileChosen({ name: chosen.name, content, size: chosen.size });
    } catch {
      setRefusal({ reason: 'read-failed', size: chosen.size });
    }
  };

  const dropFile = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void chooseFile(event.dataTransfer.files[0]);
  };

  const refusalMessage =
    refusal === null
      ? null
      : {
          unsupported: t('unsupported'),
          empty: t('empty'),
          'too-large': t('tooLarge', {
            size: formatFileSize(refusal.size),
            limit: formatFileSize(TRANSACTION_IMPORT.FileMaxBytes)
          }),
          'read-failed': t('readFailed')
        }[refusal.reason];
  const shownError = refusalMessage ?? error;

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <Card className="h-full">
        <SectionHeader
          id={headingId}
          title={t('title')}
          description={t('description', {
            size: formatFileSize(TRANSACTION_IMPORT.FileMaxBytes)
          })}
        />

        <CardContent className="space-y-4">
          <label
            htmlFor={inputId}
            className={cn(
              'flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 has-focus-visible:ring-2 has-focus-visible:ring-focus has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background',
              isDragging && 'border-primary bg-primary/10',
              isReading && 'cursor-progress'
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={dropFile}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 ring-inset">
              {isReading ? (
                <Loader2 aria-hidden="true" className="size-5 animate-spin" />
              ) : file ? (
                <FileSpreadsheet aria-hidden="true" className="size-5" />
              ) : (
                <Upload aria-hidden="true" className="size-5" />
              )}
            </span>

            <span className="space-y-1">
              <span className="block text-sm font-semibold">
                {isDragging ? t('drop') : file ? t('change') : t('choose')}
              </span>

              <span
                id={statusId}
                aria-live="polite"
                className="block text-sm text-muted-foreground wrap-anywhere"
              >
                {isReading && file
                  ? t('reading', { name: file.name })
                  : file
                    ? t('chosen', {
                        name: file.name,
                        size: formatFileSize(file.size)
                      })
                    : TRANSACTION_IMPORT.Extensions.join(' · ').toUpperCase()}
              </span>
            </span>

            <input
              id={inputId}
              type="file"
              accept={ACCEPTED_TYPES}
              aria-describedby={statusId}
              aria-disabled={isReading}
              className="sr-only"
              onChange={(event) => {
                void chooseFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>

          {shownError !== null && (
            <p role="alert" className="text-sm text-negative">
              {shownError}
            </p>
          )}

          <InfoNote>{t('privacy')}</InfoNote>
        </CardContent>
      </Card>
    </section>
  );
};
