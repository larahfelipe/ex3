import { crc32, deflateRawSync } from 'node:zlib';

export type ZipEntry = Record<'name', string> &
  Record<'content', Buffer | string> & {
    isStored?: boolean;
  };

export type WorkbookCell = string | number | null | Record<'inline', string>;

export type WorkbookSheet = Record<'name', string> &
  Record<'rows', Array<Array<WorkbookCell>>>;

const UTF8_NAME_FLAG = 0x800;

/** A ZIP archive as a spreadsheet application writes one: deflated entries, a central directory and its end record. */
export const zipOf = (entries: Array<ZipEntry>) => {
  const localParts: Array<Buffer> = [];
  const centralParts: Array<Buffer> = [];
  let offset = 0;

  for (const { name, content, isStored = false } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.isBuffer(content)
      ? content
      : Buffer.from(content, 'utf8');
    const compressed = isStored ? data : deflateRawSync(data);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);

    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_NAME_FLAG, 6);
    local.writeUInt16LE(isStored ? 0 : 8, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);

    const central = Buffer.alloc(46);

    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_NAME_FLAG, 8);
    central.writeUInt16LE(isStored ? 0 : 8, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);

    localParts.push(local, nameBytes, compressed);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);

  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDirectory, end]);
};

const escapeXml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const columnNameOf = (index: number): string =>
  index < 26
    ? String.fromCharCode(65 + index)
    : columnNameOf(Math.floor(index / 26) - 1) +
      String.fromCharCode(65 + (index % 26));

/** The parts of a minimal Office Open XML workbook: text in shared strings, numbers as stored values. */
export const workbookEntriesOf = (
  sheets: Array<WorkbookSheet>,
  { date1904 = false }: { date1904?: boolean } = {}
): Array<ZipEntry> => {
  const sharedStrings: Array<string> = [];
  const sharedIndexOf = (text: string) => {
    const known = sharedStrings.indexOf(text);

    if (known !== -1) return known;

    sharedStrings.push(text);

    return sharedStrings.length - 1;
  };

  const worksheets = sheets.map(({ rows }) => {
    const rowsXml = rows
      .map((cells, rowIndex) => {
        const cellsXml = cells
          .map((cell, columnIndex) => {
            const reference = `${columnNameOf(columnIndex)}${rowIndex + 1}`;

            if (cell === null) return '';

            if (typeof cell === 'number')
              return `<c r="${reference}" s="1"><v>${cell}</v></c>`;

            if (typeof cell === 'object')
              return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(cell.inline)}</t></is></c>`;

            return `<c r="${reference}" t="s"><v>${sharedIndexOf(cell)}</v></c>`;
          })
          .join('');

        return `<row r="${rowIndex + 1}">${cellsXml}</row>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
  });

  const relationship = (id: string, type: string, target: string) =>
    `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;

  return [
    {
      name: '[Content_Types].xml',
      content:
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationship('rId1', 'officeDocument', 'xl/workbook.xml')}</Relationships>`
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr${date1904 ? ' date1904="1"' : ''}/><sheets>${sheets
        .map(
          ({ name }, index) =>
            `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rIdSheet${index + 1}"/>`
        )
        .join('')}</sheets></workbook>`
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map((_, index) =>
          relationship(
            `rIdSheet${index + 1}`,
            'worksheet',
            `worksheets/sheet${index + 1}.xml`
          )
        )
        .join(
          ''
        )}${relationship('rIdStrings', 'sharedStrings', 'sharedStrings.xml')}</Relationships>`
    },
    ...worksheets.map((content, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content
    })),
    {
      name: 'xl/sharedStrings.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">${sharedStrings
        .map(
          (text) => `<si><t xml:space="preserve">${escapeXml(text)}</t></si>`
        )
        .join('')}</sst>`
    }
  ];
};

export const workbookOf = (
  sheets: Array<WorkbookSheet>,
  options?: { date1904?: boolean }
) => zipOf(workbookEntriesOf(sheets, options));
