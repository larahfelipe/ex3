import { useEffect, useId, useRef, type FC } from 'react';

import Link from 'next/link';

import { CircleCheck } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type {
  CreateTransactionImportResponseData,
  ImportFormatId
} from '@/app/api/v1/transaction-imports';
import { APP_ROUTES } from '@/common/constants';
import { InfoNote } from '@/components/info-note';
import { Button, Card, CardContent } from '@/components/ui';
import { APPEAR_CLASS } from '@/lib/motion';
import { cn } from '@/lib/utils';

type ImportResultCardProps = Record<
  'result',
  CreateTransactionImportResponseData
> &
  Record<'onImportAnother', VoidFunction>;

/** B3's trading statement carries no trade costs, so a result recorded from it says what is left to add. */
const FORMATS_WITHOUT_TRADE_COSTS: ReadonlySet<ImportFormatId> = new Set([
  'b3-trades'
]);

/** Takes focus when it appears, as the preview it replaces held it. */
export const ImportResultCard: FC<ImportResultCardProps> = ({
  result: { transactionImport },
  onImportAnother
}) => {
  const t = useTranslations('imports.result');
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const summary = [
    t('description', {
      count: transactionImport.importedCount,
      file: transactionImport.fileName
    }),
    t('positions', { count: transactionImport.openedInstrumentIds.length })
  ].join(' ');

  return (
    <section
      aria-labelledby={headingId}
      className={cn('min-w-0', APPEAR_CLASS)}
    >
      <Card className="border-positive/30">
        <CardContent className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-start sm:pt-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-positive/10 text-positive ring-1 ring-positive/20 ring-inset">
            <CircleCheck aria-hidden="true" className="size-5" />
          </span>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <h2
                ref={headingRef}
                id={headingId}
                tabIndex={-1}
                className="rounded-sm text-lg font-semibold ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              >
                {t('title')}
              </h2>

              <p className="text-sm text-muted-foreground wrap-anywhere">
                {summary}
              </p>
            </div>

            {transactionImport.formats.some((format) =>
              FORMATS_WITHOUT_TRADE_COSTS.has(format)
            ) && <InfoNote>{t('costsReminder')}</InfoNote>}

            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="max-sm:w-full">
                <Link href={APP_ROUTES.Protected.Assets}>
                  {t('viewAssets')}
                </Link>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                className="max-sm:w-full"
                onClick={onImportAnother}
              >
                {t('importAnother')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};
