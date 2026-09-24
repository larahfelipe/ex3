'use client';

import { type CSSProperties, useEffect, useRef } from 'react';

import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { Toaster as Sonner } from 'sonner';

import { APP_THEME } from '@/common/constants';
import { TOAST_LIFETIME_MS, toastLifetimeOf } from '@/lib/toast-lifetime';

/**
 * sonner's styles are injected unlayered after the app's, so the classes that
 * override them carry the important modifier. The countdown bar is drawn in
 * `globals.css`.
 */
const FOCUS_RING_CLASSES =
  'focus-visible:outline-hidden! focus-visible:ring-2! focus-visible:ring-focus!';

export function Toaster() {
  const toasterRef = useRef<HTMLElement>(null);

  /**
   * sonner holds its timers while the document is hidden, and the countdown
   * bars follow `data-document-hidden`. A hidden document is not rendered, so
   * nothing would apply the pause before it shows again: reading the
   * animations resolves the style at once.
   */
  useEffect(() => {
    const toaster = toasterRef.current;

    if (!toaster) return;

    const followDocumentVisibility = () => {
      toaster.toggleAttribute('data-document-hidden', document.hidden);
      toaster.getAnimations({ subtree: true });
    };

    followDocumentVisibility();
    document.addEventListener('visibilitychange', followDocumentVisibility);

    return () =>
      document.removeEventListener(
        'visibilitychange',
        followDocumentVisibility
      );
  }, []);

  return (
    <Sonner
      ref={toasterRef}
      position="bottom-right"
      theme={APP_THEME}
      closeButton
      icons={{
        error: (
          <CircleAlert aria-hidden="true" size={22} className="text-negative" />
        ),
        success: (
          <CircleCheck aria-hidden="true" size={22} className="text-positive" />
        ),
        warning: (
          <TriangleAlert
            aria-hidden="true"
            size={22}
            className="text-warning"
          />
        ),
        info: <Info aria-hidden="true" size={22} className="text-info" />
      }}
      style={
        {
          '--normal-bg': 'hsl(var(--surface-elevated))',
          '--normal-bg-hover': 'hsl(var(--accent))',
          '--normal-text': 'hsl(var(--surface-elevated-foreground))',
          '--normal-border': 'hsl(var(--border))',
          '--normal-border-hover': 'hsl(var(--border))',
          '--toast-close-button-start': 'unset',
          '--toast-close-button-end': '0',
          '--toast-close-button-transform': 'translate(35%, -35%)'
        } as CSSProperties
      }
      toastOptions={{
        ...toastLifetimeOf(TOAST_LIFETIME_MS),
        classNames: {
          toast: 'items-start! gap-3! border-l-4! shadow-elevated!',
          icon: 'size-[22px]!',
          title: 'text-sm font-medium',
          description: 'text-sm text-surface-elevated-foreground/80!',
          actionButton: FOCUS_RING_CLASSES,
          closeButton: FOCUS_RING_CLASSES,
          error: 'border-l-negative!',
          success: 'border-l-positive!',
          warning: 'border-l-warning!',
          info: 'border-l-info!'
        }
      }}
    />
  );
}
