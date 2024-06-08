'use client';

import { useCallback, useReducer, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useSearchParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createAsset } from '@/api/create-asset';
import { createTransaction } from '@/api/create-transaction';
import { deleteAsset } from '@/api/delete-asset';
import type { Asset } from '@/api/get-assets';
import { TRANSACTION_TYPES } from '@/common/constants';
import { replaceUrl } from '@/common/utils';
import {
  AssetsTable,
  type ActionType,
  type AssetsTableRef
} from '@/components/assets-table';
import {
  AddAssetDialog,
  AddAssetSchema,
  AddAssetTransactionDialog,
  AddAssetTransactionSchema,
  DeleteAssetDialog,
  type AddAssetSchemaType,
  type AddAssetTransactionSchemaType
} from '@/components/dialogs';
import { Card } from '@/components/ui';
import type { Maybe } from '@/types';

type DialogContext<TRef, TData = unknown> = {
  ref: TRef;
  data?: TData;
};

type ReducerState = {
  open: boolean;
  context: Maybe<DialogContext<ActionType, Asset>>;
};

type ReducerAction = {
  type: ActionType;
  payload?: Asset;
};

const initialState: ReducerState = {
  open: false,
  context: null
};

const reducer = (state: ReducerState, action: ReducerAction): ReducerState => {
  if (!action?.payload && action.type === 'delete') return initialState;

  return {
    ...state,
    open: true,
    context: {
      ref: action.type,
      data: action.payload
    }
  };
};

export default function Home() {
  const [dialog, dispatch] = useReducer(reducer, initialState);
  const assetsTableRef = useRef<AssetsTableRef>(null);

  const addAssetFormMethods = useForm<AddAssetSchemaType>({
    mode: 'onChange',
    resolver: zodResolver(AddAssetSchema),
    defaultValues: {
      symbol: ''
    }
  });

  const addAssetTransactionFormMethods = useForm<AddAssetTransactionSchemaType>(
    {
      mode: 'onBlur',
      resolver: zodResolver(AddAssetTransactionSchema),
      defaultValues: {
        type: TRANSACTION_TYPES[0],
        price: 0
      }
    }
  );

  const searchParams = useSearchParams();

  const handleAction = useCallback(
    (type: ActionType, payload?: Asset) => dispatch({ type, payload }),
    []
  );

  const handleCloseDialog = useCallback(() => {
    dispatch({ type: 'delete' });
    if (searchParams.size) replaceUrl(window.location.pathname);
  }, [searchParams]);

  const { mutateAsync: createAssetMutation } = useMutation({
    mutationFn: createAsset,
    onSuccess: async ({ data }) => {
      toast.success(data.message);
      await assetsTableRef.current?.refetchData();
    },
    onError: (e: string) => toast.error(e)
  });

  const { mutateAsync: createAssetTransactionMutation } = useMutation({
    mutationFn: createTransaction,
    onSuccess: async ({ data }) => {
      toast.success(data.message);
      if (searchParams.size) replaceUrl(window.location.pathname);
      await assetsTableRef.current?.refetchData();
    },
    onError: (e: string) => toast.error(e)
  });

  const { mutateAsync: deleteAssetMutation } = useMutation({
    mutationFn: deleteAsset,
    onSuccess: async ({ data }) => {
      handleCloseDialog();
      toast.success(data.message);
      await assetsTableRef.current?.refetchData();
    },
    onError: (e: string) => toast.error(e)
  });

  return (
    <>
      {dialog?.context?.ref === 'add-asset' && (
        <FormProvider {...addAssetFormMethods}>
          <AddAssetDialog
            open={dialog.open}
            data={dialog.context.data as Asset}
            onCancel={handleCloseDialog}
            onConfirm={createAssetMutation}
          />
        </FormProvider>
      )}

      {dialog?.context?.ref === 'add-transaction' && (
        <FormProvider {...addAssetTransactionFormMethods}>
          <AddAssetTransactionDialog
            open={dialog.open}
            data={dialog.context.data as Asset}
            onCancel={handleCloseDialog}
            onConfirm={createAssetTransactionMutation}
          />
        </FormProvider>
      )}

      {dialog?.context?.ref === 'delete' && (
        <DeleteAssetDialog
          open={dialog.open}
          data={dialog.context.data as Asset}
          onCancel={handleCloseDialog}
          onConfirm={deleteAssetMutation}
        />
      )}

      <Card className="h-fit mt-12 shadow-none sm:p-5 sm:mx-4 max-sm:py-5">
        <AssetsTable ref={assetsTableRef} onAction={handleAction} />
      </Card>
    </>
  );
}
