import type { FC } from 'react';

import { Button } from '@/components/ui';

type LoadErrorAlertProps = Record<'message', string> &
  Record<'onRetry', () => unknown>;

export const LoadErrorAlert: FC<LoadErrorAlertProps> = ({
  message,
  onRetry
}) => (
  <div role="alert" className="flex flex-col items-start gap-3">
    <p className="text-sm text-red-500">{message}</p>

    <Button
      variant="secondary"
      className="h-9 max-sm:w-full"
      onClick={() => onRetry()}
    >
      Try again
    </Button>
  </div>
);
