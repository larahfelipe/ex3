import { useEffect, useId, type FC } from 'react';

import { useSearchParams } from 'next/navigation';

import { updateUrlQuery } from '@/common/utils';
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui';
import type { Maybe } from '@/types';

type CurrencyPickerProps = Record<'value', string> &
  Record<'currencies', ReadonlyArray<string>> &
  Record<'onChange', (currency: string) => void>;

const CURRENCY_PARAM = 'currency';

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

const paramsWithCurrency = (current: URLSearchParams, currency: string) => {
  const params = new URLSearchParams(current);

  params.set(CURRENCY_PARAM, currency);

  return params;
};

/** The currency a finance page shows, kept in the URL so a link names it. */
export const useCurrencyParam = () => {
  const searchParams = useSearchParams();
  const requested = searchParams.get(CURRENCY_PARAM)?.toUpperCase();
  const currency =
    requested !== undefined && CURRENCY_PATTERN.test(requested)
      ? requested
      : null;

  const setCurrency = (next: string) =>
    updateUrlQuery(paramsWithCurrency(searchParams, next));

  return [currency, setCurrency] as const;
};

/**
 * Asked for no currency, the API answers in its default one. When the user has
 * no records in it, the page moves to the first currency they do have, in
 * place of the current history entry, so going back never returns here.
 */
export const useAdoptedCurrency = (
  requested: Maybe<string>,
  answer:
    (Record<'currency', string> & Record<'currencies', string[]>) | undefined
) => {
  const searchParams = useSearchParams();
  const adopted =
    requested === null &&
    answer !== undefined &&
    answer.currencies.length > 0 &&
    !answer.currencies.includes(answer.currency)
      ? answer.currencies[0]
      : null;

  useEffect(() => {
    if (adopted === null) return;

    window.history.replaceState(
      {},
      '',
      `?${paramsWithCurrency(searchParams, adopted)}`
    );
  }, [adopted, searchParams]);
};

/** Shown only when there is a choice: amounts in two currencies are never added up. */
export const CurrencyPicker: FC<CurrencyPickerProps> = ({
  value,
  currencies,
  onChange
}) => {
  const pickerId = useId();
  const offered = currencies.includes(value)
    ? currencies
    : [value, ...currencies];

  if (offered.length < 2) return null;

  return (
    <div className="flex items-center gap-2">
      <Label
        htmlFor={pickerId}
        className="text-sm font-normal text-muted-foreground"
      >
        Currency
      </Label>

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={pickerId} className="h-9 w-24">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {offered.map((currency) => (
            <SelectItem key={currency} value={currency}>
              {currency}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
