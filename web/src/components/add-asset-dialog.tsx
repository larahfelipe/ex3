import {
  useEffect,
  useId,
  useRef,
  useState,
  type FC,
  type SubmitEvent
} from 'react';

import { ArrowDownUp, Search } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { CreateAssetRequestPayload } from '@/app/api/v1/assets';
import type {
  SearchInstrumentsResponseData,
  MarketSearchStatus
} from '@/app/api/v1/instruments';
import { ErrorState } from '@/components/data-state';
import { SubmitButton } from '@/components/submit-button';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label
} from '@/components/ui';
import { useInstrumentSearch } from '@/hooks/use-instruments';
import type { Translator } from '@/i18n/translator';
import { apiErrorMessageOf } from '@/lib/api-error-message';
import { ApiProxyError, isConflictError } from '@/lib/axios';
import type { Maybe } from '@/types';

type AssetAddition = Omit<CreateAssetRequestPayload, 'portfolioId'>;

type AddAssetDialogProps = {
  onCancel: VoidFunction;
  onConfirm: (payload: AssetAddition) => Promise<unknown>;
};

type InstrumentChoice = Record<'key' | 'symbol' | 'name', string> &
  Record<'venue' | 'badge', Maybe<string>> &
  Record<'addition', AssetAddition>;

type AddAssetTranslator = Translator<'investments.assets.add'>;

const SEARCH_MAX_LENGTH = 120;

/**
 * Every search may reach the quote provider, and the API grants a user 30 a
 * minute. Keystrokes come under 300 ms apart while a word is typed, so a pause
 * this long means the user stopped, and a term costs about one request.
 */
const SEARCH_DEBOUNCE_MS = 500;

/**
 * Rewrites the input's own value before React reads it, so the caret stays
 * where the person was typing or pasting instead of jumping to the end.
 */
const upperCaseInPlace = (input: HTMLInputElement) => {
  const { value, selectionStart, selectionEnd } = input;
  const upperCased = value.toUpperCase();

  if (upperCased !== value) {
    input.value = upperCased;
    input.setSelectionRange(selectionStart, selectionEnd);
  }

  return upperCased;
};

/** A composition in progress (an accent or an IME) is left alone until it ends, or its pending text would be replaced mid-way. */
const isComposing = (event: Event) =>
  event instanceof InputEvent && event.isComposing;

const CATALOG_SEARCH_PATTERN = /^[\p{L}\p{N} .&'-]+$/u;

const venueOf = ({
  market,
  currency
}: Record<'market' | 'currency', Maybe<string>>) =>
  market !== null && currency !== null ? `${market} · ${currency}` : null;

const choicesOf = (
  { instruments, listings }: SearchInstrumentsResponseData,
  t: AddAssetTranslator
): Array<InstrumentChoice> => [
  ...instruments.map((instrument) => ({
    key: `instrument:${instrument.id}`,
    symbol: instrument.symbol,
    name: instrument.name,
    venue: venueOf(instrument),
    badge: instrument.scope === 'PRIVATE' ? t('privateBadge') : null,
    addition: { symbol: instrument.symbol }
  })),
  ...listings.map(({ symbol, name, market, currency }) => ({
    key: `listing:${symbol}:${market}:${currency}`,
    symbol,
    name,
    venue: venueOf({ market, currency }),
    badge: t('newBadge'),
    addition: { symbol, listing: { market, currency } }
  }))
];

const noMatchMessageOf = (
  search: string,
  marketSearch: MarketSearchStatus,
  t: AddAssetTranslator
) =>
  marketSearch === 'SEARCHED'
    ? t('noListing', { search })
    : t('noTracked', { search });

const submitFailureMessageOf = (
  error: unknown,
  { symbol, addition }: InstrumentChoice,
  t: AddAssetTranslator,
  tErrors: Translator<'errors'>
) =>
  error instanceof ApiProxyError &&
  isConflictError(error) &&
  addition.listing === undefined
    ? t('alreadyHeld', { symbol })
    : apiErrorMessageOf(error, tErrors, t('failed'));

/**
 * Only a term the user typed is searched. A single result is chosen for them
 * once it settles, so Enter searches without waiting for the debounce and a
 * second Enter adds what was found.
 */
export const AddAssetDialog: FC<AddAssetDialogProps> = ({
  onCancel,
  onConfirm
}) => {
  const t = useTranslations('investments.assets.add');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const formId = useId();
  const searchId = useId();
  const searchIssueId = useId();
  const searchStatusId = useId();

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState<string | null>(null);
  const [chosenKey, setChosenKey] = useState<Maybe<string>>(null);
  const [submitIssue, setSubmitIssue] = useState<Maybe<string>>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: results,
    error,
    isPending,
    isPlaceholderData,
    refetch
  } = useInstrumentSearch(search);

  const searchTerm = searchInput.trim();
  const isSearchAccepted =
    searchTerm === '' || CATALOG_SEARCH_PATTERN.test(searchTerm);
  const requestedSearch = isSearchAccepted ? searchTerm || null : search;

  const isAwaitingResults =
    requestedSearch !== search ||
    isPlaceholderData ||
    (search !== null && isPending);

  const choices = search !== null && results ? choicesOf(results, t) : [];

  const selectedChoice =
    choices.find(({ key }) => key === chosenKey) ??
    (!isAwaitingResults && choices.length === 1 ? choices[0] : null);

  const hasListingChoice = choices.some(
    ({ addition }) => addition.listing !== undefined
  );

  const applySearch = (nextSearch: string | null) => {
    setSearch(nextSearch);
    setChosenKey(null);
    setSubmitIssue(null);
  };

  useEffect(() => {
    if (requestedSearch === search) return;

    const timeout = setTimeout(() => {
      setSearch(requestedSearch);
      setChosenKey(null);
      setSubmitIssue(null);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [requestedSearch, search]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const searchStatus = (() => {
    if (search === null) return '';
    if (isAwaitingResults) return t('searching');
    if (results === undefined) return '';
    if (choices.length === 0)
      return noMatchMessageOf(search, results.marketSearch, t);

    return t('found', { count: choices.length });
  })();

  const chooseInstrument = (key: string) => {
    setChosenKey(key);
    setSubmitIssue(null);
  };

  const submitChoice = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (requestedSearch !== search) {
      applySearch(requestedSearch);

      return;
    }

    if (selectedChoice === null) {
      if (!isAwaitingResults && choices.length > 0)
        setSubmitIssue(t('choiceRequired'));

      return;
    }

    setIsSubmitting(true);

    try {
      await onConfirm(selectedChoice.addition);
    } catch (failure) {
      setSubmitIssue(
        submitFailureMessageOf(failure, selectedChoice, t, tErrors)
      );
    } finally {
      setIsSubmitting(false);
    }
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

            <span>{t('title')}</span>
          </DialogTitle>

          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <form
          id={formId}
          noValidate
          className="min-w-0 space-y-3"
          onSubmit={submitChoice}
        >
          <div className="space-y-1.5">
            <Label htmlFor={searchId}>{t('search')}</Label>

            <Input
              ref={searchInputRef}
              id={searchId}
              type="search"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={t('searchPlaceholder')}
              maxLength={SEARCH_MAX_LENGTH}
              value={searchInput}
              aria-invalid={!isSearchAccepted}
              aria-describedby={
                isSearchAccepted
                  ? searchStatusId
                  : `${searchIssueId} ${searchStatusId}`
              }
              onChange={({ target, nativeEvent }) =>
                setSearchInput(
                  isComposing(nativeEvent)
                    ? target.value
                    : upperCaseInPlace(target)
                )
              }
              onCompositionEnd={({ currentTarget }) =>
                setSearchInput(upperCaseInPlace(currentTarget))
              }
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
                {t('searchPattern')}
              </p>
            )}
          </div>

          <p
            id={searchStatusId}
            role="status"
            className="text-sm text-muted-foreground empty:hidden"
          >
            {searchStatus}
          </p>

          {search !== null &&
            !isAwaitingResults &&
            results?.marketSearch === 'UNAVAILABLE' && (
              <p className="text-sm text-muted-foreground">
                {t.rich('marketUnavailable', {
                  retry: (chunks) => (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => refetch()}
                    >
                      {chunks}
                    </Button>
                  )
                })}
              </p>
            )}

          {choices.length > 0 && (
            <fieldset aria-busy={isAwaitingResults} className="min-w-0">
              <legend className="sr-only">{t('results')}</legend>

              <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
                {choices.map((choice) => (
                  <li key={choice.key}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 has-checked:bg-muted/70">
                      <input
                        type="radio"
                        name={formId}
                        value={choice.key}
                        checked={selectedChoice?.key === choice.key}
                        className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        onChange={() => chooseInstrument(choice.key)}
                      />

                      <span className="font-medium">{choice.symbol}</span>

                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {choice.name}
                      </span>

                      {choice.badge !== null && (
                        <span className="shrink-0 rounded-sm border px-1.5 text-xs text-muted-foreground">
                          {choice.badge}
                        </span>
                      )}

                      {choice.venue !== null && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {choice.venue}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {hasListingChoice && (
            <p className="text-xs text-muted-foreground">
              {t('newListingNote')}
            </p>
          )}

          {submitIssue !== null && (
            <p role="alert" className="text-sm text-negative">
              {submitIssue}
            </p>
          )}
        </form>

        {search !== null && error !== null && results === undefined && (
          <ErrorState
            message={apiErrorMessageOf(error, tErrors, t('searchFailed'))}
            onRetry={refetch}
          />
        )}

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            {tActions('cancel')}
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            {t('submit')}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
