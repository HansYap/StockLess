import { CsvImportError, UPLOAD_REQUIREMENTS, createCsvImportError, type ImportSourceMetadata } from "../engine.ts";

export interface ExcelWorksheet {
  readonly name: string;
  readonly headers: readonly string[];
  readonly previewRows: readonly (readonly string[])[];
  readonly rowCount: number;
  readonly headerRow: number;
  readonly problem?: string;
}
export interface ExcelImportResult { readonly bytes: Uint8Array; readonly sourceMetadata: ImportSourceMetadata }

function invalidWorkbook(sourceName: string, message = "The Excel workbook cannot be read", recovery = "Save it again as an .xlsx or .xls file, then try uploading it."): CsvImportError {
  return new CsvImportError("INVALID_UTF8", `${message}: “${sourceName}”`, recovery);
}

/** Runs only in a worker in the browser; exported for deterministic import tests. */
export async function processExcelWorkbook(bytes: Uint8Array, sourceName: string, worksheetName?: string): Promise<readonly ExcelWorksheet[] | ExcelImportResult> {
  const XLSX = await import("xlsx");
  if (bytes.byteLength > UPLOAD_REQUIREMENTS.maxBytes) throw createCsvImportError("FILE_TOO_LARGE", sourceName);
  const isXlsx = /\.xlsx$/i.test(sourceName);
  if (isXlsx ? !(bytes[0] === 0x50 && bytes[1] === 0x4b) : !(bytes[0] === 0xd0 && bytes[1] === 0xcf)) throw invalidWorkbook(sourceName);
  let book: import("xlsx").WorkBook;
  try { book = XLSX.read(bytes, { type: "array", cellNF: true, cellDates: false }); } catch { throw invalidWorkbook(sourceName); }
  if (worksheetName && !book.SheetNames.includes(worksheetName)) throw invalidWorkbook(sourceName, "Selected worksheet was not found", "Choose a worksheet from this workbook.");
  function records(sheet: import("xlsx").WorkSheet): { values: string[]; sourceRow: number }[] {
    const rows = new Map<number, Map<number, string>>();
    let lastColumn = 0;
    for (const address of Object.keys(sheet)) {
      if (address.startsWith("!")) continue;
      const cell = sheet[address];
      if (!cell || cell.t === "z" || cell.v === undefined || cell.v === null) continue;
      const { r, c } = XLSX.utils.decode_cell(address);
      // Bound expanded workbooks as well as their compressed input size.
      if (c > 16_383 || rows.size > UPLOAD_REQUIREMENTS.maxRows + 1) throw createCsvImportError("ROW_LIMIT_EXCEEDED", sourceName);
      let value: string;
      if (cell.t === "n" && cell.z && XLSX.SSF.is_date(cell.z)) {
        const date = XLSX.SSF.parse_date_code(Number(cell.v), { date1904: book.Workbook?.WBProps?.date1904 });
        value = date ? `${String(date.y).padStart(4, "0")}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}` : String(cell.v);
      } else value = XLSX.utils.format_cell(cell);
      if (!value.trim()) continue;
      const row = rows.get(r) ?? new Map<number, string>(); row.set(c, value); rows.set(r, row); lastColumn = Math.max(lastColumn, c);
    }
    if (rows.size > UPLOAD_REQUIREMENTS.maxRows + 1) throw createCsvImportError("ROW_LIMIT_EXCEEDED", sourceName);
    if (rows.size * (lastColumn + 1) > UPLOAD_REQUIREMENTS.maxBytes) throw invalidWorkbook(sourceName, "The worksheet is too large to expand", "Reduce its rows or columns and try again.");
    return [...rows].sort(([a], [b]) => a - b).map(([r, cells]) => ({ sourceRow: r + 1, values: Array.from({ length: lastColumn + 1 }, (_, c) => cells.get(c) ?? "") }));
  }
  const inspect = (name: string): ExcelWorksheet => {
    try {
      const sheet = book.Sheets[name], data = records(sheet), header = data[0];
      const problem = !header || data.length < 2 ? "No sales records found in this worksheet."
        : sheet["!merges"]?.some(merge => merge.s.r <= header.sourceRow - 1 && merge.e.r >= header.sourceRow - 1) ? "Merged header cells are not supported. Use one column heading per cell." : undefined;
      return { name, headers: header?.values ?? [], headerRow: header?.sourceRow ?? 1, previewRows: data.slice(1, 6).map(row => row.values), rowCount: Math.max(0, data.length - 1), problem };
    } catch (error) { return { name, headers: [], headerRow: 1, previewRows: [], rowCount: 0, problem: error instanceof Error ? error.message : "Worksheet cannot be read." }; }
  };
  if (!worksheetName) return book.SheetNames.map(inspect);
  const selected = inspect(worksheetName);
  if (selected.problem) throw invalidWorkbook(sourceName, `${worksheetName}: ${selected.problem}`, "Choose a worksheet with a single header row and sales records, or correct it in Excel.");
  const data = records(book.Sheets[worksheetName]);
  const csv = data.map(row => row.values.map(value => '"' + value.replace(/"/g, '""') + '"').join(",")).join("\n");
  const converted = new TextEncoder().encode(csv);
  if (converted.byteLength > UPLOAD_REQUIREMENTS.maxBytes) throw createCsvImportError("FILE_TOO_LARGE", sourceName);
  const hash = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return { bytes: converted, sourceMetadata: { worksheetName, headerRow: data[0].sourceRow, sourceRowNumbers: data.slice(1).map(row => row.sourceRow),
    originalByteLength: bytes.byteLength, originalSha256: [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, "0")).join("") } };
}
