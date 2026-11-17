import { spring } from 'framer-motion';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  METER_FADE_SPRING,
  METER_FADE_SPRING_CSS,
  METER_FILL_SPRING,
  METER_FILL_SPRING_CSS,
  TAB_SPRING,
  TAB_SPRING_CSS
} from './motion';

describe('motion', () => {
  it('slides by CSS on the same spring as framer-motion animates', () => {
    const { visualDuration, bounce } = TAB_SPRING;

    assert.equal(
      TAB_SPRING_CSS,
      spring({ keyframes: [0, 1], visualDuration, bounce }).toString()
    );
  });

  it('fills and fades the password meter by CSS on the springs it names', () => {
    for (const [{ stiffness, damping, mass }, { duration, easing }] of [
      [METER_FILL_SPRING, METER_FILL_SPRING_CSS],
      [METER_FADE_SPRING, METER_FADE_SPRING_CSS]
    ] as const)
      assert.equal(
        `${duration} ${easing}`,
        spring({ keyframes: [0, 1], stiffness, damping, mass }).toString()
      );
  });
});
