import type { Metadata } from 'next';

import { AssetDetail } from './_components/asset-detail';

type AssetPageProps = Record<'params', Promise<Record<'symbol', string>>>;

export const generateMetadata = async ({
  params
}: AssetPageProps): Promise<Metadata> => {
  const { symbol } = await params;

  return { title: symbol.toUpperCase() };
};

export default async function AssetPage({ params }: AssetPageProps) {
  const { symbol } = await params;

  return <AssetDetail symbol={symbol} />;
}
