import type { FC, JSX } from 'react';

import type { AssetValuation } from '@/app/api/v1/assets';
import {
  formatMoney,
  formatPercent,
  formatPrice,
  formatQuoteTime,
  signedValueTone
} from '@/common/utils';
import { Skeleton, TableCell } from '@/components/ui';
import type { Maybe } from '@/types';

type AssetValuationTableCellsProps = {
  loading?: boolean;
  valuation: Maybe<AssetValuation>;
};

const NO_VALUE = '-';
const VALUATION_COLUMNS = ['price', 'market-value', 'profit-loss'];

const MISSING_QUOTE_LABELS = {
  'not-found': 'No quote',
  unavailable: 'Quote unavailable'
} as const;

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
          <span>{formatPrice(quote.price, quote.currency)}</span>

          <time dateTime={quote.timestamp} className="text-xs text-gray-500">
            {formatQuoteTime(quote.timestamp)}
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
          <div className={`flex flex-col ${signedValueTone(profitLoss)}`}>
            <span>
              {formatMoney(profitLoss, quote.currency, {
                signDisplay: 'exceptZero'
              })}
            </span>

            {profitLossPercent !== undefined && (
              <span className="text-xs">
                {formatPercent(profitLossPercent, {
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
