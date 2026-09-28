import { CsvImportError, UPLOAD_REQUIREMENTS, createCsvImportError } from "../engine.ts";

function invalidWorkbook(sourceName: string): CsvImportError {
  return new CsvImportError(
    "INVALID_UTF8",
    `The Excel workbook cannot be read: “${sourceName}”`,
    "Save it again as an .xlsx or .xls file, then try uploading it.",
  );
}

/** Converts the first non-empty worksheet to the CSV shape used by the existing importer. */
export async function excelToCsvBytes(bytes: Uint8Array, sourceName: string): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  let workbook: import("xlsx").WorkBook;
  const isXlsx = /\.xlsx$/i.test(sourceName);
  const zipFile = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const binaryExcel = bytes[0] === 0xd0 && bytes[1] === 0xcf;
  if (isXlsx ? !zipFile : !binaryExcel) throw invalidWorkbook(sourceName);
  try {
    workbook = XLSX.read(bytes, { type: "array", cellDates: true, dateNF: "yyyy-mm-dd" });
  } catch {
    throw invalidWorkbook(sourceName);
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.["!ref"]) continue;
    let csv: string;
    try {
      csv = XLSX.utils.sheet_to_csv(sheet, {
        FS: ",",
        RS: "\n",
        blankrows: false,
        dateNF: "yyyy-mm-dd",
      });
    } catch {
      throw invalidWorkbook(sourceName);
    }
    if (!csv.trim()) continue;
    const converted = new TextEncoder().encode(csv);
    if (converted.byteLength > UPLOAD_REQUIREMENTS.maxBytes) {
      throw createCsvImportError("FILE_TOO_LARGE", sourceName);
    }
    return converted;
  }

  throw new CsvImportError(
    "INVALID_UTF8",
    `No data found in the Excel workbook: “${sourceName}”`,
    "Add a header row and sales records to a worksheet, then try again.",
  );
}
