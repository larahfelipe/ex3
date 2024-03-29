'use client';

import {
  AssetsTable,
  type ActionType,
  type Asset
} from '@/components/assets-table';

export default function Dashboard() {
  const handleAction = (type: ActionType, payload?: Asset) => {
    return { type, payload };
  };

  return (
    <div className="mt-12 sm:mx-4">
      <AssetsTable onAction={handleAction} />
    </div>
  );
}
