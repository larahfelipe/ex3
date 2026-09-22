import type { FC } from 'react';

import { Loader2, Plus } from 'lucide-react';

import { Button, DialogFooter } from '@/components/ui';
import type { Maybe } from '@/types';

export type AddAssetDialogActions = {
  addedSymbol: Maybe<string>;
  onAddTransaction: VoidFunction;
  onCancel: VoidFunction;
};

type AddAssetFooterProps = AddAssetDialogActions & {
  formId: string;
  submitLabel: string;
  isSubmitting: boolean;
  canSubmit: boolean;
};

export const AddAssetFooter: FC<AddAssetFooterProps> = ({
  formId,
  submitLabel,
  isSubmitting,
  canSubmit,
  addedSymbol,
  onAddTransaction,
  onCancel
}) => (
  <DialogFooter>
    {addedSymbol && (
      <Button
        variant="ghost"
        className="gap-2 sm:absolute sm:left-6 max-sm:mt-6"
        onClick={onAddTransaction}
      >
        <Plus size={16} aria-hidden="true" />

        <span>{`Add a ${addedSymbol} transaction?`}</span>
      </Button>
    )}

    <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
      Cancel
    </Button>

    <Button
      type="submit"
      form={formId}
      className="gap-2"
      disabled={isSubmitting || !canSubmit}
    >
      {isSubmitting && (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      )}

      <span>{submitLabel}</span>
    </Button>
  </DialogFooter>
);
