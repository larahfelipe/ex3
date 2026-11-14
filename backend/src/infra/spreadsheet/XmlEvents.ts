import { SheetFormatError } from './Sheet';

export type XmlEvent =
  | (Record<'kind', 'open'> &
      Record<'name', string> &
      Record<'attributes', ReadonlyMap<string, string>> &
      Record<'isEmpty', boolean>)
  | (Record<'kind', 'close'> & Record<'name', string>)
  | (Record<'kind', 'text'> & Record<'text', string>);

const PREDEFINED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"'
};

const MAX_CODE_POINT = 0x10ffff;

const malformed = () =>
  new SheetFormatError('malformed', 'The workbook XML is malformed');

/**
 * Only the five predefined entities and character references are expanded.
 * Document type declarations are refused, so the file cannot define an entity
 * of its own to expand.
 */
export const decodeXmlText = (text: string) =>
  text.includes('&')
    ? text.replace(
        /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
        (reference, name: string) => {
          if (!name.startsWith('#'))
            return PREDEFINED_ENTITIES[name] ?? reference;

          const codePoint =
            name.startsWith('#x') || name.startsWith('#X')
              ? Number.parseInt(name.slice(2), 16)
              : Number.parseInt(name.slice(1), 10);

          if (codePoint > MAX_CODE_POINT) throw malformed();

          return String.fromCodePoint(codePoint);
        }
      )
    : text;

const localNameOf = (name: string) => name.slice(name.indexOf(':') + 1);

const isWhitespace = (character: string | undefined) =>
  character === ' ' ||
  character === '\t' ||
  character === '\n' ||
  character === '\r';

const requireIndexOf = (xml: string, search: string, from: number) => {
  const index = xml.indexOf(search, from);

  if (index === -1) throw malformed();

  return index;
};

const tagEndOf = (xml: string, from: number) => {
  let quote: string | null = null;

  for (let at = from; at < xml.length; at += 1) {
    const character = xml[at];

    if (quote !== null) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") quote = character;
    else if (character === '>') return at;
  }

  throw malformed();
};

const attributesOf = (source: string) => {
  const attributes = new Map<string, string>();
  let at = 0;

  while (at < source.length) {
    while (isWhitespace(source[at])) at += 1;

    if (at >= source.length) break;

    const equalsAt = requireIndexOf(source, '=', at);
    const name = source.slice(at, equalsAt).trim();
    let quoteAt = equalsAt + 1;

    while (isWhitespace(source[quoteAt])) quoteAt += 1;

    const quote = source[quoteAt];

    if (name === '' || (quote !== '"' && quote !== "'")) throw malformed();

    const closeAt = requireIndexOf(source, quote, quoteAt + 1);

    attributes.set(name, decodeXmlText(source.slice(quoteAt + 1, closeAt)));
    at = closeAt + 1;
  }

  return attributes;
};

/**
 * The elements and text of an XML document in document order, element names
 * without their namespace prefix. Every construct is found by a forward search
 * that either succeeds or fails the whole document, so reading takes time in
 * proportion to its length whatever it holds. A document type declaration is
 * refused outright.
 */
export function* xmlEventsOf(xml: string): Generator<XmlEvent> {
  let at = 0;

  while (at < xml.length) {
    const tagAt = xml.indexOf('<', at);

    if (tagAt === -1) {
      yield { kind: 'text', text: decodeXmlText(xml.slice(at)) };

      return;
    }

    if (tagAt > at)
      yield { kind: 'text', text: decodeXmlText(xml.slice(at, tagAt)) };

    if (xml.startsWith('<![CDATA[', tagAt)) {
      const endAt = requireIndexOf(xml, ']]>', tagAt + 9);

      yield { kind: 'text', text: xml.slice(tagAt + 9, endAt) };
      at = endAt + 3;
    } else if (xml.startsWith('<!--', tagAt))
      at = requireIndexOf(xml, '-->', tagAt + 4) + 3;
    else if (xml.startsWith('<?', tagAt))
      at = requireIndexOf(xml, '?>', tagAt + 2) + 2;
    else if (xml.startsWith('<!', tagAt))
      throw new SheetFormatError(
        'malformed',
        'Document type declarations are not accepted'
      );
    else {
      const endAt = tagEndOf(xml, tagAt + 1);
      const body = xml.slice(tagAt + 1, endAt);

      if (body.startsWith('/'))
        yield { kind: 'close', name: localNameOf(body.slice(1).trim()) };
      else {
        const isEmpty = body.endsWith('/');
        const content = isEmpty ? body.slice(0, -1) : body;
        let nameEnd = 0;

        while (nameEnd < content.length && !isWhitespace(content[nameEnd]))
          nameEnd += 1;

        if (nameEnd === 0) throw malformed();

        yield {
          kind: 'open',
          name: localNameOf(content.slice(0, nameEnd)),
          attributes: attributesOf(content.slice(nameEnd)),
          isEmpty
        };
      }

      at = endAt + 1;
    }
  }
}
