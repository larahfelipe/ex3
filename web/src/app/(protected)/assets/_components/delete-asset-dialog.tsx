/* eslint-disable react/jsx-newline */
import type { FC } from 'react';

import type { DeleteAssetRequestPayload } from '@/app/api/v1/assets';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  buttonVariants
} from '@/components/ui';
import { withSettledRejection } from '@/lib/utils';
import type { Maybe } from '@/types';

type DeleteAssetDialogProps = {
  open: boolean;
  symbol: Maybe<string>;
  onCancel: VoidFunction;
  onConfirm: (payload: DeleteAssetRequestPayload) => Promise<unknown>;
};

export const DeleteAssetDialog: FC<DeleteAssetDialogProps> = ({
  open,
  symbol,
  onCancel,
  onConfirm
}) => {
  const handleCancel = () => onCancel();

  const handleConfirm = async () => {
    if (symbol) await onConfirm({ symbol });
  };

  return (
    <AlertDialog open={open} onOpenChange={handleCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to delete {symbol ?? 'Unknown'}?
          </AlertDialogTitle>

          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the{' '}
            {symbol ?? 'Unknown'} and its transactions from your portfolio.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>

          <AlertDialogAction
            disabled={!symbol}
            onClick={withSettledRejection(handleConfirm)}
            className={buttonVariants({ variant: 'destructive' })}
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
