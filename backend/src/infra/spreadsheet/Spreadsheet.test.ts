import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  workbookEntriesOf,
  workbookOf,
  zipOf,
  type ZipEntry
} from '@/test/WorkbookBuilder';

import { plainDecimalOf } from './PlainDecimal';
import { SheetFormatError } from './Sheet';
import { readSpreadsheet, type SpreadsheetLimits } from './Spreadsheet';

const LIMITS: SpreadsheetLimits = {
  maxEntries: 50,
  maxEntryBytes: 1024 * 1024,
  maxTotalBytes: 2 * 1024 * 1024,
  maxSheets: 5,
  maxRows: 100,
  maxColumns: 20,
  maxCellLength: 200
};

const CENTRAL_DIRECTORY_ENTRY = Buffer.from([0x50, 0x4b, 0x01, 0x02]);

const refusalOf = (bytes: Buffer, limits = LIMITS) => {
  try {
    readSpreadsheet(bytes, limits);
  } catch (error) {
    assert.ok(error instanceof SheetFormatError, String(error));

    return error.reason;
  }

  assert.fail('The file was read');
};

const valuesOf = (bytes: Buffer, sheet = 0) =>
  readSpreadsheet(bytes, LIMITS).sheets[sheet].rows.map(({ cells }) =>
    cells.map((cell) => cell?.value ?? null)
  );

const replaceEntry = (
  entries: Array<ZipEntry>,
  name: string,
  content: string
) =>
  entries.map((entry) => (entry.name === name ? { ...entry, content } : entry));

describe('plainDecimalOf', () => {
  it('reads a binary float as the decimal a spreadsheet shows', () => {
    assert.equal(plainDecimalOf(37.420000000000002), '37.42');
    assert.equal(plainDecimalOf(0.1 + 0.2), '0.3');
    assert.equal(plainDecimalOf(1500), '1500');
    assert.equal(plainDecimalOf(-12.5), '-12.5');
    assert.equal(plainDecimalOf(0), '0');
    assert.equal(plainDecimalOf(-0), '0');
  });

  it('writes very large and very small numbers without an exponent', () => {
    assert.equal(plainDecimalOf(1.5e-7), '0.00000015');
    assert.equal(plainDecimalOf(1.25e21), '1250000000000000000000');
  });

  it('answers null for a value that is not finite', () => {
    assert.equal(plainDecimalOf(Number.NaN), null);
    assert.equal(plainDecimalOf(Number.POSITIVE_INFINITY), null);
  });
});

describe('reading a workbook', () => {
  it('reads every sheet in tab order, text and numbers apart', () => {
    const bytes = workbookOf([
      {
        name: 'Negociação',
        rows: [
          ['Data do Negócio', 'Quantidade', 'Preço'],
          ['02/01/2024', 100, 37.42],
          [null, { inline: 'R&D <x>' }, 0.000001]
        ]
      },
      { name: 'Outra', rows: [['A']] }
    ]);
    const spreadsheet = readSpreadsheet(bytes, LIMITS);

    assert.equal(spreadsheet.format, 'xlsx');
    assert.deepEqual(
      spreadsheet.sheets.map(({ name }) => name),
      ['Negociação', 'Outra']
    );
    assert.deepEqual(spreadsheet.sheets[0].rows[1].cells, [
      { kind: 'text', value: '02/01/2024' },
      { kind: 'number', value: '100' },
      { kind: 'number', value: '37.42' }
    ]);
    assert.deepEqual(valuesOf(bytes)[2], [null, 'R&D <x>', '0.000001']);
  });

  it('numbers rows as the sheet does, skipping none', () => {
    const entries = replaceEntry(
      workbookEntriesOf([{ name: 'S', rows: [] }]),
      'xl/worksheets/sheet1.xml',
      '<worksheet><sheetData><row r="3"><c r="B3" t="str"><v>x</v></c></row><row/></sheetData></worksheet>'
    );
    const [sheet] = readSpreadsheet(zipOf(entries), LIMITS).sheets;

    assert.deepEqual(
      sheet.rows.map(({ number, cells }) => [number, cells]),
      [
        [3, [null, { kind: 'text', value: 'x' }]],
        [4, []]
      ]
    );
  });

  it('joins rich text runs and drops phonetic guides', () => {
    const entries = replaceEntry(
      workbookEntriesOf([{ name: 'S', rows: [['placeholder']] }]),
      'xl/sharedStrings.xml',
      '<sst><si><r><t>Juros Sobre </t></r><r><t>Capital_x000D_Próprio</t></r><rPh><t>ignored</t></rPh></si></sst>'
    );

    assert.deepEqual(valuesOf(zipOf(entries)), [
      ['Juros Sobre Capital\rPróprio']
    ]);
  });

  it('accepts element names with a namespace prefix and stored entries', () => {
    const entries = replaceEntry(
      workbookEntriesOf([{ name: 'S', rows: [] }]),
      'xl/worksheets/sheet1.xml',
      '<x:worksheet xmlns:x="ns"><x:sheetData><x:row r="1"><x:c r="A1"><x:v>2.5</x:v></x:c></x:row></x:sheetData></x:worksheet>'
    ).map((entry) => ({ ...entry, isStored: true }));

    assert.deepEqual(valuesOf(zipOf(entries)), [['2.5']]);
  });

  it('tells which epoch the date serials count from', () => {
    const date1904Of = (date1904: boolean) => {
      const spreadsheet = readSpreadsheet(
        workbookOf([{ name: 'S', rows: [] }], { date1904 }),
        LIMITS
      );

      assert.ok(spreadsheet.format === 'xlsx');

      return spreadsheet.date1904;
    };

    assert.equal(date1904Of(false), false);
    assert.equal(date1904Of(true), true);
  });

  it('ignores columns past the limit', () => {
    const wide = Array.from({ length: 30 }, (_, index) => index);

    assert.equal(
      valuesOf(workbookOf([{ name: 'S', rows: [wide] }]))[0].length,
      LIMITS.maxColumns
    );
  });
});

describe('refusing a workbook', () => {
  it('refuses a document type declaration, which could define entities', () => {
    const entries = replaceEntry(
      workbookEntriesOf([{ name: 'S', rows: [] }]),
      'xl/worksheets/sheet1.xml',
      '<?xml version="1.0"?><!DOCTYPE lol [<!ENTITY a "aaaaaaaaaa">]><worksheet><sheetData><row><c t="str"><v>&a;</v></c></row></sheetData></worksheet>'
    );

    assert.equal(refusalOf(zipOf(entries)), 'malformed');
  });

  it('refuses an entry that inflates past its budget', () => {
    const bomb = zipOf([
      ...workbookEntriesOf([{ name: 'S', rows: [] }]).filter(
        ({ name }) => name !== 'xl/worksheets/sheet1.xml'
      ),
      { name: 'xl/worksheets/sheet1.xml', content: ' '.repeat(2 * 1024 * 1024) }
    ]);

    assert.ok(bomb.length < 10_000, 'the archive compresses well');
    assert.equal(refusalOf(bomb), 'too-large');
  });

  it('refuses an entry whose declared size understates what it inflates to', () => {
    const entries = workbookEntriesOf([{ name: 'S', rows: [['a']] }]);
    const bytes = zipOf(entries);
    const centralAt = bytes.lastIndexOf('xl/sharedStrings.xml');
    const tampered = Buffer.from(bytes);

    // The central directory entry starts 46 bytes before its name; its
    // uncompressed size is at offset 24.
    tampered.writeUInt32LE(3, centralAt - 46 + 24);

    assert.equal(refusalOf(tampered), 'malformed');
  });

  it('refuses an entry whose content does not match its checksum', () => {
    const bytes = zipOf(
      workbookEntriesOf([{ name: 'S', rows: [['a']] }]).map((entry) => ({
        ...entry,
        isStored: true
      }))
    );
    const tampered = Buffer.from(bytes);
    const at = tampered.indexOf('<sheetData>');

    tampered.write('<sheetDatb>', at);

    assert.equal(refusalOf(tampered), 'malformed');
  });

  it('refuses truncated, encrypted and unclosed content', () => {
    const bytes = workbookOf([{ name: 'S', rows: [['a']] }]);

    assert.equal(refusalOf(bytes.subarray(0, bytes.length - 30)), 'malformed');

    const encrypted = Buffer.from(bytes);

    for (
      let at = encrypted.indexOf(CENTRAL_DIRECTORY_ENTRY);
      at !== -1;
      at = encrypted.indexOf(CENTRAL_DIRECTORY_ENTRY, at + 1)
    )
      encrypted.writeUInt16LE(0x801, at + 8);

    assert.equal(refusalOf(encrypted), 'malformed');

    const unclosed = replaceEntry(
      workbookEntriesOf([{ name: 'S', rows: [] }]),
      'xl/worksheets/sheet1.xml',
      '<worksheet><sheetData><row><c t="str"><v>x</v></c></row><row r="2" '
    );

    assert.equal(refusalOf(zipOf(unclosed)), 'malformed');
  });

  it('refuses too many rows, sheets, entries or too long a cell', () => {
    const rows = Array.from({ length: LIMITS.maxRows + 1 }, () => ['x']);

    assert.equal(refusalOf(workbookOf([{ name: 'S', rows }])), 'too-large');
    assert.equal(
      refusalOf(
        workbookOf(
          Array.from({ length: LIMITS.maxSheets + 1 }, (_, index) => ({
            name: `S${index}`,
            rows: []
          }))
        )
      ),
      'too-large'
    );
    assert.equal(
      refusalOf(workbookOf([{ name: 'S', rows: [['x'.repeat(201)]] }])),
      'too-large'
    );
    assert.equal(
      refusalOf(
        zipOf(
          Array.from({ length: LIMITS.maxEntries + 1 }, (_, index) => ({
            name: `part${index}`,
            content: ''
          }))
        )
      ),
      'too-large'
    );
  });

  it('refuses a numeric cell that does not hold a number', () => {
    const entries = replaceEntry(
      workbookEntriesOf([{ name: 'S', rows: [] }]),
      'xl/worksheets/sheet1.xml',
      `<worksheet><sheetData><row><c><v>${'1'.repeat(40)}x</v></c></row></sheetData></worksheet>`
    );

    assert.equal(refusalOf(zipOf(entries)), 'malformed');
  });

  it('reads markup that never closes in time proportional to its length', () => {
    for (const worksheet of [
      `<worksheet><sheetData>${'<row><c><v>1'.repeat(50_000)}`,
      `<worksheet>${'<!--'.repeat(50_000)}`,
      `<worksheet>${'<c r="'.repeat(50_000)}`,
      `<worksheet><sheetData><row><c><v>${'&a'.repeat(50_000)}`
    ]) {
      const bytes = zipOf(
        replaceEntry(
          workbookEntriesOf([{ name: 'S', rows: [] }]),
          'xl/worksheets/sheet1.xml',
          worksheet
        )
      );
      const startedAt = performance.now();

      try {
        readSpreadsheet(bytes, LIMITS);
      } catch (error) {
        assert.ok(error instanceof SheetFormatError);
      }

      assert.ok(performance.now() - startedAt < 1000);
    }
  });

  it('refuses a legacy workbook and a PDF by their signature', () => {
    assert.equal(
      refusalOf(
        Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])
      ),
      'legacy'
    );
    assert.equal(refusalOf(Buffer.from('%PDF-1.7\n')), 'unsupported');
    assert.equal(
      refusalOf(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])),
      'malformed'
    );
  });

  it('refuses an entry that does not inflate', () => {
    const tampered = zipOf(
      workbookEntriesOf([{ name: 'S', rows: [] }]).map((entry) => ({
        ...entry,
        isStored: true
      }))
    );

    for (
      let at = tampered.indexOf(CENTRAL_DIRECTORY_ENTRY);
      at !== -1;
      at = tampered.indexOf(CENTRAL_DIRECTORY_ENTRY, at + 1)
    )
      tampered.writeUInt16LE(8, at + 10);

    assert.equal(refusalOf(tampered), 'malformed');
  });
});

describe('reading delimited text', () => {
  it('reads a semicolon-delimited Brazilian file with quoted fields', () => {
    const bytes = Buffer.from(
      'Data;Ativo;Preço\r\n02/01/2024;PETR4;"37,42"\r\n"03/01/2024";"A ""B"";\nC";\r\n',
      'utf8'
    );
    const spreadsheet = readSpreadsheet(bytes, LIMITS);

    assert.ok(spreadsheet.format === 'csv');
    assert.equal(spreadsheet.delimiter, ';');
    assert.deepEqual(valuesOf(bytes), [
      ['Data', 'Ativo', 'Preço'],
      ['02/01/2024', 'PETR4', '37,42'],
      ['03/01/2024', 'A "B";\nC', null]
    ]);
  });

  it('picks the delimiter that splits the header into the most fields', () => {
    const comma = readSpreadsheet(Buffer.from('a,b,c\n1,2,3'), LIMITS);
    const tab = readSpreadsheet(Buffer.from('a\tb\tc\n1\t2\t3'), LIMITS);

    assert.ok(comma.format === 'csv' && comma.delimiter === ',');
    assert.ok(tab.format === 'csv' && tab.delimiter === '\t');
  });

  it('reads UTF-8 with or without a byte order mark, Windows-1252 and UTF-16', () => {
    const header = 'Preço;Negociação';
    const expected = [['Preço', 'Negociação']];

    assert.deepEqual(valuesOf(Buffer.from(header, 'utf8')), expected);
    assert.deepEqual(
      valuesOf(
        Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(header)])
      ),
      expected
    );
    assert.deepEqual(valuesOf(Buffer.from(header, 'latin1')), expected);
    assert.deepEqual(
      valuesOf(
        Buffer.concat([
          Buffer.from([0xff, 0xfe]),
          Buffer.from(header, 'utf16le')
        ])
      ),
      expected
    );
  });

  it('refuses binary content, an unclosed quote and too many rows', () => {
    assert.equal(refusalOf(Buffer.from([0x61, 0x00, 0x62])), 'unsupported');
    assert.equal(refusalOf(Buffer.from('a;"b\n1;2')), 'malformed');
    assert.equal(
      refusalOf(Buffer.from('a\n'.repeat(LIMITS.maxRows + 1))),
      'too-large'
    );
  });
});
