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

const useIsDialogClosing = () =>
  React.use(DialogPresenceContext)?.isClosing ?? false;

export {
  DialogContentSignal,
  DialogPresence,
  useIsDialogClosing,
  withDialogPresence
};
