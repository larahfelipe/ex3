'use client';

import { useCallback, useRef } from 'react';

export const useFocusReturn = () => {
  const opener = useRef<HTMLElement | null>(null);

  const onOpenAutoFocus = useCallback(() => {
    const { activeElement } = document;
    const menuTriggerId = activeElement
      ?.closest('[role="menu"]')
      ?.getAttribute('aria-labelledby');
    const menuTrigger = menuTriggerId
      ? document.getElementById(menuTriggerId)
      : null;

    opener.current =
      menuTrigger ??
      (activeElement instanceof HTMLElement ? activeElement : null);
  }, []);

  const onCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault();

    if (
      document.activeElement?.closest('[role="dialog"], [role="alertdialog"]')
    )
      return;

    opener.current?.focus();
  }, []);

  return { onOpenAutoFocus, onCloseAutoFocus };
};
