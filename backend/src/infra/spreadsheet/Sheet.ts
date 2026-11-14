export class SheetFormatError extends Error {
  readonly reason: SheetFormatError.Reason;

  constructor(reason: SheetFormatError.Reason, message: string) {
    super(message);
    this.reason = reason;
  }
}

export namespace SheetFormatError {
  export type Reason = 'unsupported' | 'legacy' | 'malformed' | 'too-large';
}

export type SheetCell = Record<'value', string> &
  Record<'kind', 'number' | 'text'>;

export type SheetRow = Record<'number', number> &
  Record<'cells', Array<SheetCell | null>>;

export type Sheet = Record<'name', string> & Record<'rows', Array<SheetRow>>;

export type SheetLimits = Record<
  'maxSheets' | 'maxRows' | 'maxColumns' | 'maxCellLength',
  number
>;

export type Spreadsheet = Record<'sheets', Array<Sheet>> &
  (
    | (Record<'format', 'xlsx'> & Record<'date1904', boolean>)
    | (Record<'format', 'csv'> & Record<'delimiter', ',' | ';' | '\t'>)
  );
