import { Fragment, useId, type FC, type ReactNode } from 'react';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type {
  ImportPreviewAsset,
  PositionFigures
} from '@/app/api/v1/transaction-imports';
import {
  Money,
  Price,
  ProfitLoss,
  Quantity,
  UnavailableValue
} from '@/components/financial';
import { SectionHeader } from '@/components/section-header';
import {
  Card,
  CardContent,
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
import { compareDecimals } from '@/lib/decimal';
import { cn } from '@/lib/utils';
import type { DecimalString } from '@/types';

import { rowReferenceOf } from './import-display';

type ImportAssetsSectionProps = Record<'assets', Array<ImportPreviewAsset>>;

type FigureCellProps = Record<'figure', keyof PositionFigures> &
  Record<'asset', ImportPreviewAsset> &
  Record<'render', (value: DecimalString, currency: string) => ReactNode> &
  Partial<Record<'className', string>>;

const COLUMN_COUNT = 7;

const RESOLUTION_TONES: Record<ImportPreviewAsset['resolution'], string> = {
  held: 'text-muted-foreground',
  tracked: 'text-primary',
  listed: 'text-primary',
  unresolved: 'text-negative'
};

const FigureCell: FC<FigureCellProps> = ({
  figure,
  asset: { before, after, currency },
  render,
  className
}) => {
  const t = useTranslations('imports.assets');

  if (currency === null)
    return (
      <TableCell className={cn('text-right', className)}>
        <UnavailableValue />
      </TableCell>
    );

  const afterValue = after?.[figure];
  const beforeValue = before?.[figure];

  return (
    <TableCell className={cn('text-right whitespace-nowrap', className)}>
      <span className="block">
        {afterValue === undefined ? (
          <UnavailableValue />
        ) : (
          render(afterValue, currency)
        )}
      </span>

      {beforeValue !== undefined &&
        (afterValue === undefined ||
          compareDecimals(beforeValue, afterValue) !== 0) && (
          <span className="block text-xs text-muted-foreground">
            {t.rich('was', { value: () => render(beforeValue, currency) })}
          </span>
        )}
    </TableCell>
  );
};

export const ImportAssetsSection: FC<ImportAssetsSectionProps> = ({
  assets
}) => {
  const t = useTranslations('imports.assets');
  const { formatCalendarDay } = useFormat();
  const headingId = useId();

  const refusalOf = ({ refusal }: ImportPreviewAsset) => {
    if (refusal === null) return null;

    if (refusal.reason !== 'oversold') return t(`refusals.${refusal.reason}`);

    return refusal.row === null || refusal.tradeDate === null
      ? t('refusals.oversoldUndated')
      : t('refusals.oversold', {
          row: rowReferenceOf(refusal.row, t),
          date: formatCalendarDay(refusal.tradeDate) ?? refusal.tradeDate
        });
  };

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <Card>
        <SectionHeader
          id={headingId}
          title={t('title')}
          description={t('description')}
        />

        <CardContent>
          <Table label={t('label')}>
            <TableCaption className="sr-only">{t('caption')}</TableCaption>

            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.asset')}</TableHead>

                <TableHead className="text-right">
                  {t('columns.rows')}
                </TableHead>

                <TableHead className="text-right">
                  {t('columns.quantity')}
                </TableHead>

                <TableHead className="text-right max-md:hidden">
                  {t('columns.averageCost')}
                </TableHead>

                <TableHead className="text-right max-lg:hidden">
                  {t('columns.investedValue')}
                </TableHead>

                <TableHead className="text-right max-md:hidden">
                  {t('columns.realizedProfitLoss')}
                </TableHead>

                <TableHead className="text-right max-lg:hidden">
                  {t('columns.income')}
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {assets.map((asset) => {
                const refusal = refusalOf(asset);

                return (
                  <Fragment key={asset.symbol}>
                    <TableRow className={cn(refusal !== null && 'border-b-0')}>
                      <TableRowHeader className="min-w-40">
                        <span className="block font-medium">
                          {asset.symbol}
                        </span>

                        <span className="block text-xs text-muted-foreground wrap-anywhere">
                          {asset.name !== null && `${asset.name} · `}

                          <span className={RESOLUTION_TONES[asset.resolution]}>
                            {t(`resolutions.${asset.resolution}`)}
                          </span>
                        </span>
                      </TableRowHeader>

                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {t('rows', {
                          selected: asset.selectedCount,
                          total: asset.rowCount
                        })}
                      </TableCell>

                      <FigureCell
                        figure="quantity"
                        asset={asset}
                        render={(value) => <Quantity value={value} />}
                      />

                      <FigureCell
                        figure="averageCost"
                        asset={asset}
                        className="max-md:hidden"
                        render={(value, currency) => (
                          <Price exact value={value} currency={currency} />
                        )}
                      />

                      <FigureCell
                        figure="investedValue"
                        asset={asset}
                        className="max-lg:hidden"
                        render={(value, currency) => (
                          <Money value={value} currency={currency} />
                        )}
                      />

                      <FigureCell
                        figure="realizedProfitLoss"
                        asset={asset}
                        className="max-md:hidden"
                        render={(value, currency) => (
                          <ProfitLoss value={value} currency={currency} />
                        )}
                      />

                      <TableCell className="text-right whitespace-nowrap max-lg:hidden">
                        {asset.currency === null ? (
                          <UnavailableValue />
                        ) : (
                          <Money
                            value={asset.netIncome}
                            currency={asset.currency}
                          />
                        )}
                      </TableCell>
                    </TableRow>

                    {refusal !== null && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={COLUMN_COUNT} className="pt-0">
                          <p className="flex items-start gap-2 rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">
                            <TriangleAlert
                              aria-hidden="true"
                              className="mt-0.5 size-4 shrink-0"
                            />

                            {refusal}
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
};
