import {
  useEffect,
  useId,
  useRef,
  useState,
  type FC,
  type FormEvent
} from 'react';

import { useSearchParams } from 'next/navigation';

import { ArrowDownUp, Plus, Search } from 'lucide-react';

import type { CreateAssetRequestPayload } from '@/app/api/v1/assets';
import type {
  SearchInstrumentsResponseData,
  MarketSearchStatus
} from '@/app/api/v1/instruments';
import { ASSET_DIALOG_ACTIONS, ASSET_DIALOG_PARAMS } from '@/common/constants';
import { replaceUrlQuery } from '@/common/utils';
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
import {
  ApiProxyError,
  isConflictError,
  UNEXPECTED_ERROR_MESSAGE
} from '@/lib/axios';
import type { Maybe } from '@/types';

type AssetAddition = Omit<CreateAssetRequestPayload, 'portfolioId'>;

type AddAssetDialogProps = {
  onCancel: VoidFunction;
  onConfirm: (payload: AssetAddition) => Promise<unknown>;
};

type InstrumentChoice = Record<'key' | 'symbol' | 'name', string> &
  Record<'venue' | 'badge', Maybe<string>> &
  Record<'addition', AssetAddition>;

const SEARCH_MAX_LENGTH = 120;

/**
 * Every search may reach the quote provider, and the API grants a user 30 a
 * minute. Keystrokes come under 300 ms apart while a word is typed, so a pause
 * this long means the user stopped, and a term costs about one request.
 */
const SEARCH_DEBOUNCE_MS = 500;

const CATALOG_SEARCH_PATTERN = /^[\p{L}\p{N} .&'-]+$/u;

const SEARCH_PATTERN_MESSAGE =
  "Search accepts only letters, digits, spaces and . & ' -";

const CHOICE_REQUIRED_MESSAGE = 'Choose one of the instruments found';

const MARKET_UNAVAILABLE_MESSAGE =
  'The market could not be searched right now, so instruments you do not track yet are missing.';

const NEW_LISTING_NOTE =
  'New instruments are added with the name, class and sector the market lists, and only you see them.';

const PRIVATE_BADGE = 'Private';

const NEW_BADGE = 'New';

const venueOf = ({
  market,
  currency
}: Record<'market' | 'currency', Maybe<string>>) =>
  market !== null && currency !== null ? `${market} · ${currency}` : null;

const choicesOf = ({
  instruments,
  listings
}: SearchInstrumentsResponseData): Array<InstrumentChoice> => [
  ...instruments.map((instrument) => ({
    key: `instrument:${instrument.id}`,
    symbol: instrument.symbol,
    name: instrument.name,
    venue: venueOf(instrument),
    badge: instrument.scope === 'PRIVATE' ? PRIVATE_BADGE : null,
    addition: { symbol: instrument.symbol }
  })),
  ...listings.map(({ symbol, name, market, currency }) => ({
    key: `listing:${symbol}:${market}:${currency}`,
    symbol,
    name,
    venue: venueOf({ market, currency }),
    badge: NEW_BADGE,
    addition: { symbol, listing: { market, currency } }
  }))
];

const noMatchMessageOf = (search: string, marketSearch: MarketSearchStatus) =>
  marketSearch === 'SEARCHED'
    ? `Nothing is listed under “${search}”. Check the ticker, as in PETR4, AAPL or BTC.`
    : `No instrument you track matches “${search}”. To add a new one, search by its ticker, as in PETR4.`;

const foundInstrumentsLabel = (count: number) =>
  count === 1 ? '1 instrument found' : `${count} instruments found`;

const submitFailureMessageOf = (
  error: unknown,
  { symbol, addition }: InstrumentChoice
) => {
  if (!(error instanceof ApiProxyError)) return UNEXPECTED_ERROR_MESSAGE;

  return isConflictError(error) && addition.listing === undefined
    ? `${symbol} is already in this portfolio`
    : error.message;
};

/**
 * Only a term the user typed is searched. A single result is chosen for them
 * once it settles, so Enter searches without waiting for the debounce and a
 * second Enter adds what was found.
 */
export const AddAssetDialog: FC<AddAssetDialogProps> = ({
  onCancel,
  onConfirm
}) => {
  const formId = useId();
  const searchId = useId();
  const searchIssueId = useId();
  const searchStatusId = useId();

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState<string | null>(null);
  const [chosenKey, setChosenKey] = useState<Maybe<string>>(null);
  const [submitIssue, setSubmitIssue] = useState<Maybe<string>>(null);
  const [addedSymbol, setAddedSymbol] = useState<Maybe<string>>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchParams = useSearchParams();

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

  const choices = search !== null && results ? choicesOf(results) : [];

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
    if (isAwaitingResults) return 'Searching…';
    if (results === undefined) return '';
    if (choices.length === 0)
      return noMatchMessageOf(search, results.marketSearch);

    return foundInstrumentsLabel(choices.length);
  })();

  const chooseInstrument = (key: string) => {
    setChosenKey(key);
    setSubmitIssue(null);
  };

  const submitChoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (requestedSearch !== search) {
      applySearch(requestedSearch);

      return;
    }

    if (selectedChoice === null) {
      if (!isAwaitingResults && choices.length > 0)
        setSubmitIssue(CHOICE_REQUIRED_MESSAGE);

      return;
    }

    setIsSubmitting(true);

    try {
      await onConfirm(selectedChoice.addition);
      setAddedSymbol(selectedChoice.symbol);
      setSearchInput('');
      applySearch(null);
      searchInputRef.current?.focus();
    } catch (failure) {
      setSubmitIssue(submitFailureMessageOf(failure, selectedChoice));
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

    replaceUrlQuery(params);
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

          <DialogDescription>
            Search by ticker to add any listed instrument, or by name among the
            ones you already track.
          </DialogDescription>
        </DialogHeader>

        <form
          id={formId}
          noValidate
          className="min-w-0 space-y-3"
          onSubmit={submitChoice}
        >
          <div className="space-y-1.5">
            <Label htmlFor={searchId}>Ticker or name</Label>

            <Input
              ref={searchInputRef}
              id={searchId}
              type="search"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="PETR4, AAPL, BTC…"
              maxLength={SEARCH_MAX_LENGTH}
              value={searchInput}
              aria-invalid={!isSearchAccepted}
              aria-describedby={
                isSearchAccepted
                  ? searchStatusId
                  : `${searchIssueId} ${searchStatusId}`
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
                {`${MARKET_UNAVAILABLE_MESSAGE} `}

                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => refetch()}
                >
                  Try again
                </Button>
              </p>
            )}

          {choices.length > 0 && (
            <fieldset aria-busy={isAwaitingResults} className="min-w-0">
              <legend className="sr-only">Instruments found</legend>

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
            <p className="text-xs text-muted-foreground">{NEW_LISTING_NOTE}</p>
          )}

          {submitIssue !== null && (
            <p role="alert" className="text-sm text-negative">
              {submitIssue}
            </p>
          )}
        </form>

        {search !== null && error !== null && results === undefined && (
          <ErrorState message={error.message} onRetry={refetch} />
        )}

        <DialogFooter>
          {addedSymbol && (
            <Button
              variant="ghost"
              className="gap-2 sm:absolute sm:left-6 max-sm:mt-6"
              onClick={handleAddTransaction}
            >
              <Plus size={16} aria-hidden="true" />

              <span>{`Add a ${addedSymbol} transaction?`}</span>
            </Button>
          )}

          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            Add
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
