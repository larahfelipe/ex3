import { readCsvTable } from './CsvTable';
import { SheetFormatError, type SheetLimits, type Spreadsheet } from './Sheet';
import { readXlsxWorkbook } from './XlsxWorkbook';
import type { ZipLimits } from './ZipArchive';

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const COMPOUND_FILE_SIGNATURE = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1
]);
const PDF_SIGNATURE = Buffer.from('%PDF');

export type SpreadsheetLimits = SheetLimits & ZipLimits;

/**
 * The file's sheets, told apart by what the bytes are rather than by the name
 * or type the upload claims: a ZIP archive is read as an Office Open XML
 * workbook, anything else as delimited text. A legacy binary workbook and a
 * PDF are refused by their signature.
 */
export const readSpreadsheet = (
  bytes: Buffer,
  limits: SpreadsheetLimits
): Spreadsheet => {
  if (bytes.subarray(0, 4).equals(ZIP_SIGNATURE))
    return { format: 'xlsx', ...readXlsxWorkbook(bytes, limits, limits) };

  if (bytes.subarray(0, 8).equals(COMPOUND_FILE_SIGNATURE))
    throw new SheetFormatError(
      'legacy',
      'Legacy .xls workbooks are not supported'
    );

  if (bytes.subarray(0, 4).equals(PDF_SIGNATURE))
    throw new SheetFormatError('unsupported', 'PDF files are not supported');

  const { sheet, delimiter } = readCsvTable(bytes, limits);

  return { format: 'csv', sheets: [sheet], delimiter };
};
