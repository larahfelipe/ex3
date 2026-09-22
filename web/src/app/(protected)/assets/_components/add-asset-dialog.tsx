import { useEffect, useId, useRef, useState, type FC } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { useSearchParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownUp, Plus, Search } from 'lucide-react';
import { z } from 'zod';

import type { CreateAssetRequestPayload } from '@/app/api/v1/assets';
import { ASSET_DIALOG_ACTIONS, ASSET_DIALOG_PARAMS } from '@/common/constants';
import { updateUrlQuery } from '@/common/utils';
import { ErrorState, LoadingState } from '@/components/data-state';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label
} from '@/components/ui';
import { useInstruments } from '@/hooks/use-instruments';
import {
  ApiProxyError,
  isConflictError,
  UNEXPECTED_ERROR_MESSAGE
} from '@/lib/axios';
import type { Maybe } from '@/types';

import { AddAssetFooter, type AddAssetDialogActions } from './add-asset-footer';
import { InstrumentRegistration } from './instrument-registration';

type AssetAddition = Omit<CreateAssetRequestPayload, 'portfolioId'>;

type AddAssetDialogProps = {
  onCancel: VoidFunction;
  onConfirm: (payload: AssetAddition) => Promise<unknown>;
};

type AddAssetView = Record<'kind', 'catalog' | 'registration'> &
  Record<'search', string>;

type CatalogPickerProps = AddAssetDialogActions & {
  initialSearch: string;
  onConfirm: (payload: AssetAddition) => Promise<unknown>;
  onRegister: (search: string) => void;
};

type AddAssetFormValues = z.infer<typeof AddAssetSchema>;

const AddAssetSchema = z.object({
  symbol: z.string().min(1, 'Choose an instrument from the catalog')
});

const CATALOG_PICKER_LIMIT = 20;

const SEARCH_MAX_LENGTH = 120;

const SEARCH_DEBOUNCE_MS = 300;

const CATALOG_SEARCH_PATTERN = /^[\p{L}\p{N} .&'-]+$/u;

const SEARCH_PATTERN_MESSAGE =
  "Search accepts only letters, digits, spaces and . & ' -";

const EMPTY_CATALOG_MESSAGE =
  'The catalog has no instruments yet. Register the one you want to track.';

const VIEW_DESCRIPTIONS: Record<AddAssetView['kind'], string> = {
  catalog:
    'Choose an instrument to track it in this portfolio, or register one the catalog lacks.',
  registration:
    'Register an instrument the catalog lacks. Only you can see the instruments you register.'
};

const CATALOG_LOAD_FAILURE_MESSAGE =
  'The instrument catalog could not be loaded';

const submitFailureMessageOf = (error: unknown, symbol: string) => {
  if (!(error instanceof ApiProxyError)) return UNEXPECTED_ERROR_MESSAGE;

  return isConflictError(error)
    ? `${symbol} is already in this portfolio`
    : error.message;
};

const foundInstrumentsLabel = (count: number) =>
  count === 1 ? '1 instrument found' : `${count} instruments found`;

const CatalogPicker: FC<CatalogPickerProps> = ({
  initialSearch,
  onConfirm,
  onRegister,
  ...dialogActions
}) => {
  const formId = useId();
  const searchId = useId();
  const searchIssueId = useId();
  const catalogStatusId = useId();

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch.trim() || undefined);

  const {
    control,
    register,
    handleSubmit,
    reset,
    resetField,
    setError,
    clearErrors,
    formState: { errors, isSubmitting }
  } = useForm<AddAssetFormValues>({
    resolver: zodResolver(AddAssetSchema),
    defaultValues: { symbol: '' }
  });

  const selectedSymbol = useWatch({ control, name: 'symbol' });

  const {
    data: catalog,
    isPending,
    isError,
    isPlaceholderData,
    refetch
  } = useInstruments({ search, limit: CATALOG_PICKER_LIMIT });

  const searchTerm = searchInput.trim();
  const isSearchAccepted =
    searchTerm === '' || CATALOG_SEARCH_PATTERN.test(searchTerm);

  const instruments = catalog?.instruments ?? [];
  const matchCount = catalog?.pagination.total ?? 0;

  useEffect(() => {
    const requestedSearch = searchTerm || undefined;

    if (!isSearchAccepted || requestedSearch === search) return;

    const timeout = setTimeout(() => {
      setSearch(requestedSearch);
      resetField('symbol');
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [searchTerm, search, isSearchAccepted, resetField]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const hasNoMatch =
    catalog !== undefined && matchCount === 0 && !isPlaceholderData;

  const catalogStatus = (() => {
    if (isPending) return 'Loading the instrument catalog…';
    if (catalog === undefined) return '';
    if (isPlaceholderData) return 'Searching the catalog…';
    if (matchCount === 0)
      return search === undefined
        ? EMPTY_CATALOG_MESSAGE
        : `No instrument matches “${search}”`;
    if (matchCount > instruments.length)
      return `Showing ${instruments.length} of ${matchCount} instruments. Refine the search to narrow them.`;

    return foundInstrumentsLabel(matchCount);
  })();

  const clearSearch = () => {
    setSearchInput('');
    setSearch(undefined);
    searchInputRef.current?.focus();
  };

  const submitSelection = async ({ symbol }: AddAssetFormValues) => {
    try {
      await onConfirm({ symbol });
      reset();
      searchInputRef.current?.focus();
    } catch (error) {
      setError('root.server', {
        type: 'server',
        message: submitFailureMessageOf(error, symbol)
      });
    }
  };

  return (
    <>
      <div
        role="search"
        aria-label="Instrument catalog"
        className="space-y-1.5"
      >
        <Label htmlFor={searchId}>Search the catalog</Label>

        <Input
          ref={searchInputRef}
          id={searchId}
          type="search"
          autoComplete="off"
          placeholder="Symbol or name"
          maxLength={SEARCH_MAX_LENGTH}
          value={searchInput}
          aria-invalid={!isSearchAccepted}
          aria-describedby={
            isSearchAccepted
              ? catalogStatusId
              : `${searchIssueId} ${catalogStatusId}`
          }
          onChange={({ target }) => setSearchInput(target.value)}
          leftElement={
            <Search
              aria-hidden="true"
              size={16}
              className="text-muted-foreground"
            />
          }
        />

        {!isSearchAccepted && (
          <p id={searchIssueId} className="text-sm text-negative">
            {SEARCH_PATTERN_MESSAGE}
          </p>
        )}
      </div>

      <form id={formId} noValidate onSubmit={handleSubmit(submitSelection)}>
        <fieldset
          aria-busy={isPending || isPlaceholderData}
          className="min-w-0 space-y-2"
        >
          <legend className="mb-1.5 text-sm font-medium leading-none">
            Instrument
          </legend>

          <p
            id={catalogStatusId}
            role="status"
            className="text-sm text-muted-foreground"
          >
            {catalogStatus}
          </p>

          {isPending && (
            <LoadingState
              label="Loading the instrument catalog"
              className="h-48"
            />
          )}

          {isError && catalog === undefined && (
            <ErrorState
              message={CATALOG_LOAD_FAILURE_MESSAGE}
              onRetry={refetch}
            />
          )}

          {hasNoMatch && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="h-9 gap-2 max-sm:w-full"
                onClick={() => onRegister(search ?? '')}
              >
                <Plus size={16} aria-hidden="true" />

                <span>
                  {search === undefined
                    ? 'Register an instrument'
                    : `Register “${search}”`}
                </span>
              </Button>

              {search !== undefined && (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 max-sm:w-full"
                  onClick={clearSearch}
                >
                  Clear search
                </Button>
              )}
            </div>
          )}

          {instruments.length > 0 && (
            <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
              {instruments.map(
                ({ id, symbol, name, market, currency, scope }) => (
                  <li key={id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 has-checked:bg-muted/70">
                      <input
                        type="radio"
                        value={symbol}
                        className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        {...register('symbol', {
                          onChange: () => clearErrors('root.server')
                        })}
                      />

                      <span className="font-medium">{symbol}</span>

                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {name}
                      </span>

                      {scope === 'PRIVATE' && (
                        <span className="shrink-0 rounded-sm border px-1.5 text-xs text-muted-foreground">
                          Private
                        </span>
                      )}

                      {market !== null && currency !== null && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {`${market} · ${currency}`}
                        </span>
                      )}
                    </label>
                  </li>
                )
              )}
            </ul>
          )}

          {instruments.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {'Not listed? '}

              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                disabled={isSubmitting}
                onClick={() => onRegister(search ?? '')}
              >
                Register a new instrument
              </Button>
            </p>
          )}

          {errors.symbol?.message !== undefined && (
            <p className="text-sm text-negative">{errors.symbol.message}</p>
          )}

          {errors.root?.server?.message !== undefined && (
            <p role="alert" className="text-sm text-negative">
              {errors.root.server.message}
            </p>
          )}
        </fieldset>
      </form>

      <AddAssetFooter
        formId={formId}
        submitLabel="Confirm"
        isSubmitting={isSubmitting}
        canSubmit={selectedSymbol !== ''}
        {...dialogActions}
      />
    </>
  );
};

export const AddAssetDialog: FC<AddAssetDialogProps> = ({
  onCancel,
  onConfirm
}) => {
  const [view, setView] = useState<AddAssetView>({
    kind: 'catalog',
    search: ''
  });
  const [addedSymbol, setAddedSymbol] = useState<Maybe<string>>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchParams = useSearchParams();

  const confirmAddition = async (payload: AssetAddition) => {
    setIsSubmitting(true);

    try {
      await onConfirm(payload);
      setAddedSymbol(payload.symbol);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTransaction = () => {
    if (!addedSymbol) return;

    onCancel();

    const params = new URLSearchParams(searchParams);

    params.set(ASSET_DIALOG_PARAMS.Symbol, addedSymbol);
    params.set(ASSET_DIALOG_PARAMS.Action, ASSET_DIALOG_ACTIONS.AddTransaction);

    updateUrlQuery(params);
  };

  const dialogActions: AddAssetDialogActions = {
    addedSymbol,
    onAddTransaction: handleAddTransaction,
    onCancel
  };

  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!isSubmitting) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex gap-2 max-sm:justify-center">
            <ArrowDownUp aria-hidden="true" />

            <span>Add asset</span>
          </DialogTitle>

          <DialogDescription>{VIEW_DESCRIPTIONS[view.kind]}</DialogDescription>
        </DialogHeader>

        {view.kind === 'catalog' ? (
          <CatalogPicker
            initialSearch={view.search}
            onConfirm={confirmAddition}
            onRegister={(search) => setView({ kind: 'registration', search })}
            {...dialogActions}
          />
        ) : (
          <InstrumentRegistration
            initialSearch={view.search}
            onConfirm={confirmAddition}
            onSearchCatalog={(search) => setView({ kind: 'catalog', search })}
            {...dialogActions}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
