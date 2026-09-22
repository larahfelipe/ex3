import { useState, type FC } from 'react';

import { Loader2 } from 'lucide-react';

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

type ConfirmDeletionDialogProps = Record<
  'title' | 'description' | 'confirmLabel' | 'failureMessage',
  string
> & {
  onCancel: VoidFunction;
  onConfirm: () => Promise<unknown>;
};

/**
 * Stays open until `onConfirm` settles, so the consumer closes it after a
 * deletion and a refusal is shown in place. The confirm button keeps focus
 * while pending through `aria-disabled`, as `SubmitButton` does.
 */
export const ConfirmDeletionDialog: FC<ConfirmDeletionDialogProps> = ({
  title,
  description,
  confirmLabel,
  failureMessage,
  onCancel,
  onConfirm
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<Maybe<string>>(null);

  const confirmDeletion = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await onConfirm();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : failureMessage);
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
          <AlertDialogTitle className="wrap-anywhere">{title}</AlertDialogTitle>

          <AlertDialogDescription>{description}</AlertDialogDescription>
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
            aria-disabled={isDeleting}
            className="gap-2"
            onClick={() => {
              if (!isDeleting) void confirmDeletion();
            }}
          >
            {isDeleting && (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            )}

            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
