import { spring } from 'framer-motion';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TAB_SPRING, TAB_SPRING_CSS } from './motion';

describe('motion', () => {
  it('slides by CSS on the same spring as framer-motion animates', () => {
    const { visualDuration, bounce } = TAB_SPRING;

    assert.equal(
      TAB_SPRING_CSS,
      spring({ keyframes: [0, 1], visualDuration, bounce }).toString()
    );
  });
});
