import { useEffect, useRef, useState, type FC } from 'react';

import { useTranslations } from 'use-intl';

import type { Portfolio } from '@/app/api/v1/portfolios';
import type {
  CreateTransactionImportResponseData,
  ImportFilePayload,
  ImportPreview
} from '@/app/api/v1/transaction-imports';
import { TRANSACTION_IMPORT } from '@/common/constants';
import {
  useCreateTransactionImport,
  usePreviewTransactionImport
} from '@/hooks/use-transaction-imports';
import { apiErrorMessageOf } from '@/lib/api-error-message';
import { ApiProxyError, isConflictError } from '@/lib/axios';
import { APPEAR_CLASS } from '@/lib/motion';
import { isSameSelection } from '@/lib/transaction-import';
import { cn } from '@/lib/utils';

import { ImportAssetsSection } from './import-assets-section';
import { ImportFileCard, type ChosenImportFile } from './import-file-card';
import { ImportHistorySection } from './import-history-section';
import { ImportResultCard } from './import-result-card';
import { ImportRowsSection } from './import-rows-section';
import { ImportSourcesCard } from './import-sources-card';
import { ImportConfirmBar, ImportSummary } from './import-summary';

type ImportWorkspaceProps = Record<'portfolio', Portfolio>;

const payloadOf = ({ name, content }: ChosenImportFile): ImportFilePayload => ({
  name,
  content
});

/**
 * The API keeps no file between requests, so each plan sends it again with
 * the selection. Only the answer to the latest request is shown: a click while
 * one is on its way makes that answer stale, and the plan a click asks for
 * waits a moment for the next click.
 */
export const ImportWorkspace: FC<ImportWorkspaceProps> = ({ portfolio }) => {
  const t = useTranslations('imports');
  const tErrors = useTranslations('errors');
  const [file, setFile] = useState<ChosenImportFile | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const [isPlanning, setIsPlanning] = useState(false);
  const [isReplanScheduled, setIsReplanScheduled] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] =
    useState<CreateTransactionImportResponseData | null>(null);
  const latestRequestRef = useRef(0);
  const replanTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { mutateAsync: requestPreview } =
    usePreviewTransactionImport(portfolio);
  const { mutateAsync: createImport, isPending: isImporting } =
    useCreateTransactionImport(portfolio);

  useEffect(() => () => clearTimeout(replanTimerRef.current), []);

  /** Drops the answer on its way, if any, and the plan waiting to be asked for. */
  const discardPendingPlan = () => {
    latestRequestRef.current += 1;
    clearTimeout(replanTimerRef.current);
    setIsReplanScheduled(false);
    setIsPlanning(false);
  };

  const plan = async (
    planned: ChosenImportFile,
    selectedKeys?: Array<string>
  ) => {
    latestRequestRef.current += 1;
    const requestId = latestRequestRef.current;
    const isLatest = () => requestId === latestRequestRef.current;

    setIsPlanning(true);
    setPlanError(null);

    try {
      const { data } = await requestPreview({
        file: payloadOf(planned),
        selectedKeys
      });

      if (!isLatest()) return;

      setPreview(data.preview);
      setSelection(new Set(data.preview.selectedKeys));
    } catch (error) {
      if (!isLatest()) return;

      if (selectedKeys === undefined)
        setFileError(
          apiErrorMessageOf(error, tErrors, t('file.previewFailed'))
        );
      else
        setPlanError(
          apiErrorMessageOf(error, tErrors, t('summary.replanFailed'))
        );
    } finally {
      if (isLatest()) setIsPlanning(false);
    }
  };

  const reset = () => {
    discardPendingPlan();
    setFile(null);
    setPreview(null);
    setSelection(new Set());
    setFileError(null);
    setPlanError(null);
    setImportError(null);
    setResult(null);
  };

  const chooseFile = (chosen: ChosenImportFile) => {
    if (isImporting) return;

    reset();
    setFile(chosen);
    void plan(chosen);
  };

  const changeSelection = (next: ReadonlySet<string>) => {
    if (file === null || preview === null) return;

    discardPendingPlan();
    setSelection(next);
    setPlanError(null);
    setImportError(null);

    if (isSameSelection(next, preview.selectedKeys)) return;

    setIsReplanScheduled(true);
    replanTimerRef.current = setTimeout(() => {
      setIsReplanScheduled(false);
      void plan(file, [...next]);
    }, TRANSACTION_IMPORT.ReplanDelayMs);
  };

  /**
   * Records only a plan the person saw: a selection whose plan failed is
   * planned again first, and a portfolio that changed since the preview gets a
   * new one, which the person reviews before confirming again.
   */
  const confirmImport = async () => {
    if (file === null || preview === null) return;

    if (!isSameSelection(selection, preview.selectedKeys)) {
      void plan(file, [...selection]);
      return;
    }

    setImportError(null);

    try {
      const { data } = await createImport({
        file: payloadOf(file),
        selectedKeys: preview.selectedKeys
      });

      setResult(data);
    } catch (error) {
      setImportError(apiErrorMessageOf(error, tErrors, t('confirm.failed')));

      if (error instanceof ApiProxyError && isConflictError(error))
        void plan(file, preview.selectedKeys);
    }
  };

  const isReplanning = isReplanScheduled || (isPlanning && preview !== null);

  return (
    <div className="space-y-6">
      {result === null ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <ImportFileCard
              isReading={isPlanning && preview === null}
              file={file}
              error={fileError}
              onFileChosen={chooseFile}
            />

            <ImportSourcesCard />
          </div>

          {file !== null && preview !== null && (
            <div className={cn('space-y-6', APPEAR_CLASS)}>
              <ImportSummary preview={preview} selectedCount={selection.size} />

              {preview.assets.length > 0 && (
                <ImportAssetsSection assets={preview.assets} />
              )}

              <ImportRowsSection
                rows={preview.rows}
                selection={selection}
                isLocked={isImporting}
                onSelectionChange={changeSelection}
              />

              <ImportConfirmBar
                selectedCount={selection.size}
                isReplanning={isReplanning}
                isImporting={isImporting}
                error={planError ?? importError}
                onConfirm={() => void confirmImport()}
              />
            </div>
          )}
        </>
      ) : (
        <ImportResultCard result={result} onImportAnother={reset} />
      )}

      <ImportHistorySection portfolio={portfolio} />
    </div>
  );
};
