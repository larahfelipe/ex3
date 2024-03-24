'use client';

import {
  PortfolioTable,
  type ActionType,
  type Asset
} from '@/components/portfolio-table';

export default function Dashboard() {
  const handleAction = (type: ActionType, payload?: Asset) => {
    return { type, payload };
  };

  return (
    <div className="mt-12 mx-4 sm:mx-16">
      <PortfolioTable onAction={handleAction} />
    </div>
  );
}
