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

/**
 * One panel at a time, keyed by `panelKey`. The leaving panel is popped out of
 * the flow and made inert while it slides away, the arriving one slides in from
 * `direction`, and the frame animates to the arriving panel's measured height
 * instead of jumping to it and moving what sits below. The frame clips the
 * slide; the negative margin and the padding keep focus rings inside the clip.
 */
export const SlideTransition: FC<SlideTransitionProps> = ({
  panelKey,
  direction,
  children
}) => {
  const panelsRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<'auto' | number>('auto');
  const shouldReduceMotion = useReducedMotion();

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
          shouldReduceMotion ? { duration: 0 } : TAB_PANEL_HEIGHT_TRANSITION
        }
        className="-m-1.5 overflow-hidden"
      >
        <div ref={panelsRef} className="relative p-1.5">
          <AnimatePresence initial={false} mode="popLayout" custom={direction}>
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
