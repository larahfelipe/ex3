import { renderToStaticMarkup } from 'react-dom/server';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SegmentedControl, SegmentedControlItem } from './segmented-control';

const renderControl = (checked: string) =>
  renderToStaticMarkup(
    <SegmentedControl>
      {['1M', '6M', '1A'].map((range) => (
        <SegmentedControlItem
          key={range}
          name="range"
          value={range}
          checked={range === checked}
          readOnly
        >
          {range}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );

describe('segmented control', () => {
  it('fills the checked option by CSS until its indicator is placed in the browser', () => {
    const markup = renderControl('6M');

    assert.doesNotMatch(markup, /aria-hidden/);
    assert.equal(markup.match(/peer-checked:bg-primary/g)?.length, 3);
    assert.match(markup, /<input [^>]*checked="" value="6M"\/>/);
  });

  it('keeps each option over the indicator, positioned after it', () => {
    const markup = renderControl('1M');

    assert.match(markup, /^<div class="group\/segmented relative /);
    assert.equal(markup.match(/<span class="relative flex h-full/g)?.length, 3);
  });
});
