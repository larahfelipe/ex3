'use client';

import * as React from 'react';

import { AnimatePresence, useIsPresent, usePresence } from 'framer-motion';

import type { Children } from '@/types';

type DialogPresenceState = Record<'isClosing', boolean> &
  Record<'onContentMountChange', (isMounted: boolean) => void>;

const DialogPresenceContext = React.createContext<DialogPresenceState | null>(
  null
);

type Generations = Record<'keys', readonly React.Key[]> &
  Record<'counts', ReadonlyMap<React.Key, number>>;

/**
 * Most dialogs here are rendered only while open, so a parent closing one
 * would remove it before its exit animation could play. A dialog that its
 * parent stops rendering inside `DialogPresence` stays in the tree, closes as
 * though `open` had turned false, and leaves once Radix has unmounted its
 * content at the end of the exit. A group of dialogs that leaves closes the
 * ones open inside it. Siblings are told apart by `key`, so each needs one.
 *
 * A key that comes back while its dialog is still leaving opens a new one
 * beside it rather than reviving it, so every opening starts from fresh state
 * and focus.
 *
 * Inside a group that is leaving, the children are let go: `AnimatePresence`
 * would otherwise take a render of the group during its exit, a refetch after
 * a deletion, for one, as the same keys entering beside the ones leaving.
 */
const DialogPresence = ({ children }: Children) => {
  const isParentPresent = useIsPresent();
  const elements = React.Children.toArray(children).filter(
    React.isValidElement
  );
  const keys = elements.map(({ key }) => key ?? '');
  const [generations, setGenerations] = React.useState<Generations>(() => ({
    keys,
    counts: new Map()
  }));
  let { counts } = generations;

  if (
    keys.length !== generations.keys.length ||
    keys.some((key, index) => key !== generations.keys[index])
  ) {
    const nextCounts = new Map(counts);

    for (const key of keys) {
      if (!generations.keys.includes(key))
        nextCounts.set(key, (counts.get(key) ?? 0) + 1);
    }

    counts = nextCounts;
    setGenerations({ keys, counts });
  }

  return (
    <AnimatePresence propagate>
      {isParentPresent
        ? elements.map((element) =>
            React.cloneElement(element, {
              key: `${element.key}~${counts.get(element.key ?? '') ?? 0}`
            })
          )
        : null}
    </AnimatePresence>
  );
};

/**
 * Wraps a Radix root so it closes once `DialogPresence` lets go of it, and
 * lets go in turn when it has no content mounted: at the end of the exit, or
 * at once when it was already closed. Outside `DialogPresence` it passes
 * `open` through.
 */
const withDialogPresence = <Props extends Partial<Record<'open', boolean>>>(
  Root: React.ComponentType<Props>
) => {
  const PresentRoot = (props: Props) => {
    const [isPresent, safeToRemove] = usePresence();
    const [isContentMounted, setIsContentMounted] = React.useState(false);
    const open = isPresent ? props.open : false;
    const state = React.useMemo(
      () => ({
        isClosing: open === false,
        onContentMountChange: setIsContentMounted
      }),
      [open]
    );

    React.useEffect(() => {
      if (!isPresent && !isContentMounted) safeToRemove?.();
    }, [isPresent, isContentMounted, safeToRemove]);

    return (
      <DialogPresenceContext value={state}>
        <Root {...props} open={open} />
      </DialogPresenceContext>
    );
  };

  return PresentRoot;
};

/** Rendered inside the Radix content, which unmounts it as the exit animation ends. */
const DialogContentSignal = () => {
  const onContentMountChange = React.use(
    DialogPresenceContext
  )?.onContentMountChange;

  React.useEffect(() => {
    onContentMountChange?.(true);

    return () => onContentMountChange?.(false);
  }, [onContentMountChange]);

  return null;
};

/** Content that is animating out is made inert, so a second press cannot submit a form already closing. */
const useIsDialogClosing = () =>
  React.use(DialogPresenceContext)?.isClosing ?? false;

export {
  DialogContentSignal,
  DialogPresence,
  useIsDialogClosing,
  withDialogPresence
};
