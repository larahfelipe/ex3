import { Fragment, useEffect, useId, useRef, useState, type FC } from 'react';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { ImportPreviewRow } from '@/app/api/v1/transaction-imports';
import { TRANSACTION_IMPORT, TRANSACTION_TYPE_TONES } from '@/common/constants';
import { EmptyState } from '@/components/data-state';
import { Price, Quantity, UnavailableValue } from '@/components/financial';
import { PageNavigation } from '@/components/page-navigation';
import { SectionHeader } from '@/components/section-header';
import {
  Button,
  Card,
  CardContent,
  SegmentedControl,
  SegmentedControlItem,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader
} from '@/components/ui';
import { useFormat } from '@/i18n/format';
import { isNonzeroDecimal } from '@/lib/decimal';
import { FIRST_PAGE } from '@/lib/pagination';
import {
  costsOf,
  IMPORT_ROW_FILTERS,
  isSelectableRow,
  rowIdOf,
  rowsMatching,
  type ImportRowFilter
} from '@/lib/transaction-import';
import { cn } from '@/lib/utils';

import {
  ImportStatusBadge,
  rowNotesOf,
  rowReferenceOf
} from './import-display';

type ImportRowsSectionProps = Record<'rows', Array<ImportPreviewRow>> &
  Record<'selection', ReadonlySet<string>> &
  Record<'isLocked', boolean> &
  Record<'onSelectionChange', (selection: ReadonlySet<string>) => void>;

const COLUMN_COUNT = 9;

const CHECKBOX_CLASS =
  'size-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40';

/** The header checkbox stands for some rows checked, which only a property sets. */
const SelectAllCheckbox: FC<
  Record<'label', string> &
    Record<'checked' | 'indeterminate' | 'disabled', boolean> &
    Record<'onChange', VoidFunction>
> = ({ label, checked, indeterminate, disabled, onChange }) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      className={CHECKBOX_CLASS}
      onChange={onChange}
    />
  );
};

const OriginalRow: FC<Record<'row', ImportPreviewRow>> = ({ row }) => {
  const t = useTranslations('imports.rows');

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground uppercase">
        {t('original')}
      </p>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(row.cells).map(([header, value]) => (
          <div key={header} className="min-w-0">
            <dt className="text-xs text-muted-foreground wrap-anywhere">
              {header}
            </dt>

            <dd className="wrap-anywhere">
              {value === '' ? (
                <span className="text-muted-foreground">{t('emptyCell')}</span>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

/**
 * Every row of the file, a page at a time. A checkbox stands for a row the
 * person may include; checking or clearing one asks the page for a new plan,
 * which may clear rows of the same asset again when they no longer replay.
 */
export const ImportRowsSection: FC<ImportRowsSectionProps> = ({
  rows,
  selection,
  isLocked,
  onSelectionChange
}) => {
  const t = useTranslations('imports.rows');
  const tAssets = useTranslations('imports.assets');
  const tTypes = useTranslations('transactions.types');
  const { formatCalendarDay } = useFormat();
  const headingId = useId();
  const [filter, setFilter] = useState<ImportRowFilter>('all');
  const [requestedPage, setRequestedPage] = useState(FIRST_PAGE);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const filteredRows = rowsMatching(rows, filter, selection);
  const totalPages = Math.max(
    FIRST_PAGE,
    Math.ceil(filteredRows.length / TRANSACTION_IMPORT.RowsPageSize)
  );
  const page = Math.min(requestedPage, totalPages);
  const pageRows = filteredRows.slice(
    (page - 1) * TRANSACTION_IMPORT.RowsPageSize,
    page * TRANSACTION_IMPORT.RowsPageSize
  );

  const selectableKeys = filteredRows.flatMap((row) =>
    isSelectableRow(row) ? [row.key] : []
  );
  const checkedCount = selectableKeys.filter((key) =>
    selection.has(key)
  ).length;
  const isEveryChecked =
    selectableKeys.length > 0 && checkedCount === selectableKeys.length;

  const changeSelection = (keys: ReadonlyArray<string>, isChecked: boolean) => {
    const next = new Set(selection);

    for (const key of keys)
      if (isChecked) next.add(key);
      else next.delete(key);

    onSelectionChange(next);
  };

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <Card>
        <SectionHeader
          id={headingId}
          title={t('title')}
          description={t('description')}
        />

        <CardContent className="space-y-4">
          <fieldset className="min-w-0">
            <legend className="sr-only">{t('filters.label')}</legend>

            <SegmentedControl className="w-fit max-w-full overflow-x-auto">
              {IMPORT_ROW_FILTERS.map((option) => (
                <SegmentedControlItem
                  key={option}
                  name={`${headingId}-filter`}
                  value={option}
                  checked={filter === option}
                  className="shrink-0"
                  onChange={() => {
                    setFilter(option);
                    setRequestedPage(FIRST_PAGE);
                  }}
                >
                  {t(`filters.${option}`)}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </fieldset>

          {filteredRows.length === 0 ? (
            <EmptyState message={t('empty')} />
          ) : (
            <>
              <Table label={t('label')}>
                <TableCaption className="sr-only">{t('caption')}</TableCaption>

                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <SelectAllCheckbox
                        label={t('selectAll')}
                        checked={isEveryChecked}
                        indeterminate={checkedCount > 0 && !isEveryChecked}
                        disabled={isLocked || selectableKeys.length === 0}
                        onChange={() =>
                          changeSelection(selectableKeys, !isEveryChecked)
                        }
                      />
                    </TableHead>

                    <TableHead>{t('columns.row')}</TableHead>

                    <TableHead>{t('columns.date')}</TableHead>

                    <TableHead>{t('columns.type')}</TableHead>

                    <TableHead>{t('columns.asset')}</TableHead>

                    <TableHead className="text-right max-sm:hidden">
                      {t('columns.quantity')}
                    </TableHead>

                    <TableHead className="text-right max-md:hidden">
                      {t('columns.unitPrice')}
                    </TableHead>

                    <TableHead className="text-right max-lg:hidden">
                      {t('columns.costs')}
                    </TableHead>

                    <TableHead>{t('columns.status')}</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {pageRows.map((row) => {
                    const rowId = rowIdOf(row);
                    const reference = rowReferenceOf(row, tAssets);
                    const isExpanded = expandedRowId === rowId;
                    const notes = rowNotesOf(row, t);
                    const { entry } = row;
                    const isChecked =
                      row.key !== null && selection.has(row.key);

                    return (
                      <Fragment key={rowId}>
                        <TableRow
                          data-state={isChecked ? 'selected' : undefined}
                          className={cn(isExpanded && 'border-b-0')}
                        >
                          <TableCell className="align-top">
                            {isSelectableRow(row) && (
                              <input
                                type="checkbox"
                                aria-label={t('selectRow', { row: reference })}
                                checked={isChecked}
                                disabled={isLocked}
                                className={CHECKBOX_CLASS}
                                onChange={(event) =>
                                  changeSelection(
                                    [row.key],
                                    event.target.checked
                                  )
                                }
                              />
                            )}
                          </TableCell>

                          <TableRowHeader className="align-top whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="xxs"
                              className="-ml-2 gap-1 font-normal text-muted-foreground"
                              aria-expanded={isExpanded}
                              aria-label={
                                isExpanded
                                  ? t('hideOriginal', { row: reference })
                                  : t('showOriginal', { row: reference })
                              }
                              onClick={() =>
                                setExpandedRowId(isExpanded ? null : rowId)
                              }
                            >
                              <ChevronDown
                                aria-hidden="true"
                                className={cn(
                                  'size-3.5 transition-transform',
                                  isExpanded && 'rotate-180'
                                )}
                              />

                              {reference}
                            </Button>
                          </TableRowHeader>

                          <TableCell className="align-top whitespace-nowrap">
                            {entry === null ? (
                              <UnavailableValue />
                            ) : (
                              <time dateTime={entry.tradeDate}>
                                {formatCalendarDay(entry.tradeDate) ??
                                  entry.tradeDate}
                              </time>
                            )}
                          </TableCell>

                          <TableCell
                            className={cn(
                              'align-top whitespace-nowrap',
                              entry !== null &&
                                TRANSACTION_TYPE_TONES[entry.type]
                            )}
                          >
                            {entry === null ? (
                              <UnavailableValue />
                            ) : (
                              tTypes(entry.type)
                            )}
                          </TableCell>

                          <TableCell className="align-top font-medium">
                            {entry?.symbol ?? <UnavailableValue />}
                          </TableCell>

                          <TableCell className="text-right align-top max-sm:hidden">
                            <Quantity value={entry?.quantity} />
                          </TableCell>

                          <TableCell className="text-right align-top whitespace-nowrap max-md:hidden">
                            {entry?.currency ? (
                              <Price
                                exact
                                value={entry.unitPrice}
                                currency={entry.currency}
                              />
                            ) : (
                              <Quantity value={entry?.unitPrice} />
                            )}
                          </TableCell>

                          <TableCell className="text-right align-top whitespace-nowrap max-lg:hidden">
                            {entry !== null &&
                            isNonzeroDecimal(costsOf(entry)) ? (
                              entry.currency ? (
                                <Price
                                  exact
                                  value={costsOf(entry)}
                                  currency={entry.currency}
                                />
                              ) : (
                                <Quantity value={costsOf(entry)} />
                              )
                            ) : (
                              <UnavailableValue />
                            )}
                          </TableCell>

                          <TableCell className="min-w-56 align-top">
                            <div className="space-y-1">
                              <ImportStatusBadge status={row.status} />

                              {notes.length > 0 && (
                                <ul className="space-y-0.5 text-xs text-muted-foreground">
                                  {notes.map((note) => (
                                    <li key={note}>{note}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={COLUMN_COUNT} className="pt-0">
                              <OriginalRow row={row} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>

              {totalPages > FIRST_PAGE && (
                <PageNavigation
                  label={t('pages')}
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setRequestedPage}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
};
