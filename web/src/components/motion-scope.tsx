'use client';

import type { FC } from 'react';

import { LazyMotion, MotionConfig } from 'framer-motion';

import type { Children } from '@/types';

const loadMotionFeatures = () =>
  import('@/lib/motion-features').then(({ motionFeatures }) => motionFeatures);

/**
 * Wraps each animated primitive instead of the app, so a route that animates
 * nothing downloads nothing of the library. The `m` components render at once
 * and animate once the features arrive in their own chunk; `strict` refuses a
 * full `motion` component, which would pull the features into the route. Under
 * `prefers-reduced-motion`, transform and layout animations are dropped and
 * fades kept.
 */
export const MotionScope: FC<Children> = ({ children }) => (
  <LazyMotion features={loadMotionFeatures} strict>
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  </LazyMotion>
);
