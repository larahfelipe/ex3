import { useEffect, useId, useMemo, type FC } from 'react';
import { useForm, useWatch, type FieldErrors } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Search } from 'lucide-react';
import { z } from 'zod';

import type { CreateAssetRequestPayload } from '@/app/api/v1/assets';
import type { GetInstrumentOptionsResponseData } from '@/app/api/v1/instruments';
import { CURRENCIES, INSTRUMENT_TYPE_LABELS } from '@/common/constants';
import { ErrorState, LoadingState } from '@/components/data-state';
import { ChoiceField, FormField } from '@/components/form-field';
import {
  Button,
  Input,
  SegmentedControl,
  SegmentedControlItem
} from '@/components/ui';
import { useInstrumentOptions } from '@/hooks/use-instruments';
import { ApiProxyError, isConflictError, isDomainError } from '@/lib/axios';
import { presentSubmitError } from '@/lib/submit-error';

import { AddAssetFooter, type AddAssetDialogActions } from './add-asset-footer';

type AssetRegistration = Required<
  Omit<CreateAssetRequestPayload, 'portfolioId'>
>;

type InstrumentRegistrationProps = AddAssetDialogActions & {
  initialSearch: string;
  onConfirm: (registration: AssetRegistration) => Promise<unknown>;
  onSearchCatalog: (search: string) => void;
};

type RegistrationFormProps = InstrumentRegistrationProps &
  Record<'options', GetInstrumentOptionsResponseData>;

type CatalogReturnProps = Record<'onSelect', VoidFunction> &
  Partial<Record<'disabled', boolean>>;

type RegistrationField = (typeof REGISTRATION_FIELDS)[number];

type RegistrationFormInput = Record<RegistrationField, string>;

const REGISTRATION_FIELDS = [
  'symbol',
  'name',
  'type',
  'market',
  'currency',
  'sector'
] as const;

/** Mirrors `NewAssetSymbolSchema` and `InstrumentAttributesSchema` in the API. */
const SYMBOL_MAX_LENGTH = 6;

const SYMBOL_PATTERN = /^[A-Z0-9]+$/;

const NAME_MAX_LENGTH = 120;

const SECTOR_MAX_LENGTH = 60;

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

const INSTRUMENT_PATH_PREFIX = 'instrument.';

const CONFLICT_ERROR_TYPE = 'conflict';

const EMPTY_REGISTRATION: RegistrationFormInput = {
  symbol: '',
  name: '',
  type: '',
  market: '',
  currency: '',
  sector: ''
};

const OFFERED_CURRENCIES = Object.values(CURRENCIES).map(({ id }) => id);

const ASSET_CLASS_LABELS = new Map<string, string>(
  Object.entries(INSTRUMENT_TYPE_LABELS)
);

const OPTIONS_LOAD_FAILURE_MESSAGE =
  'The registration options could not be loaded';

const isSymbolLike = (term: string) =>
  term.length <= SYMBOL_MAX_LENGTH && SYMBOL_PATTERN.test(term.toUpperCase());

const isRegistrationField = (path: string): path is RegistrationField =>
  REGISTRATION_FIELDS.some((field) => field === path);

const registrationSchemaOf = ({
  types,
  markets
}: GetInstrumentOptionsResponseData) =>
  z
    .object({
      symbol: z
        .string()
        .trim()
        .toUpperCase()
        .min(1, 'Symbol is required')
        .max(
          SYMBOL_MAX_LENGTH,
          `Symbol must have at most ${SYMBOL_MAX_LENGTH} characters`
        )
        .regex(SYMBOL_PATTERN, 'Symbol must contain only letters and digits'),
      name: z
        .string()
        .trim()
        .min(1, 'Name is required')
        .max(
          NAME_MAX_LENGTH,
          `Name must have at most ${NAME_MAX_LENGTH} characters`
        ),
      type: z.string().refine((type) => types.includes(type), {
        message: 'Choose the asset class'
      }),
      market: z
        .string()
        .refine(
          (market) => markets.some((option) => option.market === market),
          {
            message: 'Choose the market'
          }
        ),
      currency: z.string(),
      sector: z
        .string()
        .trim()
        .max(
          SECTOR_MAX_LENGTH,
          `Sector must have at most ${SECTOR_MAX_LENGTH} characters`
        )
    })
    .transform(
      (
        { symbol, name, type, market, currency, sector },
        context
      ): AssetRegistration => {
        const quotedCurrency =
          markets.find((option) => option.market === market)?.currency ??
          currency;

        if (!CURRENCY_CODE_PATTERN.test(quotedCurrency)) {
          context.addIssue({
            code: 'custom',
            path: ['currency'],
            message: 'Choose the currency'
          });

          return z.NEVER;
        }

        return {
          symbol,
          instrument: {
            name,
            type,
            market,
            currency: quotedCurrency,
            ...(sector !== '' && { sector })
          }
        };
      }
    );

const defaultValuesOf = (initialSearch: string): RegistrationFormInput => {
  const term = initialSearch.trim();

  return isSymbolLike(term)
    ? { ...EMPTY_REGISTRATION, symbol: term.toUpperCase() }
    : { ...EMPTY_REGISTRATION, name: term };
};

const CatalogReturn: FC<CatalogReturnProps> = ({ onSelect, disabled }) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    className="-ml-3 gap-2 justify-self-start"
    disabled={disabled}
    onClick={onSelect}
  >
    <ArrowLeft size={16} aria-hidden="true" />

    <span>Back to the catalog</span>
  </Button>
);

const RegistrationForm: FC<RegistrationFormProps> = ({
  options,
  initialSearch,
  onConfirm,
  onSearchCatalog,
  ...dialogActions
}) => {
  const formId = useId();

  const registrationSchema = useMemo(
    () => registrationSchemaOf(options),
    [options]
  );

  const defaultValues = defaultValuesOf(initialSearch);
  const initialFocus: RegistrationField =
    defaultValues.symbol === '' ? 'symbol' : 'name';

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isSubmitting }
  } = useForm<RegistrationFormInput, unknown, AssetRegistration>({
    mode: 'onTouched',
    resolver: zodResolver(registrationSchema),
    defaultValues,
    shouldFocusError: false
  });

  useEffect(() => {
    setFocus(initialFocus);
  }, [setFocus, initialFocus]);

  const [symbol, market] = useWatch({ control, name: ['symbol', 'market'] });
  const normalizedSymbol = symbol.trim().toUpperCase();
  const marketOption = options.markets.find(
    (option) => option.market === market
  );

  const marketHint = (() => {
    if (marketOption === undefined)
      return 'Where the asset trades. It sets the currency the asset is quoted in.';
    if (marketOption.currency === null)
      return 'This market quotes in any currency, so choose one below.';

    return `Assets on ${marketOption.market} are quoted in ${marketOption.currency}.`;
  })();

  const presentRegistrationError = (
    error: unknown,
    registeredSymbol: string
  ) => {
    if (error instanceof ApiProxyError && isConflictError(error)) {
      setError(
        'symbol',
        {
          type: CONFLICT_ERROR_TYPE,
          message: `${registeredSymbol} is already registered. Add it from the catalog instead.`
        },
        { shouldFocus: true }
      );
      return;
    }

    if (error instanceof ApiProxyError && isDomainError(error)) {
      setError(
        'market',
        { type: 'server', message: error.message },
        { shouldFocus: true }
      );
      return;
    }

    presentSubmitError(error, {
      setError,
      fieldOf: (path) => {
        const field = path.startsWith(INSTRUMENT_PATH_PREFIX)
          ? path.slice(INSTRUMENT_PATH_PREFIX.length)
          : path;

        return isRegistrationField(field) ? field : undefined;
      }
    });
  };

  /** RHF would focus in registration order, where the radios precede the fields `FormField` renders. */
  const focusFirstInvalidField = (
    fieldErrors: FieldErrors<RegistrationFormInput>
  ) => {
    const firstInvalidField = REGISTRATION_FIELDS.find(
      (field) => fieldErrors[field] !== undefined
    );

    if (firstInvalidField !== undefined) setFocus(firstInvalidField);
  };

  const submitRegistration = async (registration: AssetRegistration) => {
    try {
      await onConfirm(registration);
      reset(EMPTY_REGISTRATION, { keepFieldsRef: true });
      setFocus('symbol');
    } catch (error) {
      presentRegistrationError(error, registration.symbol);
    }
  };

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={handleSubmit(submitRegistration, focusFirstInvalidField)}
      >
        <div className="grid min-w-0 gap-4">
          <CatalogReturn
            disabled={isSubmitting}
            onSelect={() => onSearchCatalog(initialSearch)}
          />

          <FormField
            label="Symbol"
            hint="Up to 6 letters and digits. It identifies the asset, so it cannot repeat one in the catalog or one you registered."
            error={errors.symbol?.message}
          >
            {(fieldControl) => (
              <Input
                {...fieldControl}
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="e.g. PETR4"
                maxLength={SYMBOL_MAX_LENGTH}
                className="uppercase placeholder:normal-case"
                {...register('symbol')}
              />
            )}
          </FormField>

          {errors.symbol?.type === CONFLICT_ERROR_TYPE && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2 justify-self-start max-sm:w-full"
              disabled={isSubmitting}
              onClick={() => onSearchCatalog(normalizedSymbol)}
            >
              <Search size={16} aria-hidden="true" />

              <span>{`Search the catalog for ${normalizedSymbol}`}</span>
            </Button>
          )}

          <FormField
            label="Name"
            hint="Shown beside the symbol to tell assets apart."
            error={errors.name?.message}
          >
            {(fieldControl) => (
              <Input
                {...fieldControl}
                type="text"
                autoComplete="off"
                maxLength={NAME_MAX_LENGTH}
                {...register('name')}
              />
            )}
          </FormField>

          <ChoiceField
            legend="Asset class"
            hint="Groups the asset in the allocation chart."
            error={errors.type?.message}
          >
            <SegmentedControl className="grid grid-cols-3">
              {options.types.map((type) => (
                <SegmentedControlItem
                  key={type}
                  value={type}
                  {...register('type')}
                >
                  {ASSET_CLASS_LABELS.get(type) ?? type}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </ChoiceField>

          <ChoiceField
            legend="Market"
            hint={marketHint}
            error={errors.market?.message}
          >
            <SegmentedControl className="grid grid-cols-2 sm:grid-cols-4">
              {options.markets.map((option) => (
                <SegmentedControlItem
                  key={option.market}
                  value={option.market}
                  {...register('market')}
                >
                  {option.market}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </ChoiceField>

          {marketOption?.currency === null && (
            <ChoiceField
              legend="Currency"
              hint="The currency the asset is quoted in."
              error={errors.currency?.message}
            >
              <SegmentedControl className="grid grid-cols-3 sm:flex sm:w-fit">
                {OFFERED_CURRENCIES.map((currency) => (
                  <SegmentedControlItem
                    key={currency}
                    value={currency}
                    {...register('currency')}
                  >
                    {currency}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
            </ChoiceField>
          )}

          <FormField
            label="Sector"
            isOptional
            hint="Shown on the asset page."
            error={errors.sector?.message}
          >
            {(fieldControl) => (
              <Input
                {...fieldControl}
                type="text"
                autoComplete="off"
                maxLength={SECTOR_MAX_LENGTH}
                {...register('sector')}
              />
            )}
          </FormField>

          {errors.root?.server?.message !== undefined && (
            <p role="alert" className="text-sm text-negative">
              {errors.root.server.message}
            </p>
          )}
        </div>
      </form>

      <AddAssetFooter
        formId={formId}
        submitLabel="Register and add"
        isSubmitting={isSubmitting}
        canSubmit
        {...dialogActions}
      />
    </>
  );
};

export const InstrumentRegistration: FC<InstrumentRegistrationProps> = (
  props
) => {
  const formId = useId();
  const { data: options, isError, refetch } = useInstrumentOptions();

  if (options !== undefined)
    return <RegistrationForm options={options} {...props} />;

  return (
    <>
      <CatalogReturn
        onSelect={() => props.onSearchCatalog(props.initialSearch)}
      />

      {isError ? (
        <ErrorState message={OPTIONS_LOAD_FAILURE_MESSAGE} onRetry={refetch} />
      ) : (
        <LoadingState
          label="Loading the registration options"
          className="h-64"
        />
      )}

      <AddAssetFooter
        formId={formId}
        submitLabel="Register and add"
        isSubmitting={false}
        canSubmit={false}
        addedSymbol={props.addedSymbol}
        onAddTransaction={props.onAddTransaction}
        onCancel={props.onCancel}
      />
    </>
  );
};
