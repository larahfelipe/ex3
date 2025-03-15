import type { ChangeEvent, FC } from 'react';
import {
  Controller,
  useFormContext,
  type SubmitHandler
} from 'react-hook-form';
import { FaCircle } from 'react-icons/fa';
import { LuArrowDownUp } from 'react-icons/lu';

import { Loader2 } from 'lucide-react';
import { z } from 'zod';

import type { Asset } from '@/app/api/v1/assets';
import type {
  CreateTransactionRequestPayload,
  TransactionType
} from '@/app/api/v1/transactions';
import { CURRENCIES, TRANSACTION_TYPES } from '@/common/constants';
import { sanitizeInputValue } from '@/common/utils';
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
import { useUser } from '@/hooks/use-user';

type AddAssetTransactionDialogProps = {
  open: boolean;
  data: Asset;
  onCancel: VoidFunction;
  onConfirm: (payload: CreateTransactionRequestPayload) => Promise<unknown>;
};

export type AddAssetTransactionSchemaType = z.infer<
  typeof AddAssetTransactionSchema
>;

export const AddAssetTransactionSchema = z.object({
  type: z
    .string()
    .refine((value) => TRANSACTION_TYPES.includes(value as TransactionType), {
      message: 'Transaction type must be either `BUY` or `SELL`'
    }),
  amount: z.coerce.number().positive('Transaction amount must be positive'),
  price: z.coerce.number().positive('Transaction price must be positive')
});

const handleChangeFormFieldValue = (
  fieldName: keyof AddAssetTransactionSchemaType,
  event: ChangeEvent<HTMLInputElement>
) => {
  const { value } = event.target;

  if (fieldName === 'price') return sanitizeInputValue(value, 'number');

  return value;
};

export const AddAssetTransactionDialog: FC<AddAssetTransactionDialogProps> = ({
  open,
  data,
  onCancel,
  onConfirm
}) => {
  const { currency } = useUser();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid }
  } = useFormContext<AddAssetTransactionSchemaType>();

  const handleCancel = () => {
    onCancel();
    reset();
  };

  const handleConfirm: SubmitHandler<AddAssetTransactionSchemaType> = async (
    payload
  ) => {
    await onConfirm({
      ...payload,
      type: payload.type as TransactionType,
      assetSymbol: data.symbol,
      assetId: ''
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
            Create a new {data?.symbol ?? 'Unknown'} transaction
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
              defaultValue={data?.symbol}
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
            <Label htmlFor="amount">Amount</Label>

            <Input
              type="number"
              step="any"
              id="amount"
              aria-label="Amount"
              placeholder="Enter the transaction amount"
              min={0}
              disabled={isSubmitting}
              {...register('amount')}
            />

            {!!errors.amount?.message && (
              <small className="text-red-500">{errors.amount.message}</small>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="price">Price</Label>

            <Controller
              name="price"
              control={control}
              disabled={isSubmitting}
              render={({ field }) => (
                <Input
                  {...field}
                  id="price"
                  step="0.01"
                  aria-label="Price"
                  disabled={isSubmitting}
                  leftElement={
                    <span className="text-sm">
                      {CURRENCIES[currency].symbol}
                    </span>
                  }
                  onChange={(e) =>
                    field.onChange(handleChangeFormFieldValue('price', e))
                  }
                />
              )}
            />

            {!!errors.price?.message && (
              <small className="text-red-500">{errors.price.message}</small>
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
            disabled={isSubmitting || !isValid}
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
