import { useState, type FC } from 'react';

import { Loader2 } from 'lucide-react';

import type { ListedTransaction } from '@/app/api/v1/transactions';
import { TRANSACTION_TYPE_LABELS } from '@/common/constants';
import { formatExecutionTime, formatQuantity } from '@/common/utils';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button
} from '@/components/ui';

type DeleteTransactionDialogProps = {
  transaction: ListedTransaction;
  onCancel: VoidFunction;
  onConfirm: () => Promise<unknown>;
};

const DELETE_FAILURE_MESSAGE = 'The transaction could not be deleted';

export const DeleteTransactionDialog: FC<DeleteTransactionDialogProps> = ({
  transaction: { type, quantity, symbol, executedAt },
  onCancel,
  onConfirm
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDeletion = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await onConfirm();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : DELETE_FAILURE_MESSAGE
      );
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog
      open
      onOpenChange={() => {
        if (!isDeleting) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>

          <AlertDialogDescription>
            {`${TRANSACTION_TYPE_LABELS[type]} of ${formatQuantity(quantity)} ${symbol} on ${formatExecutionTime(executedAt)}. The position is recalculated without it, and this cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteError !== null && (
          <p role="alert" className="text-sm text-negative">
            {deleteError}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>

          <Button
            variant="destructive"
            disabled={isDeleting}
            className="gap-2"
            onClick={confirmDeletion}
          >
            {isDeleting && (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            )}
            Delete transaction
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
