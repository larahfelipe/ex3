import type { FC, JSX } from 'react';

import type { AssetValuation } from '@/app/api/v1/assets';
import { formatNumber } from '@/common/utils';
import { Skeleton, TableCell } from '@/components/ui';
import type { DecimalString, Maybe } from '@/types';

type AssetValuationTableCellsProps = {
  loading?: boolean;
  valuation: Maybe<AssetValuation>;
};

const NO_VALUE = '-';
const VALUATION_COLUMNS = ['price', 'market-value', 'profit-loss'];
const PERCENT_FRACTION_DIGITS = 2;

const MISSING_QUOTE_LABELS = {
  'not-found': 'No quote',
  unavailable: 'Quote unavailable'
} as const;

const QUOTE_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const decimalPlacesOf = (value: DecimalString) =>
  value.split('.').at(1)?.length ?? 0;

const currencyFractionDigits = (currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).resolvedOptions().maximumFractionDigits ?? 0;

const formatMoney = (
  value: DecimalString,
  currency: string,
  options?: Intl.NumberFormatOptions
) => formatNumber(value, { style: 'currency', currency, ...options });

const profitLossTone = (profitLoss: DecimalString) => {
  if (profitLoss === '0') return 'text-gray-300';

  return profitLoss.startsWith('-') ? 'text-red-600' : 'text-green-600';
};

export const AssetValuationTableCells: FC<AssetValuationTableCellsProps> = ({
  loading,
  valuation
}): JSX.Element => {
  if (loading)
    return (
      <>
        {VALUATION_COLUMNS.map((column) => (
          <TableCell key={column}>
            <Skeleton className="w-3/4 h-5" />
          </TableCell>
        ))}
      </>
    );

  if (valuation?.outcome !== 'valued')
    return (
      <>
        <TableCell className="text-gray-400">
          {MISSING_QUOTE_LABELS[valuation?.outcome ?? 'unavailable']}
        </TableCell>

        <TableCell className="text-gray-400">{NO_VALUE}</TableCell>

        <TableCell className="text-gray-400">{NO_VALUE}</TableCell>
      </>
    );

  const { quote, marketValue, profitLoss, profitLossPercent } = valuation;

  return (
    <>
      <TableCell>
        <div className="flex flex-col">
          <span>
            {formatMoney(quote.price, quote.currency, {
              maximumFractionDigits: Math.max(
                decimalPlacesOf(quote.price),
                currencyFractionDigits(quote.currency)
              )
            })}
          </span>

          <time dateTime={quote.timestamp} className="text-xs text-gray-500">
            {QUOTE_TIME_FORMAT.format(new Date(quote.timestamp))}
          </time>
        </div>
      </TableCell>

      <TableCell>{formatMoney(marketValue, quote.currency)}</TableCell>

      <TableCell>
        {profitLoss === undefined ? (
          <span className="text-gray-400">
            <span aria-hidden="true">{NO_VALUE}</span>

            <span className="sr-only">
              Not comparable with the invested value
            </span>
          </span>
        ) : (
          <div className={`flex flex-col ${profitLossTone(profitLoss)}`}>
            <span>
              {formatMoney(profitLoss, quote.currency, {
                signDisplay: 'exceptZero'
              })}
            </span>

            {profitLossPercent !== undefined && (
              <span className="text-xs">
                {formatNumber(profitLossPercent, {
                  style: 'percent',
                  maximumFractionDigits: PERCENT_FRACTION_DIGITS,
                  signDisplay: 'exceptZero'
                })}
              </span>
            )}
          </div>
        )}
      </TableCell>
    </>
  );
};
