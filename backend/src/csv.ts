import type {
  CsvErrorCode,
  CsvParseOptions,
  NormalizationEvent,
  ParsedDataset,
  ParsedRow,
  SourceColumn,
} from "./contracts.ts";
import { UPLOAD_REQUIREMENTS } from "./field-registry.ts";

/** Structured CSV error with a stable code and user-facing recovery guidance. */
export class CsvImportError extends Error {
  readonly code: CsvErrorCode;
  readonly recovery: string;

  /** Creates a CSV error that can be handled without parsing its message. */
  constructor(code: CsvErrorCode, message: string, recovery: string) {
    super(message);
    this.name = "CsvImportError";
    this.code = code;
    this.recovery = recovery;
  }
}

const RECOVERY: Readonly<Record<CsvErrorCode, string>> = Object.freeze({
  UNSUPPORTED_FILE_TYPE: "Export the source as a .csv file and try again.",
  FILE_TOO_LARGE: "Reduce the CSV below the displayed size limit or split it into separate files.",
  INVALID_UTF8: "Export the CSV using UTF-8 encoding and try again.",
  UNSUPPORTED_DELIMITER: "Export the CSV using a comma, semicolon, or tab delimiter.",
  MALFORMED_CSV: "Repair inconsistent columns or unmatched quotes in the CSV and try again.",
  MISSING_HEADER: "Add a non-empty header row to the CSV and try again.",
  ROW_LIMIT_EXCEEDED: "Reduce the CSV below the displayed row limit or split it into separate files.",
  EMPTY_FILE: "Choose a CSV containing a header row and at least one data row.",
});

type SupportedDelimiter = "," | ";" | "\t";

interface ParseRecordsOptions {
  readonly maxRecords?: number;
  readonly signal?: AbortSignal;
  readonly onCharacterProgress?: (processed: number) => void;
}

/** Stops parsing promptly when the caller cancels the active operation. */
function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new DOMException("CSV parsing was cancelled.", "AbortError");
  }
}

/** Parses text into CSV records using RFC-style quoting for one delimiter. */
function parseRecords(
  text: string,
  delimiter: SupportedDelimiter,
  options: ParseRecordsOptions = {},
): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;

  /** Appends the current field to the record and resets its buffer. */
  const pushField = (): void => {
    record.push(field);
    field = "";
    fieldStarted = false;
  };

  /** Appends the current record and reports whether the probe limit was reached. */
  const pushRecord = (): boolean => {
    pushField();
    records.push(record);
    record = [];
    return options.maxRecords !== undefined && records.length >= options.maxRecords;
  };

  for (let index = 0; index < text.length; index += 1) {
    if (index % 65_536 === 0) {
      assertNotAborted(options.signal);
      options.onCharacterProgress?.(index);
    }

    const character = text[index];
    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (fieldStarted || field.length > 0) {
        throw new CsvImportError(
          "MALFORMED_CSV",
          "A quoted field starts after unquoted text.",
          RECOVERY.MALFORMED_CSV,
        );
      }
      inQuotes = true;
      fieldStarted = true;
      continue;
    }

    if (character === delimiter) {
      pushField();
      continue;
    }

    if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      if (pushRecord()) {
        return records;
      }
      continue;
    }

    field += character;
    fieldStarted = true;
  }

  assertNotAborted(options.signal);
  options.onCharacterProgress?.(text.length);

  if (inQuotes) {
    throw new CsvImportError(
      "MALFORMED_CSV",
      "The CSV contains an unmatched double quote.",
      RECOVERY.MALFORMED_CSV,
    );
  }

  if (field.length > 0 || fieldStarted || record.length > 0) {
    pushRecord();
  }

  return records;
}

/** Returns true when every field in a CSV record is empty or whitespace. */
function isBlankRecord(record: readonly string[]): boolean {
  return record.every((value) => value.trim() === "");
}

/** Scores a delimiter by column count and consistency across sample records. */
function delimiterScore(text: string, delimiter: SupportedDelimiter, signal?: AbortSignal): number {
  let records: string[][];
  try {
    records = parseRecords(text, delimiter, { maxRecords: 50, signal }).filter((record) => !isBlankRecord(record));
  } catch {
    return -1;
  }

  if (records.length === 0) return -1;

  const frequencies = new Map<number, number>();
  for (const record of records) {
    frequencies.set(record.length, (frequencies.get(record.length) ?? 0) + 1);
  }

  const [columnCount, matchingRows] = [...frequencies.entries()].sort(
    ([columnsA, frequencyA], [columnsB, frequencyB]) => frequencyB - frequencyA || columnsB - columnsA,
  )[0];

  if (columnCount < 2) return -1;
  const consistency = matchingRows / records.length;
  return consistency * 1_000 + columnCount;
}

/** Selects the only highest-scoring supported delimiter or raises a clear error. */
function detectDelimiter(text: string, signal?: AbortSignal): SupportedDelimiter {
  const delimiters: readonly SupportedDelimiter[] = [",", ";", "\t"];
  const ranked = delimiters
    .map((delimiter) => ({ delimiter, score: delimiterScore(text, delimiter, signal) }))
    .sort((a, b) => b.score - a.score);

  if (ranked[0].score < 0 || (ranked[1] && ranked[0].score === ranked[1].score)) {
    throw new CsvImportError(
      "UNSUPPORTED_DELIMITER",
      "StockLess could not confidently identify a supported CSV delimiter.",
      RECOVERY.UNSUPPORTED_DELIMITER,
    );
  }

  return ranked[0].delimiter;
}

/** Applies safe representation-only normalization and records every change. */
function normalizeCell(
  originalValue: string,
  sourceRow: number,
  sourceColumn: string,
  events: NormalizationEvent[],
): string {
  let value = originalValue;
  const lineNormalized = value.replace(/\r\n?/g, "\n");
  if (lineNormalized !== value) {
    events.push({
      sourceRow,
      sourceColumn,
      originalValue: value,
      resultingValue: lineNormalized,
      normalizationType: "normalize_line_endings",
    });
    value = lineNormalized;
  }

  const trimmed = value.trim();
  if (trimmed !== value) {
    events.push({
      sourceRow,
      sourceColumn,
      originalValue: value,
      resultingValue: trimmed,
      normalizationType: "trim_whitespace",
    });
    value = trimmed;
  }
  return value;
}

/** Calculates a lowercase SHA-256 hash without modifying the input bytes. */
async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

/** Validates the CSV extension and any MIME type supplied by the browser. */
function assertSupportedFile(sourceName: string, mimeType?: string): void {
  if (!sourceName.toLocaleLowerCase("en").endsWith(".csv")) {
    throw new CsvImportError(
      "UNSUPPORTED_FILE_TYPE",
      `Unsupported file type for ${sourceName}.`,
      RECOVERY.UNSUPPORTED_FILE_TYPE,
    );
  }

  const supportedMimeTypes = new Set(["", "text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"]);
  if (mimeType !== undefined && !supportedMimeTypes.has(mimeType.toLocaleLowerCase("en"))) {
    throw new CsvImportError(
      "UNSUPPORTED_FILE_TYPE",
      `Unsupported MIME type: ${mimeType}.`,
      RECOVERY.UNSUPPORTED_FILE_TYPE,
    );
  }
}

/** Parses sample or retailer CSV bytes into the same immutable dataset shape. */
export async function parseCsvBytes(
  sourceBytes: Uint8Array,
  options: CsvParseOptions,
): Promise<ParsedDataset> {
  const maxBytes = options.maxBytes ?? UPLOAD_REQUIREMENTS.maxBytes;
  const maxRows = options.maxRows ?? UPLOAD_REQUIREMENTS.maxRows;

  assertNotAborted(options.signal);
  assertSupportedFile(options.sourceName, options.mimeType);

  if (sourceBytes.byteLength === 0) {
    throw new CsvImportError("EMPTY_FILE", "The selected CSV is empty.", RECOVERY.EMPTY_FILE);
  }
  if (sourceBytes.byteLength > maxBytes) {
    throw new CsvImportError(
      "FILE_TOO_LARGE",
      `The CSV is ${sourceBytes.byteLength} bytes; the limit is ${maxBytes} bytes.`,
      RECOVERY.FILE_TOO_LARGE,
    );
  }

  options.onProgress?.({ phase: "decode", processed: 0, total: sourceBytes.byteLength });
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
  } catch {
    throw new CsvImportError("INVALID_UTF8", "The CSV is not valid UTF-8.", RECOVERY.INVALID_UTF8);
  }
  options.onProgress?.({ phase: "decode", processed: sourceBytes.byteLength, total: sourceBytes.byteLength });

  if (text.trim() === "") {
    throw new CsvImportError("EMPTY_FILE", "The selected CSV is empty.", RECOVERY.EMPTY_FILE);
  }

  options.onProgress?.({ phase: "detect_delimiter", processed: 0, total: text.length });
  const delimiter = detectDelimiter(text, options.signal);
  options.onProgress?.({ phase: "detect_delimiter", processed: text.length, total: text.length });

  const records = parseRecords(text, delimiter, {
    maxRecords: maxRows + 2,
    signal: options.signal,
    onCharacterProgress: (processed) =>
      options.onProgress?.({ phase: "parse", processed, total: text.length }),
  }).filter((record, index, allRecords) => !(index === allRecords.length - 1 && isBlankRecord(record)));

  if (records.length === 0) {
    throw new CsvImportError("EMPTY_FILE", "The selected CSV is empty.", RECOVERY.EMPTY_FILE);
  }

  const header = records[0];
  if (header.length === 0 || isBlankRecord(header)) {
    throw new CsvImportError("MISSING_HEADER", "The CSV has no usable header row.", RECOVERY.MISSING_HEADER);
  }

  const dataRecords = records.slice(1);
  if (dataRecords.length > maxRows) {
    throw new CsvImportError(
      "ROW_LIMIT_EXCEEDED",
      `The CSV contains more than ${maxRows} data rows.`,
      RECOVERY.ROW_LIMIT_EXCEEDED,
    );
  }

  const mismatchedRowIndex = dataRecords.findIndex((record) => record.length !== header.length);
  if (mismatchedRowIndex >= 0) {
    throw new CsvImportError(
      "MALFORMED_CSV",
      `CSV record ${mismatchedRowIndex + 2} has ${dataRecords[mismatchedRowIndex].length} columns; expected ${header.length}.`,
      RECOVERY.MALFORMED_CSV,
    );
  }

  const normalizations: NormalizationEvent[] = [];
  const normalizedHeaders = header.map((value, index) => normalizeCell(value, 1, `column-${index}`, normalizations));
  const rows: ParsedRow[] = dataRecords.map((record, recordIndex) => {
    const sourceRow = recordIndex + 2;
    const normalizedValues = record.map((value, columnIndex) =>
      normalizeCell(value, sourceRow, `column-${columnIndex}`, normalizations),
    );
    return Object.freeze({
      sourceRow,
      originalValues: Object.freeze([...record]),
      normalizedValues: Object.freeze(normalizedValues),
    });
  });

  const columns: SourceColumn[] = normalizedHeaders.map((headerValue, columnIndex) => {
    const previewValues = [...new Set(rows.map((row) => row.normalizedValues[columnIndex]).filter(Boolean))].slice(0, 5);
    return Object.freeze({
      id: `column-${columnIndex}`,
      index: columnIndex,
      header: header[columnIndex],
      normalizedHeader: headerValue,
      previewValues: Object.freeze(previewValues),
    });
  });

  const sourceSha256 = await sha256(sourceBytes);
  options.onProgress?.({ phase: "complete", processed: sourceBytes.byteLength, total: sourceBytes.byteLength });

  return Object.freeze({
    sourceMode: options.sourceMode,
    sourceName: options.sourceName,
    sourceByteLength: sourceBytes.byteLength,
    sourceSha256,
    delimiter,
    columns: Object.freeze(columns),
    rows: Object.freeze(rows),
    normalizations: Object.freeze(normalizations),
  });
}

/** Indicates whether a parsed dataset has columns that can be mapped. */
export function canProceedToMapping(dataset: ParsedDataset): boolean {
  return dataset.columns.length > 0;
}
