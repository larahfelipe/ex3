'use client';

import { useCallback, useRef } from 'react';

/**
 * Radix returns focus to a `DialogTrigger`, and no overlay here uses one: every
 * dialog is opened from state, so its `triggerRef` is always null and focus
 * would land on `<body>` at every close.
 */
export const useFocusReturn = () => {
  const opener = useRef<HTMLElement | null>(null);

  const onOpenAutoFocus = useCallback(() => {
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }, []);

  const onCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    opener.current?.focus();
  }, []);

  return { onOpenAutoFocus, onCloseAutoFocus };
};
