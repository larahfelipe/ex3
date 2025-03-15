import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type FC
} from 'react';
import {
  Controller,
  useFormContext,
  type SubmitHandler
} from 'react-hook-form';
import { LuArrowDownUp } from 'react-icons/lu';

import { Loader2, Plus } from 'lucide-react';
import { z } from 'zod';

import type { Asset, CreateAssetRequestPayload } from '@/app/api/v1/assets';
import { ASSET_DIALOG_ACTIONS } from '@/common/constants';
import { replaceUrl, sanitizeInputValue } from '@/common/utils';
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

type AddAssetDialogProps = {
  open: boolean;
  data: Asset;
  onCancel: VoidFunction;
  onConfirm: (payload: CreateAssetRequestPayload) => Promise<unknown>;
};

export type AddAssetSchemaType = z.infer<typeof AddAssetSchema>;

export const AddAssetSchema = z.object({
  symbol: z
    .string()
    .min(1, 'Asset symbol must have at least 1 character')
    .max(6, 'Asset symbol must have at most 6 characters')
    .transform((value) => value.trim().toUpperCase())
});

const handleChangeFormFieldValue = (
  fieldName: keyof AddAssetSchemaType,
  event: ChangeEvent<HTMLInputElement>
) => {
  let { value } = event.target;

  if (fieldName === 'symbol') {
    value = sanitizeInputValue(value, 'alphanumeric').toUpperCase();
    return value;
  }

  return value;
};

export const AddAssetDialog: FC<AddAssetDialogProps> = ({
  open,
  onCancel,
  onConfirm
}) => {
  const [assetSymbol, setAssetSymbol] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    formState: {
      errors,
      isSubmitting,
      isSubmitted,
      isSubmitSuccessful,
      isValid
    }
  } = useFormContext<AddAssetSchemaType>();

  const isSubmittedSuccessfully = useMemo(
    () => isSubmitted && isSubmitSuccessful,
    [isSubmitted, isSubmitSuccessful]
  );

  const handleCancel = () => {
    onCancel();
    reset();
  };

  const handleConfirm: SubmitHandler<AddAssetSchemaType> = async (payload) => {
    await onConfirm(payload);
    setAssetSymbol(payload.symbol);
    reset();
  };

  const handleAddTransaction = useCallback(() => {
    onCancel();

    if (isSubmitSuccessful && assetSymbol.length)
      replaceUrl(
        `?symbol=${assetSymbol}&action=${ASSET_DIALOG_ACTIONS.AddTransaction}`
      );
  }, [onCancel, isSubmitSuccessful, assetSymbol]);

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex gap-2 max-sm:justify-center">
            <LuArrowDownUp />

            <span>Add asset</span>
          </DialogTitle>

          <DialogDescription>Create a new asset</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(handleConfirm)}
          id="add-asset-transaction-form"
          className="flex flex-col gap-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="symbol">Asset</Label>

            <Controller
              name="symbol"
              control={control}
              disabled={isSubmitting}
              render={({ field }) => (
                <Input
                  id="symbol"
                  aria-label="Asset symbol"
                  placeholder="Enter the asset symbol"
                  {...field}
                  onChange={(e) =>
                    field.onChange(handleChangeFormFieldValue('symbol', e))
                  }
                />
              )}
            />

            {!!errors.symbol?.message && (
              <small className="text-red-500">{errors.symbol.message}</small>
            )}
          </div>
        </form>

        <DialogFooter className="max-sm:space-y-4">
          {isSubmittedSuccessfully && !!assetSymbol.length && (
            <Button
              variant="ghost"
              className="sm:absolute sm:left-6 max-sm:mt-6"
              onClick={handleAddTransaction}
            >
              <div className="flex items-center gap-2">
                <Plus size={16} />

                <span>Add a transaction?</span>
              </div>
            </Button>
          )}

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
