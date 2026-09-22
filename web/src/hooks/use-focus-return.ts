'use client';

import { useCallback, useRef } from 'react';

/**
 * Radix returns focus to a `DialogTrigger`, and no overlay here uses one: every
 * dialog is opened from state, so its `triggerRef` is always null and focus
 * would land on `<body>` at every close. A dialog opened from a menu item
 * records the menu's trigger instead: the item unmounts as the menu closes.
 */
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
    opener.current?.focus();
  }, []);

  return { onOpenAutoFocus, onCloseAutoFocus };
};
