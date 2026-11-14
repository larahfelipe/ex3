'use client';

import * as React from 'react';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslations } from 'use-intl';

import {
  DialogContentSignal,
  useIsDialogClosing,
  withDialogPresence
} from '@/components/ui/dialog-presence';
import { useFocusReturn } from '@/hooks/use-focus-return';
import { cn } from '@/lib/utils';

export const DIALOG_OVERLAY_CLASS =
  'fixed inset-0 z-50 bg-scrim/60 backdrop-blur-sm duration-200 ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:ease-in reduced-transparency:bg-scrim/80 reduced-transparency:backdrop-blur-none';

/**
 * The keyframes animate `transform`, which adds to the `translate` that centres
 * the dialog from `sm`, so a slide there would bring it in off its axis.
 */
export const DIALOG_CONTENT_CLASS =
  'fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-1rem)] w-full flex-col rounded-t-2xl border border-b-0 bg-surface-elevated text-surface-elevated-foreground shadow-elevated outline-hidden duration-200 ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom data-[state=closed]:ease-in sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border-b sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=closed]:zoom-out-95';

const Dialog = withDialogPresence(DialogPrimitive.Root);

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) => (
  <DialogPrimitive.Overlay
    className={cn(DIALOG_OVERLAY_CLASS, className)}
    {...props}
  />
);

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> &
  Partial<Record<'hasUnsavedChanges', boolean>>;

/**
 * With `hasUnsavedChanges`, a press outside leaves the dialog open, so a stray
 * click on the backdrop cannot throw away what was typed. Escape, the close
 * button and the form's own cancel still close it: those are deliberate.
 */
const DialogContent = ({
  className,
  children,
  hasUnsavedChanges = false,
  onPointerDownOutside,
  ...props
}: DialogContentProps) => {
  const focusReturn = useFocusReturn();
  const isClosing = useIsDialogClosing();
  const t = useTranslations('common.actions');

  return (
    <DialogPortal>
      <DialogOverlay />

      <DialogPrimitive.Content
        {...focusReturn}
        inert={isClosing}
        className={cn(DIALOG_CONTENT_CLASS, 'overflow-hidden', className)}
        onPointerDownOutside={(event) => {
          if (hasUnsavedChanges) event.preventDefault();

          onPointerDownOutside?.(event);
        }}
        {...props}
      >
        <DialogContentSignal />

        {children}

        <DialogPrimitive.Close className="absolute right-1 top-2.5 inline-flex size-11 items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none sm:right-2 sm:top-2 sm:size-8">
          <X className="size-4" />

          <span className="sr-only">{t('close')}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
};

const DialogHeader = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    className={cn(
      'flex shrink-0 flex-col space-y-1.5 px-5 pt-5 text-center sm:text-left',
      className
    )}
    {...props}
  />
);

const DialogBody = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    className={cn(
      'grid min-h-0 flex-1 grid-cols-1 content-start gap-4 overflow-y-auto overscroll-contain px-5 py-4',
      className
    )}
    {...props}
  />
);

const DialogFooter = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    className={cn(
      'flex shrink-0 flex-col-reverse gap-2 border-t px-5 pb-5 pt-4 sm:flex-row sm:justify-end',
      className
    )}
    {...props}
  />
);

/** Its first line runs beside the close button, so it keeps clear of it, on both sides while centered. */
const DialogTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title
    className={cn(
      'pr-7 text-lg font-semibold leading-tight tracking-tight max-sm:in-[.text-center]:pl-7',
      className
    )}
    {...props}
  />
);

const DialogDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
);

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger
};
