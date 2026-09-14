import type { FC } from 'react';
import {
  Controller,
  useFormContext,
  type SubmitHandler
} from 'react-hook-form';
import { FaCircle } from 'react-icons/fa';
import { LuArrowDownUp } from 'react-icons/lu';

import { Loader2 } from 'lucide-react';
import { z } from 'zod';

import type {
  CreateTransactionRequestPayload,
  TransactionType
} from '@/app/api/v1/transactions';
import { CURRENCIES, TRANSACTION_TYPES } from '@/common/constants';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator
} from '@/components/ui';
import type { Maybe } from '@/types';

type AddAssetTransactionDialogProps = {
  open: boolean;
  symbol: Maybe<string>;
  currency?: string;
  onCancel: VoidFunction;
  onConfirm: (
    payload: Omit<CreateTransactionRequestPayload, 'portfolioId' | 'currency'>
  ) => Promise<unknown>;
};

export type AddAssetTransactionSchemaInput = z.input<
  typeof AddAssetTransactionSchema
>;

export type AddAssetTransactionSchemaType = z.output<
  typeof AddAssetTransactionSchema
>;

/** The API stores quantities and prices as DECIMAL(38,18) and rejects what the column would round. */
const DECIMAL_COLUMN = { PRECISION: 38, SCALE: 18 } as const;

const INTEGER_DIGITS = DECIMAL_COLUMN.PRECISION - DECIMAL_COLUMN.SCALE;

const DECIMAL_PATTERN = new RegExp(
  `^(0|[1-9]\\d{0,${INTEGER_DIGITS - 1}})(\\.\\d{1,${DECIMAL_COLUMN.SCALE}})?$`
);

const NONZERO_DIGIT = /[1-9]/;

const positiveDecimalField = (field: string) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .regex(
      DECIMAL_PATTERN,
      `${field} must be a plain decimal with at most ${INTEGER_DIGITS} integer digits and ${DECIMAL_COLUMN.SCALE} decimal places`
    )
    .regex(NONZERO_DIGIT, `${field} must be positive`);

export const AddAssetTransactionSchema = z.object({
  type: z
    .string()
    .refine((value) => TRANSACTION_TYPES.includes(value as TransactionType), {
      message: 'Transaction type must be either `BUY` or `SELL`'
    }),
  quantity: positiveDecimalField('Quantity'),
  unitPrice: positiveDecimalField('Unit price'),
  executedAt: z
    .string()
    .min(1, 'Execution date is required')
    .transform((value) => new Date(value))
    .pipe(z.date('Execution date must be a valid date'))
    .transform((date) => date.toISOString())
});

export const AddAssetTransactionDialog: FC<AddAssetTransactionDialogProps> = ({
  open,
  symbol,
  currency,
  onCancel,
  onConfirm
}) => {
  const currencySymbol =
    Object.values(CURRENCIES).find(({ id }) => id === currency)?.symbol ??
    currency;

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid }
  } = useFormContext<
    AddAssetTransactionSchemaInput,
    unknown,
    AddAssetTransactionSchemaType
  >();

  const handleCancel = () => {
    onCancel();
    reset();
  };

  const handleConfirm: SubmitHandler<AddAssetTransactionSchemaType> = async (
    payload
  ) => {
    if (!symbol) return;

    await onConfirm({
      ...payload,
      type: payload.type as TransactionType,
      assetSymbol: symbol
    });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex gap-2">
            <LuArrowDownUp />

            <span>Add transaction</span>
          </DialogTitle>

          <DialogDescription>
            Create a new {symbol ?? 'Unknown'} transaction
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(handleConfirm)}
          id="add-asset-transaction-form"
          className="flex flex-col gap-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="symbol">Asset</Label>

            <Input
              disabled
              id="symbol"
              aria-label="Asset symbol"
              defaultValue={symbol ?? undefined}
            />
          </div>

          <Separator className="mt-3" />

          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>

            <Controller
              name="type"
              control={control}
              disabled={isSubmitting}
              render={({ field }) => (
                <Select
                  defaultValue={field.value}
                  disabled={field.disabled}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue
                      id="type"
                      aria-label="Transaction type"
                      placeholder="Transaction type"
                    />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value={TRANSACTION_TYPES[0]}>
                      <div className="flex items-center gap-1.5">
                        <FaCircle size={10} className="text-green-400" />

                        <span>Buy</span>
                      </div>
                    </SelectItem>

                    <SelectItem value={TRANSACTION_TYPES[1]}>
                      <div className="flex items-center gap-1.5">
                        <FaCircle size={10} className="text-red-400" />

                        <span>Sell</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />

            {!!errors.type?.message && (
              <small className="text-red-500">{errors.type.message}</small>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantity</Label>

            <Input
              type="number"
              step="any"
              id="quantity"
              aria-label="Quantity"
              placeholder="Enter the transaction quantity"
              min={0}
              disabled={isSubmitting}
              {...register('quantity')}
            />

            {!!errors.quantity?.message && (
              <small className="text-red-500">{errors.quantity.message}</small>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="unitPrice">Unit price</Label>

            <Input
              type="number"
              step="any"
              id="unitPrice"
              aria-label="Unit price"
              placeholder="Enter the price per unit"
              min={0}
              disabled={isSubmitting}
              leftElement={<span className="text-sm">{currencySymbol}</span>}
              {...register('unitPrice')}
            />

            {!!errors.unitPrice?.message && (
              <small className="text-red-500">{errors.unitPrice.message}</small>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="executedAt">Executed at</Label>

            <Input
              type="datetime-local"
              id="executedAt"
              aria-label="Executed at"
              disabled={isSubmitting}
              {...register('executedAt')}
            />

            {!!errors.executedAt?.message && (
              <small className="text-red-500">
                {errors.executedAt.message}
              </small>
            )}
          </div>
        </form>

        <DialogFooter className="max-sm:space-y-4 max-sm:gap-3">
          <Button
            variant="outline"
            aria-label="Cancel"
            disabled={isSubmitting}
            onClick={handleCancel}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="add-asset-transaction-form"
            aria-label="Confirm"
            disabled={isSubmitting || !isValid || !symbol}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <span>Confirm</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
