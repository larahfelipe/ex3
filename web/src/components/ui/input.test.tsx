import { Search } from 'lucide-react';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderWithIntl } from '@/test/intl';

import { Input } from './input';

const leadingIconOf = (markup: string) =>
  /^<div [^>]*><div class="pointer-events-none absolute left-2\.5 flex"><svg [^>]*class="lucide lucide-([a-z-]+) text-muted-foreground" aria-hidden="true">/.exec(
    markup
  )?.[1];

describe('input', () => {
  it('leads an email field with an envelope and a password field with a key, clear of the text', () => {
    const email = renderWithIntl(<Input type="email" />);
    const password = renderWithIntl(<Input type="password" />);

    assert.equal(leadingIconOf(email), 'mail');
    assert.equal(leadingIconOf(password), 'key-round');
    assert.match(email, /<input type="email" class="[^"]* pl-8"/);
  });

  it('leaves other fields bare and lets a field bring its own icon', () => {
    assert.equal(
      leadingIconOf(renderWithIntl(<Input type="text" />)),
      undefined
    );
    assert.equal(
      leadingIconOf(
        renderWithIntl(
          <Input
            type="email"
            leftElement={
              <Search
                aria-hidden="true"
                size={16}
                className="text-muted-foreground"
              />
            }
          />
        )
      ),
      'search'
    );
  });

  it('offers to show a hidden password with an open eye', () => {
    assert.match(
      renderWithIntl(<Input type="password" />),
      /<button [^>]*aria-label="Mostrar senha"[^>]*><svg [^>]*class="lucide lucide-eye"/
    );
  });
});
