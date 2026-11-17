'use client';

import {
  useEffect,
  useRef,
  useState,
  type FC,
  type Key,
  type ReactNode
} from 'react';

import {
  AnimatePresence,
  m,
  useIsPresent,
  useReducedMotion
} from 'framer-motion';

import { MotionScope } from '@/components/motion-scope';
import {
  TAB_PANEL_HEIGHT_TRANSITION,
  TAB_PANEL_VARIANTS,
  type SlideDirection
} from '@/lib/motion';
import type { Children } from '@/types';

type SlideTransitionProps = {
  panelKey: Key;
  direction: SlideDirection;
  children: ReactNode;
};

const LeavingPanelGuard: FC<Children> = ({ children }) => {
  const isPresent = useIsPresent();

  return <div inert={!isPresent}>{children}</div>;
};

export const SlideTransition: FC<SlideTransitionProps> = ({
  panelKey,
  direction,
  children
}) => {
  const panelsRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<'auto' | number>('auto');
  const [shownKey, setShownKey] = useState(panelKey);
  const [isSwitching, setIsSwitching] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  if (panelKey !== shownKey) {
    setShownKey(panelKey);
    setIsSwitching(true);
  }

  useEffect(() => {
    const panels = panelsRef.current;

    if (!panels) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setPanelHeight(entry.borderBoxSize[0]?.blockSize ?? 'auto');
    });

    observer.observe(panels);

    return () => observer.disconnect();
  }, []);

  return (
    <MotionScope>
      <m.div
        initial={false}
        animate={{ height: panelHeight }}
        transition={
          isSwitching && !shouldReduceMotion
            ? TAB_PANEL_HEIGHT_TRANSITION
            : { duration: 0 }
        }
        className="-m-1.5 overflow-hidden"
      >
        <div ref={panelsRef} className="relative p-1.5">
          <AnimatePresence
            initial={false}
            mode="popLayout"
            custom={direction}
            onExitComplete={() => setIsSwitching(false)}
          >
            <m.div
              key={panelKey}
              custom={direction}
              variants={TAB_PANEL_VARIANTS}
              initial="enter"
              animate="present"
              exit="exit"
            >
              <LeavingPanelGuard>{children}</LeavingPanelGuard>
            </m.div>
          </AnimatePresence>
        </div>
      </m.div>
    </MotionScope>
  );
};
