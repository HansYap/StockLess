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

const REJECTION: Readonly<Record<CsvErrorCode, Readonly<{ check: string; action: string }>>> = Object.freeze({
  UNSUPPORTED_FILE_TYPE: Object.freeze({
    check: "Not a CSV file",
    action: "Choose a file whose name ends in .csv.",
  }),
  INVALID_UTF8: Object.freeze({
    check: "The text cannot be read",
    action: "Export the file again as a standard UTF-8 CSV.",
  }),
  UNSUPPORTED_DELIMITER: Object.freeze({
    check: "No consistent separator found",
    action: "Export the file with one consistent comma, semicolon or tab separator.",
  }),
  FILE_TOO_LARGE: Object.freeze({
    check: "Larger than 10 MiB",
    action: "Reduce the file to 10 MiB or less.",
  }),
  ROW_LIMIT_EXCEEDED: Object.freeze({
    check: "More than 100,000 rows",
    action: "Reduce the file to 100,000 data rows or fewer.",
  }),
});

/** Creates one of the five permitted rejections with its filename and one action. */
export function createCsvImportError(code: CsvErrorCode, sourceName: string): CsvImportError {
  const rejection = REJECTION[code];
  return new CsvImportError(code, `${rejection.check}: “${sourceName}”`, rejection.action);
}

type SupportedDelimiter = "," | ";" | "\t";

interface ParseRecordsOptions {
  readonly maxRecords?: number;
  readonly signal?: AbortSignal;
  readonly onCharacterProgress?: (processed: number) => void;
  readonly sourceName?: string;
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
        throw createCsvImportError("INVALID_UTF8", options.sourceName ?? "selected file");
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
    throw createCsvImportError("INVALID_UTF8", options.sourceName ?? "selected file");
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
    throw createCsvImportError("UNSUPPORTED_DELIMITER", "selected file");
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
  const digestBytes = Uint8Array.from(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", digestBytes.buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

/** Validates the filename without rejecting browser-specific MIME guesses. */
function assertSupportedFile(sourceName: string): void {
  if (!sourceName.toLocaleLowerCase("en").endsWith(".csv")) {
    throw createCsvImportError("UNSUPPORTED_FILE_TYPE", sourceName);
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
  assertSupportedFile(options.sourceName);

  if (sourceBytes.byteLength === 0) {
    throw createCsvImportError("INVALID_UTF8", options.sourceName);
  }
  if (sourceBytes.byteLength > maxBytes) {
    throw createCsvImportError("FILE_TOO_LARGE", options.sourceName);
  }

  options.onProgress?.({ phase: "decode", processed: 0, total: sourceBytes.byteLength });
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
  } catch {
    throw createCsvImportError("INVALID_UTF8", options.sourceName);
  }
  options.onProgress?.({ phase: "decode", processed: sourceBytes.byteLength, total: sourceBytes.byteLength });

  if (text.trim() === "") {
    throw createCsvImportError("INVALID_UTF8", options.sourceName);
  }

  options.onProgress?.({ phase: "detect_delimiter", processed: 0, total: text.length });
  let delimiter: SupportedDelimiter;
  try {
    delimiter = detectDelimiter(text, options.signal);
  } catch (error) {
    if (error instanceof CsvImportError && error.code === "UNSUPPORTED_DELIMITER") {
      throw createCsvImportError("UNSUPPORTED_DELIMITER", options.sourceName);
    }
    throw error;
  }
  options.onProgress?.({ phase: "detect_delimiter", processed: text.length, total: text.length });

  const records = parseRecords(text, delimiter, {
    maxRecords: maxRows + 2,
    signal: options.signal,
    sourceName: options.sourceName,
    onCharacterProgress: (processed) =>
      options.onProgress?.({ phase: "parse", processed, total: text.length }),
  }).filter((record, index, allRecords) => !(index === allRecords.length - 1 && isBlankRecord(record)));

  if (records.length === 0) {
    throw createCsvImportError("INVALID_UTF8", options.sourceName);
  }

  const header = records[0];
  if (header.length === 0 || isBlankRecord(header)) {
    throw createCsvImportError("INVALID_UTF8", options.sourceName);
  }

  const dataRecords = records.slice(1);
  if (dataRecords.length > maxRows) {
    throw createCsvImportError("ROW_LIMIT_EXCEEDED", options.sourceName);
  }

  const mismatchedRowIndex = dataRecords.findIndex((record) => record.length !== header.length);
  if (mismatchedRowIndex >= 0) {
    throw createCsvImportError("INVALID_UTF8", options.sourceName);
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
    const previewValues = rows
      .map((row) => row.normalizedValues[columnIndex])
      .filter((value) => value.trim() !== "")
      .slice(0, 5);
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
