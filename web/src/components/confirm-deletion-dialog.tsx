import { useRef, useState, type FC, type ReactNode } from 'react';

import { Loader2 } from 'lucide-react';

import { FormField } from '@/components/form-field';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input
} from '@/components/ui';
import type { Maybe } from '@/types';

type ConfirmDeletionDialogProps = Record<
  'title' | 'confirmLabel' | 'failureMessage',
  string
> & {
  description: ReactNode;
  confirmationPhrase?: string;
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
  confirmationPhrase,
  onCancel,
  onConfirm
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<Maybe<string>>(null);
  const [typedPhrase, setTypedPhrase] = useState('');
  const [isMismatchShown, setIsMismatchShown] = useState(false);
  const phraseInputRef = useRef<HTMLInputElement>(null);

  /** NFC on both sides, so a name typed with decomposed accents still matches what it looks like. */
  const isPhraseTyped =
    confirmationPhrase === undefined ||
    typedPhrase.normalize() === confirmationPhrase.normalize();

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

  const requestDeletion = () => {
    if (isDeleting) return;

    if (!isPhraseTyped) {
      setIsMismatchShown(true);
      phraseInputRef.current?.focus();
      return;
    }

    void confirmDeletion();
  };

  return (
    <AlertDialog
      open
      onOpenChange={() => {
        if (!isDeleting) onCancel();
      }}
    >
      <AlertDialogContent
        onOpenAutoFocus={
          confirmationPhrase === undefined
            ? undefined
            : (event) => {
                event.preventDefault();
                phraseInputRef.current?.focus();
              }
        }
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="wrap-anywhere">{title}</AlertDialogTitle>

          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            requestDeletion();
          }}
        >
          {confirmationPhrase !== undefined && (
            <FormField
              label={
                <>
                  {'Type '}

                  <span className="whitespace-pre-wrap wrap-anywhere font-semibold">
                    {confirmationPhrase}
                  </span>

                  {' to confirm'}
                </>
              }
              error={
                isMismatchShown && !isPhraseTyped
                  ? 'This does not match the name above'
                  : undefined
              }
            >
              {(control) => (
                <Input
                  {...control}
                  ref={phraseInputRef}
                  value={typedPhrase}
                  readOnly={isDeleting}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(event) => setTypedPhrase(event.target.value)}
                />
              )}
            </FormField>
          )}

          {deleteError !== null && (
            <p role="alert" className="text-sm text-negative">
              {deleteError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>

            <Button
              type="submit"
              variant="destructive"
              aria-disabled={isDeleting || !isPhraseTyped}
              className="gap-2"
            >
              {isDeleting && (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              )}

              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
