export class SheetFormatError extends Error {
  readonly reason: SheetFormatError.Reason;

  constructor(reason: SheetFormatError.Reason, message: string) {
    super(message);
    this.reason = reason;
  }
}

export namespace SheetFormatError {
  /**
   * `unsupported` is a file that is neither an Office Open XML workbook nor
   * text, `legacy` a binary .xls workbook, `malformed` one that does not read
   * as what it claims to be, and `too-large` one past a size or count limit.
   */
  export type Reason = 'unsupported' | 'legacy' | 'malformed' | 'too-large';
}

/**
 * A cell as stored: a number as a plain decimal string (no exponent), anything
 * else as its text. An empty cell is null.
 */
export type SheetCell = Record<'value', string> &
  Record<'kind', 'number' | 'text'>;

export type SheetRow = Record<'number', number> &
  Record<'cells', Array<SheetCell | null>>;

export type Sheet = Record<'name', string> & Record<'rows', Array<SheetRow>>;

export type SheetLimits = Record<
  'maxSheets' | 'maxRows' | 'maxColumns' | 'maxCellLength',
  number
>;

/**
 * The sheets a file holds. A date typed into a workbook cell is the serial
 * number it stores, counted from the epoch `date1904` names; a CSV holds text
 * only, so its `delimiter` is what tells the decimal convention it was written
 * in.
 */
export type Spreadsheet = Record<'sheets', Array<Sheet>> &
  (
    | (Record<'format', 'xlsx'> & Record<'date1904', boolean>)
    | (Record<'format', 'csv'> & Record<'delimiter', ',' | ';' | '\t'>)
  );
