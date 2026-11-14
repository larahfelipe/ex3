'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { Plus, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { ConfirmDeletionDialog } from '@/components/confirm-deletion-dialog';
import { EmptyState, LoadingState } from '@/components/data-state';
import { InfoNote } from '@/components/info-note';
import { PageHeader } from '@/components/page-header';
import { PageNavigation } from '@/components/page-navigation';
import { QuerySection } from '@/components/query-section';
import { Button, DialogPresence } from '@/components/ui';
import { usePageParam } from '@/hooks/use-page-param';
import {
  selectActivePortfolio,
  useActivePortfolio,
  useCreatePortfolio,
  useDeletePortfolio,
  usePortfolios,
  useUpdatePortfolio
} from '@/hooks/use-portfolio';
import { FIRST_PAGE } from '@/lib/pagination';
import type { Maybe } from '@/types';

import { PortfolioFormDialog } from './_components/portfolio-form-dialog';
import { PortfolioTotalValue } from './_components/portfolio-total-value';

type PortfolioDialog =
  | { kind: 'create' }
  | { kind: 'edit'; portfolio: Portfolio }
  | { kind: 'delete'; portfolio: Portfolio };

const PORTFOLIOS_PAGE_SIZE = 10;
const PORTFOLIOS_PAGE_PARAM = 'page';

export default function Portfolios() {
  const [requestedPage, goToPage] = usePageParam(PORTFOLIOS_PAGE_PARAM);
  const [dialog, setDialog] = useState<Maybe<PortfolioDialog>>(null);
  const t = useTranslations('portfolios');
  const tNavigation = useTranslations('navigation.pages');
  const tActions = useTranslations('common.actions');

  const newPortfolioButtonRef = useRef<HTMLButtonElement>(null);
  const deletedIdRef = useRef<Maybe<string>>(null);
  const solePortfolioNoteId = useId();

  const portfoliosQuery = usePortfolios({
    page: requestedPage,
    limit: PORTFOLIOS_PAGE_SIZE
  });
  const { data: activePortfolio } = useActivePortfolio();

  const { mutateAsync: createPortfolio } = useCreatePortfolio();
  const { mutateAsync: updatePortfolio } = useUpdatePortfolio();
  const { mutateAsync: deletePortfolio } = useDeletePortfolio();

  const listedPortfolios = portfoliosQuery.data?.portfolios;

  useEffect(() => {
    const deletedId = deletedIdRef.current;

    if (!deletedId || dialog !== null || !listedPortfolios) return;
    if (listedPortfolios.some(({ id }) => id === deletedId)) return;

    deletedIdRef.current = null;
    newPortfolioButtonRef.current?.focus();
  }, [dialog, listedPortfolios]);

  const namesOtherThan = (portfolioId: Maybe<Portfolio['id']>) =>
    (listedPortfolios ?? [])
      .filter(({ id }) => id !== portfolioId)
      .map(({ name }) => name);

  const closeDialog = () => setDialog(null);

  const openCreateDialog = () => setDialog({ kind: 'create' });

  const activatePortfolio = ({ id, name }: Portfolio) => {
    if (selectActivePortfolio(id)) toast.success(t('activated', { name }));
    else toast.error(t('storageBlocked'));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNavigation('portfolios')}
        description={t('description')}
        action={
          <Button
            ref={newPortfolioButtonRef}
            size="sm"
            className="gap-1.5 max-sm:w-full"
            onClick={openCreateDialog}
          >
            <Plus size={16} aria-hidden="true" />

            {t('newPortfolio')}
          </Button>
        }
      />

      <QuerySection
        title={t('listTitle')}
        query={portfoliosQuery}
        errorMessage={t('loadFailed')}
        loading={<LoadingState label={t('loading')} />}
        isEmpty={({ pagination }) => pagination.total === 0}
        empty={
          <EmptyState
            icon={Wallet}
            title={t('emptyTitle')}
            message={t('empty')}
            action={{ label: t('createFirst'), onSelect: openCreateDialog }}
          />
        }
      >
        {({ portfolios, pagination: { page, total, totalPages } }) =>
          portfolios.length === 0 ? (
            <EmptyState
              message={t('emptyPage', { page })}
              action={{
                label: t('goToPage', { page: totalPages }),
                onSelect: () => goToPage(totalPages)
              }}
            />
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border">
                <ul
                  aria-busy={portfoliosQuery.isPlaceholderData}
                  className="divide-y sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                >
                  {portfolios.map((portfolio) => {
                    const isActive = portfolio.id === activePortfolio?.id;

                    return (
                      <li
                        key={portfolio.id}
                        className="flex flex-wrap items-center gap-3 px-3 py-3 sm:col-span-3 sm:grid sm:grid-cols-subgrid"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="flex flex-wrap items-center gap-2 font-medium wrap-anywhere">
                            {portfolio.name}

                            {isActive && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                {t('active')}
                              </span>
                            )}
                          </p>

                          <p className="text-sm text-muted-foreground">
                            {t('baseCurrency', {
                              currency: portfolio.baseCurrency
                            })}
                          </p>
                        </div>

                        <PortfolioTotalValue portfolio={portfolio} />

                        <div className="flex flex-wrap gap-2 max-sm:w-full sm:justify-end">
                          {!isActive && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="max-sm:flex-1"
                              aria-label={t('useNamed', {
                                name: portfolio.name
                              })}
                              onClick={() => activatePortfolio(portfolio)}
                            >
                              {t('use')}
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="max-sm:flex-1"
                            aria-label={t('editNamed', {
                              name: portfolio.name
                            })}
                            onClick={() =>
                              setDialog({ kind: 'edit', portfolio })
                            }
                          >
                            {tActions('edit')}
                          </Button>

                          <Button
                            variant="destructive-subtle"
                            size="sm"
                            className="max-sm:flex-1"
                            aria-disabled={total === 1}
                            aria-describedby={
                              total === 1 ? solePortfolioNoteId : undefined
                            }
                            aria-label={t('deleteNamed', {
                              name: portfolio.name
                            })}
                            onClick={() => {
                              if (total > 1)
                                setDialog({ kind: 'delete', portfolio });
                            }}
                          >
                            {tActions('delete')}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {total === 1 && (
                  <InfoNote
                    id={solePortfolioNoteId}
                    className="border-t bg-muted/50 px-3 py-2.5"
                  >
                    {t('soleNote')}
                  </InfoNote>
                )}
              </div>

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
        {dialog?.kind === 'create' && (
          <PortfolioFormDialog
            key="create"
            target={dialog}
            takenNames={namesOtherThan(null)}
            onCancel={closeDialog}
            onSubmit={async (draft) => {
              await createPortfolio(draft);
              closeDialog();
            }}
          />
        )}

        {dialog?.kind === 'edit' && (
          <PortfolioFormDialog
            key={`edit-${dialog.portfolio.id}`}
            target={dialog}
            takenNames={namesOtherThan(dialog.portfolio.id)}
            onCancel={closeDialog}
            onSubmit={async (draft) => {
              await updatePortfolio({
                ...draft,
                portfolioId: dialog.portfolio.id
              });
              closeDialog();
            }}
          />
        )}

        {dialog?.kind === 'delete' && (
          <ConfirmDeletionDialog
            key={`delete-${dialog.portfolio.id}`}
            title={t('deletion.title', { name: dialog.portfolio.name })}
            description={
              <>
                {`${t('deletion.description', { name: dialog.portfolio.name })} `}

                <strong className="font-medium text-foreground">
                  {t('deletion.permanent')}
                </strong>

                {dialog.portfolio.id === activePortfolio?.id &&
                  ` ${t('deletion.activeFallback')}`}
              </>
            }
            confirmLabel={t('deletion.confirm')}
            confirmationPhrase={dialog.portfolio.name}
            failureMessage={t('deletion.failed')}
            onCancel={closeDialog}
            onConfirm={async () => {
              await deletePortfolio({ portfolioId: dialog.portfolio.id });
              deletedIdRef.current = dialog.portfolio.id;
              closeDialog();
            }}
          />
        )}
      </DialogPresence>
    </div>
  );
}
