'use client';

import type { FC } from 'react';

import { LazyMotion, MotionConfig } from 'framer-motion';

import { useNonce } from '@/providers/nonce-provider';
import type { Children } from '@/types';

const loadMotionFeatures = () =>
  import('@/lib/motion-features').then(({ motionFeatures }) => motionFeatures);

export const MotionScope: FC<Children> = ({ children }) => {
  const nonce = useNonce();

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user" nonce={nonce}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
};
