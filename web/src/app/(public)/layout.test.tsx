import { renderToStaticMarkup } from 'react-dom/server';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { APP_TITLE } from '@/common/constants';
import { textOf } from '@/test/intl';

import Layout from './layout';

const PAGE_TITLE = 'Sign in';

const markup = renderToStaticMarkup(
  <QueryClientProvider client={new QueryClient()}>
    <Layout>
      <h1>{PAGE_TITLE}</h1>
    </Layout>
  </QueryClientProvider>
);

const HIDDEN_OPENING = '<div aria-hidden="true"';

/** Each `aria-hidden` element, from its opening tag to the one that closes it. */
const hiddenBlocksOf = (html: string) => {
  const blocks: Array<string> = [];

  for (
    let start = html.indexOf(HIDDEN_OPENING);
    start !== -1;
    start = html.indexOf(HIDDEN_OPENING, start + 1)
  ) {
    const tags = /<\/?div\b/g;
    tags.lastIndex = start;

    for (let depth = 0, tag = tags.exec(html); tag; tag = tags.exec(html)) {
      depth += tag[0] === '<div' ? 1 : -1;

      if (depth === 0) {
        blocks.push(html.slice(start, html.indexOf('>', tag.index) + 1));
        break;
      }
    }
  }

  return blocks;
};

const WORDMARK = `<span class="font-display font-bold">${APP_TITLE}</span>`;

/** The class of the paragraph that sets the wordmark. */
const brandClassOf = (html: string) =>
  new RegExp(`<p class="([^"]+)">${WORDMARK}`).exec(html)?.[1];

describe('authentication layout', () => {
  it('names the brand once to assistive technology, in the form column', () => {
    const exposed = hiddenBlocksOf(markup).reduce(
      (html, block) => html.replace(block, ''),
      markup
    );

    assert.equal(textOf(exposed), `${APP_TITLE}${PAGE_TITLE}`);
    assert.equal(exposed.split(WORDMARK).length - 1, 1);
  });

  it('shows the brand centred above the form below lg and on the panel from lg', () => {
    const header = /<header[^>]*>.*?<\/header>/.exec(markup)?.[0] ?? '';
    const panel = hiddenBlocksOf(markup).find((block) =>
      block.includes(APP_TITLE)
    );
    const headerBrandClass = brandClassOf(header);

    assert.ok(
      headerBrandClass,
      'the brand is not the header of the form column'
    );
    assert.match(headerBrandClass, /(^|\s)lg:sr-only(\s|$)/);
    assert.match(headerBrandClass, /(^|\s)text-center(\s|$)/);
    assert.doesNotMatch(headerBrandClass, /(^|\s)(sr-only|hidden)(\s|$)/);

    assert.ok(panel, 'the panel does not carry the brand');
    assert.match(panel, /^<div [^>]*class="[^"]*(^|\s)max-lg:hidden(\s|$)/);
    assert.ok(brandClassOf(panel));
  });

  it('sets the wordmark in the text colour, at the same opacity in both places', () => {
    const brandClasses = Array.from(
      markup.matchAll(new RegExp(`<p class="([^"]+)">${WORDMARK}`, 'g')),
      ([, brandClass]) => brandClass
    );

    assert.equal(brandClasses.length, 2);
    for (const brandClass of brandClasses)
      assert.match(brandClass, /(^|\s)text-foreground\/40(\s|$)/);
  });

  it('paints the glow only with colours that both themes define', () => {
    const stylesheet = readFileSync(
      new URL('../globals.css', import.meta.url),
      'utf8'
    );
    const blockOf = (opening: string) => {
      const start = stylesheet.indexOf(opening);

      assert.notEqual(start, -1, `${opening} is not in globals.css`);

      return stylesheet.slice(start, stylesheet.indexOf('}', start));
    };
    const tokens = Array.from(
      blockOf('@utility bg-brand-glow {').matchAll(/hsl\(var\((--[a-z-]+)\)/g),
      ([, token]) => token
    );

    assert.ok(tokens.length > 0);
    for (const token of new Set(tokens))
      for (const theme of ['  :root {', '  .dark {'])
        assert.match(blockOf(theme), new RegExp(`${token}: `));
  });
});
