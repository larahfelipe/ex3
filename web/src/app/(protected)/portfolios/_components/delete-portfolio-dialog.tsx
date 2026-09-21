import { useState, type FC } from 'react';

import { Loader2 } from 'lucide-react';

import type { Portfolio } from '@/app/api/v1/portfolios';
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
import type { Maybe } from '@/types';

type DeletePortfolioDialogProps = {
  portfolio: Portfolio;
  isActive: boolean;
  onCancel: VoidFunction;
  onConfirm: () => Promise<unknown>;
};

const DELETE_FAILURE_MESSAGE = 'The portfolio could not be deleted';

export const DeletePortfolioDialog: FC<DeletePortfolioDialogProps> = ({
  portfolio: { name },
  isActive,
  onCancel,
  onConfirm
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<Maybe<string>>(null);

  const deletionConsequence = `Every asset and transaction in ${name} is deleted with it, and this cannot be undone.`;

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
          <AlertDialogTitle className="wrap-anywhere">{`Delete ${name}?`}</AlertDialogTitle>

          <AlertDialogDescription>
            {isActive
              ? `${deletionConsequence} The app then shows your oldest portfolio.`
              : deletionConsequence}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteError && (
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
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            )}
            Delete portfolio
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
