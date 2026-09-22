import type { FC } from 'react';

import { Plus } from 'lucide-react';

import { SubmitButton } from '@/components/submit-button';
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

    <SubmitButton form={formId} isPending={isSubmitting} disabled={!canSubmit}>
      {submitLabel}
    </SubmitButton>
  </DialogFooter>
);
