import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { nbsp, renderWithIntl, textOf } from '@/test/intl';

import { ProfitLoss, Trend } from './financial';

describe('a change', () => {
  it('leads a gain with a rising arrow, hidden from assistive technology, in the gain’s tone', () => {
    const markup = renderWithIntl(
      <ProfitLoss value="245.5" percent="0.0139" currency="BRL" />
    );

    assert.match(
      markup,
      /^<span class="[^"]*text-positive"><span class="whitespace-nowrap"><svg [^>]*class="lucide lucide-trending-up [^"]*size-\[0\.8em\][^"]*" aria-hidden="true">/
    );
    assert.equal(textOf(markup), `${nbsp('+R$ 245,50')}+1,39%`);
  });

  it('leads a loss with a falling arrow and a flat result with none', () => {
    assert.match(
      renderWithIntl(<Trend value="-0.0085" />),
      /^<span class="whitespace-nowrap text-negative"><svg [^>]*class="lucide lucide-trending-down /
    );
    assert.equal(
      renderWithIntl(<Trend value="0" />),
      '<span class="whitespace-nowrap text-muted-foreground">0%</span>'
    );
    assert.equal(
      renderWithIntl(
        <ProfitLoss value="0" percent="0" currency="BRL" />
      ).includes('<svg'),
      false
    );
  });

  it('leaves the arrow out where the cell has no room for it', () => {
    assert.equal(
      renderWithIntl(<Trend value="0.0534" hasArrow={false} />),
      '<span class="whitespace-nowrap text-positive">+5,34%</span>'
    );
  });
});
