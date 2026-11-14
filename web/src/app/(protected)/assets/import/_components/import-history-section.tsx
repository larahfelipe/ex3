import { useState, type FC } from 'react';

import { Undo2 } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { Portfolio } from '@/app/api/v1/portfolios';
import type { TransactionImport } from '@/app/api/v1/transaction-imports';
import { ConfirmDeletionDialog } from '@/components/confirm-deletion-dialog';
import { EmptyState, LoadingState } from '@/components/data-state';
import { PageNavigation } from '@/components/page-navigation';
import { QuerySection } from '@/components/query-section';
import {
  Button,
  DialogPresence,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader
} from '@/components/ui';
import { usePageParam } from '@/hooks/use-page-param';
import {
  useTransactionImports,
  useUndoTransactionImport
} from '@/hooks/use-transaction-imports';
import { useFormat } from '@/i18n/format';
import { FIRST_PAGE } from '@/lib/pagination';

type ImportHistorySectionProps = Record<'portfolio', Portfolio>;

const IMPORTS_PAGE_SIZE = 10;
const IMPORTS_PAGE_PARAM = 'importsPage';

export const ImportHistorySection: FC<ImportHistorySectionProps> = ({
  portfolio
}) => {
  const t = useTranslations('imports.history');
  const tFormats = useTranslations('imports.formats');
  const { formatList, formatQuoteTime } = useFormat();
  const [requestedPage, goToPage] = usePageParam(IMPORTS_PAGE_PARAM);
  const [undoing, setUndoing] = useState<TransactionImport | null>(null);
  const { mutateAsync: undoImport } = useUndoTransactionImport(portfolio);

  const importsQuery = useTransactionImports(portfolio, {
    page: requestedPage,
    pageSize: IMPORTS_PAGE_SIZE
  });

  return (
    <>
      <QuerySection
        title={t('title')}
        query={importsQuery}
        errorMessage={t('loadFailed')}
        loading={<LoadingState label={t('loading')} />}
        isEmpty={({ total }) => total === 0}
        empty={<EmptyState message={t('empty')} />}
      >
        {({ items, page, totalPages }) =>
          items.length === 0 ? (
            <EmptyState
              message={t('emptyPage', { page })}
              action={{
                label: t('goToPage', { page: totalPages }),
                onSelect: () => goToPage(totalPages)
              }}
            />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('description')}
              </p>

              <Table label={t('label')}>
                <TableCaption className="sr-only">{t('caption')}</TableCaption>

                <TableHeader>
                  <TableRow>
                    <TableHead>{t('columns.date')}</TableHead>

                    <TableHead>{t('columns.file')}</TableHead>

                    <TableHead className="text-right max-sm:hidden">
                      {t('columns.transactions')}
                    </TableHead>

                    <TableHead>{t('columns.status')}</TableHead>

                    <TableHead>
                      <span className="sr-only">{t('undoDialog.confirm')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {items.map((transactionImport) => (
                    <TableRow key={transactionImport.id}>
                      <TableRowHeader className="whitespace-nowrap">
                        <time dateTime={transactionImport.createdAt}>
                          {formatQuoteTime(transactionImport.createdAt)}
                        </time>
                      </TableRowHeader>

                      <TableCell className="min-w-40">
                        <span className="block font-medium wrap-anywhere">
                          {transactionImport.fileName}
                        </span>

                        <span className="block text-xs text-muted-foreground">
                          {formatList(
                            transactionImport.formats.map((format) =>
                              tFormats(format)
                            )
                          )}
                        </span>
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap tabular-nums max-sm:hidden">
                        {t('transactions', {
                          imported: transactionImport.importedCount,
                          rows: transactionImport.rowCount
                        })}
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        {transactionImport.undoneAt === null ? (
                          <span className="text-positive">{t('active')}</span>
                        ) : (
                          <span className="text-muted-foreground">
                            {t('undone', {
                              date: formatQuoteTime(transactionImport.undoneAt)
                            })}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {transactionImport.undoneAt === null && (
                          <Button
                            variant="ghost"
                            size="xs"
                            className="gap-1.5"
                            onClick={() => setUndoing(transactionImport)}
                          >
                            <Undo2 aria-hidden="true" className="size-4" />

                            {t.rich('undo', {
                              file: transactionImport.fileName,
                              hidden: (chunks) => (
                                <span className="sr-only">{chunks}</span>
                              )
                            })}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > FIRST_PAGE && (
                <PageNavigation
                  label={t('pages')}
                  page={page}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                />
              )}
            </div>
          )
        }
      </QuerySection>

      <DialogPresence>
        {undoing !== null && (
          <ConfirmDeletionDialog
            key={undoing.id}
            title={t('undoDialog.title', { file: undoing.fileName })}
            description={t('undoDialog.description', {
              count: undoing.transactionCount
            })}
            confirmLabel={t('undoDialog.confirm')}
            cancelLabel={t('undoDialog.cancel')}
            failureMessage={t('undoDialog.failed')}
            onCancel={() => setUndoing(null)}
            onConfirm={async () => {
              await undoImport({ id: undoing.id });
              setUndoing(null);
            }}
          />
        )}
      </DialogPresence>
    </>
  );
};
