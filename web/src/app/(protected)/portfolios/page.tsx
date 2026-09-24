'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { ConfirmDeletionDialog } from '@/components/confirm-deletion-dialog';
import { EmptyState, LoadingState } from '@/components/data-state';
import { InfoNote } from '@/components/info-note';
import { PageHeader } from '@/components/page-header';
import { PageNavigation } from '@/components/page-navigation';
import { QuerySection } from '@/components/query-section';
import { Button } from '@/components/ui';
import { usePageParam } from '@/hooks/use-page-param';
import {
  selectActivePortfolio,
  useActivePortfolio,
  useCreatePortfolio,
  useDeletePortfolio,
  usePortfolios,
  useUpdatePortfolio
} from '@/hooks/use-portfolio';
import type { Maybe } from '@/types';

import { PortfolioFormDialog } from './_components/portfolio-form-dialog';

type PortfolioDialog =
  | { kind: 'create' }
  | { kind: 'edit'; portfolio: Portfolio }
  | { kind: 'delete'; portfolio: Portfolio };

const FIRST_PAGE = 1;
const PORTFOLIOS_PAGE_SIZE = 10;
const PORTFOLIOS_PAGE_PARAM = 'page';

const STORAGE_BLOCKED_MESSAGE =
  'Your browser blocked saving the active portfolio. Allow site data for this app and try again.';

export default function Portfolios() {
  const [requestedPage, goToPage] = usePageParam(PORTFOLIOS_PAGE_PARAM);
  const [dialog, setDialog] = useState<Maybe<PortfolioDialog>>(null);
  const [deletedId, setDeletedId] = useState<Maybe<string>>(null);

  const newPortfolioButtonRef = useRef<HTMLButtonElement>(null);
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
    if (!deletedId || !listedPortfolios) return;
    if (listedPortfolios.some(({ id }) => id === deletedId)) return;

    setDeletedId(null);
    newPortfolioButtonRef.current?.focus();
  }, [deletedId, listedPortfolios]);

  const closeDialog = () => setDialog(null);

  const openCreateDialog = () => setDialog({ kind: 'create' });

  const activatePortfolio = ({ id, name }: Portfolio) => {
    if (selectActivePortfolio(id))
      toast.success(`${name} is now the active portfolio`);
    else toast.error(STORAGE_BLOCKED_MESSAGE);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolios"
        description="The active portfolio is the one the overview and the assets show"
        action={
          <Button
            ref={newPortfolioButtonRef}
            size="sm"
            className="gap-1.5 max-sm:w-full"
            onClick={openCreateDialog}
          >
            <Plus size={16} aria-hidden="true" />
            New portfolio
          </Button>
        }
      />

      <QuerySection
        title="Your portfolios"
        query={portfoliosQuery}
        errorMessage="Your portfolios could not be loaded"
        loading={<LoadingState label="Loading your portfolios" />}
        isEmpty={({ pagination }) => pagination.total === 0}
        empty={
          <EmptyState
            message="This account has no portfolio yet"
            action={{ label: 'Create a portfolio', onSelect: openCreateDialog }}
          />
        }
      >
        {({ portfolios, pagination: { page, total, totalPages } }) =>
          portfolios.length === 0 ? (
            <EmptyState
              message={`No portfolios on page ${page}`}
              action={{
                label: `Go to page ${totalPages}`,
                onSelect: () => goToPage(totalPages)
              }}
            />
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border">
                <ul
                  aria-busy={portfoliosQuery.isPlaceholderData}
                  className="divide-y"
                >
                  {portfolios.map((portfolio) => {
                    const isActive = portfolio.id === activePortfolio?.id;

                    return (
                      <li
                        key={portfolio.id}
                        className="flex flex-wrap items-center gap-3 px-3 py-3"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="flex flex-wrap items-center gap-2 font-medium wrap-anywhere">
                            {portfolio.name}

                            {isActive && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                Active
                              </span>
                            )}
                          </p>

                          <p className="text-sm text-muted-foreground">
                            {`Base currency ${portfolio.baseCurrency}`}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 max-sm:w-full">
                          {!isActive && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="max-sm:flex-1"
                              aria-label={`Use ${portfolio.name}`}
                              onClick={() => activatePortfolio(portfolio)}
                            >
                              Use
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="max-sm:flex-1"
                            aria-label={`Edit ${portfolio.name}`}
                            onClick={() =>
                              setDialog({ kind: 'edit', portfolio })
                            }
                          >
                            Edit
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive max-sm:flex-1"
                            aria-disabled={total === 1}
                            aria-describedby={
                              total === 1 ? solePortfolioNoteId : undefined
                            }
                            aria-label={`Delete ${portfolio.name}`}
                            onClick={() => {
                              if (total > 1)
                                setDialog({ kind: 'delete', portfolio });
                            }}
                          >
                            Delete
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
                    An account keeps at least one portfolio, so the only one
                    cannot be deleted.
                  </InfoNote>
                )}
              </div>

              {totalPages > FIRST_PAGE && (
                <PageNavigation
                  label="Portfolio pages"
                  page={page}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                />
              )}
            </div>
          )
        }
      </QuerySection>

      {dialog?.kind === 'create' && (
        <PortfolioFormDialog
          target={dialog}
          onCancel={closeDialog}
          onSubmit={async (draft) => {
            await createPortfolio(draft);
            closeDialog();
          }}
        />
      )}

      {dialog?.kind === 'edit' && (
        <PortfolioFormDialog
          target={dialog}
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
          title={`Delete ${dialog.portfolio.name}?`}
          description={
            <>
              {`Every asset and transaction in ${dialog.portfolio.name} is deleted with it. `}

              <strong className="font-medium text-foreground">
                This is permanent and cannot be undone.
              </strong>

              {dialog.portfolio.id === activePortfolio?.id &&
                ' The app then shows your oldest portfolio.'}
            </>
          }
          confirmLabel="Delete portfolio"
          confirmationPhrase={dialog.portfolio.name}
          failureMessage="The portfolio could not be deleted"
          onCancel={closeDialog}
          onConfirm={async () => {
            await deletePortfolio({ portfolioId: dialog.portfolio.id });
            setDeletedId(dialog.portfolio.id);
            closeDialog();
          }}
        />
      )}
    </div>
  );
}
