/* eslint-disable react/jsx-newline */
import type { FC } from 'react';

import type { DeleteAssetPayload } from '@/api/delete-asset';
import type { Asset } from '@/api/get-assets';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../ui';

type DeleteAssetDialogProps = {
  open: boolean;
  data: Asset;
  onCancel: () => void;
  onConfirm: (payload: DeleteAssetPayload) => Promise<unknown>;
};

export const DeleteAssetDialog: FC<DeleteAssetDialogProps> = ({
  open,
  data,
  onCancel,
  onConfirm
}) => {
  const handleCancel = () => onCancel();

  const handleConfirm = async () => await onConfirm({ symbol: data.symbol });

  return (
    <AlertDialog open={open} onOpenChange={handleCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to delete {data.symbol}?
          </AlertDialogTitle>

          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the{' '}
            {data.symbol} and its transactions from your portfolio.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>

          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-red-500 hover:bg-red-600"
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
