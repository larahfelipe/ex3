import type { TransactionType } from '@/app/api/v1/transactions';
import type { DecimalString } from '@/types';

import {
  decimalOfUnits,
  decimalPlacesOf,
  isStorableDecimal,
  unitsOf
} from './decimal';

export type TransactionEffect = Record<
  'quantity' | 'unitPrice' | 'gross' | 'charges' | 'net',
  DecimalString
>;

export const isCostOf = (type: TransactionType) =>
  type === 'BUY' || type === 'BONUS';

const signedDecimalOf = (units: bigint, scale: number): DecimalString =>
  units < 0n
    ? (`-${decimalOfUnits(-units, scale)}` as DecimalString)
    : decimalOfUnits(units, scale);

export const transactionEffectOf = (
  type: TransactionType,
  {
    quantity,
    unitPrice,
    fees,
    taxes
  }: Record<'quantity' | 'unitPrice' | 'fees' | 'taxes', string>
): TransactionEffect | null => {
  const feesAmount = fees === '' ? '0' : fees;
  const taxesAmount = taxes === '' ? '0' : taxes;

  if (
    !isStorableDecimal(quantity) ||
    !isStorableDecimal(unitPrice) ||
    !isStorableDecimal(feesAmount) ||
    !isStorableDecimal(taxesAmount)
  )
    return null;

  const quantityPlaces = decimalPlacesOf(quantity);
  const unitPricePlaces = decimalPlacesOf(unitPrice);
  const grossPlaces = quantityPlaces + unitPricePlaces;
  const scale = Math.max(
    grossPlaces,
    decimalPlacesOf(feesAmount),
    decimalPlacesOf(taxesAmount)
  );

  const gross =
    unitsOf(quantity, quantityPlaces) *
    unitsOf(unitPrice, unitPricePlaces) *
    10n ** BigInt(scale - grossPlaces);
  const charges = unitsOf(feesAmount, scale) + unitsOf(taxesAmount, scale);

  return {
    quantity,
    unitPrice,
    gross: decimalOfUnits(gross, scale),
    charges: decimalOfUnits(charges, scale),
    net: signedDecimalOf(
      isCostOf(type) ? gross + charges : gross - charges,
      scale
    )
  };
};
