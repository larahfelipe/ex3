import { AssetDetail } from './_components/asset-detail';

type AssetPageProps = Record<'params', Promise<Record<'symbol', string>>>;

export default async function AssetPage({ params }: AssetPageProps) {
  const { symbol } = await params;

  return <AssetDetail symbol={symbol} />;
}
