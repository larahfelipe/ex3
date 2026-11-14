'use client';

import { useCallback, useRef } from 'react';

/**
 * Radix returns focus to a `DialogTrigger`, and no overlay here uses one: every
 * dialog is opened from state, so its `triggerRef` is always null and focus
 * would land on `<body>` at every close. A dialog opened from a menu item
 * records the menu's trigger instead: the item unmounts as the menu closes.
 *
 * A dialog unmounts at the end of its exit animation, by which time another
 * may have opened, as when an action replaces a details dialog. Focus then
 * stays where the newer dialog put it.
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

    if (
      document.activeElement?.closest('[role="dialog"], [role="alertdialog"]')
    )
      return;

    opener.current?.focus();
  }, []);

  return { onOpenAutoFocus, onCloseAutoFocus };
};
