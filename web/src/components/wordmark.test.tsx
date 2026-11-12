import { renderToStaticMarkup } from 'react-dom/server';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { APP_TITLE } from '@/common/constants';

import { Wordmark } from './wordmark';

describe('wordmark', () => {
  it('spells the brand as one run of text in the display face', () => {
    assert.equal(
      renderToStaticMarkup(<Wordmark />),
      `<span class="font-display font-bold">${APP_TITLE}</span>`
    );
  });

  it('takes its size and colour from where it is set', () => {
    assert.equal(
      renderToStaticMarkup(<Wordmark className="text-lg text-foreground/40" />),
      `<span class="font-display font-bold text-lg text-foreground/40">${APP_TITLE}</span>`
    );
  });
});
