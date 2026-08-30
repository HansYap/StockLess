import type {
  CorrectionReport,
  CorrectionReportMetadata,
  ReadinessSnapshot,
  RowUseState,
} from "./contracts.ts";

const REPORT_COLUMNS = Object.freeze([
  "Row number",
  "Product",
  "What the problem is",
  "Value StockLess saw",
  "Why it is a problem",
  "What to do about it",
  "Whether that row was used or left out",
] as const);

type ReportColumn = typeof REPORT_COLUMNS[number];
type ReportRecord = Readonly<Record<ReportColumn, string>>;

/** Neutralizes text that spreadsheet software could interpret as a formula. */
export function safeSpreadsheetCell(value: string): string {
  return /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
}

/** Escapes one neutralized value as a quoted CSV cell. */
function csvCell(value: string): string {
  return `"${safeSpreadsheetCell(value).replace(/"/g, '""')}"`;
}

/** Finds the terminal row state for a source row when one exists. */
function sourceRowState(snapshot: ReadinessSnapshot, sourceRow: number): RowUseState | undefined {
  return snapshot.rows.find((row) => row.sourceRow === sourceRow)?.useState;
}

/** Uses the same product fallback order as the problems table. */
function sourceRowProduct(snapshot: ReadinessSnapshot, sourceRow: number): string {
  const row = snapshot.rows.find((candidate) => candidate.sourceRow === sourceRow);
  return row?.productKey ?? row?.originalProductHint ?? "Unknown";
}

/** Converts an internal issue code to the text shown on screen. */
function issueLabel(issueCode: string): string {
  return issueCode.toLowerCase().replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

/** Uses the two retailer-facing row outcomes required by the download. */
function rowOutcome(state: RowUseState | undefined): string {
  return state === "excluded" ? "Left out" : "Used";
}

/** Serializes one record per problem as UTF-8 CSV with a compatibility BOM. */
function recordsToCsv(records: readonly ReportRecord[]): string {
  const lines = [
    REPORT_COLUMNS.map(csvCell).join(","),
    ...records.map((record) => REPORT_COLUMNS.map((column) => csvCell(record[column])).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** Creates the seven-column problem download from the same immutable screen snapshot. */
export function createCorrectionReport(snapshot: ReadinessSnapshot): CorrectionReport {
  const metadata: CorrectionReportMetadata = Object.freeze({
    snapshotId: snapshot.id,
    issueTotal: snapshot.issues.length,
    rowsIn: snapshot.reconciliation.rowsIn,
    rowsUsed: snapshot.reconciliation.rowsUsed,
    rowsExcluded: snapshot.reconciliation.rowsExcluded,
    rowsSafelyNormalized: snapshot.reconciliation.rowsSafelyNormalized,
  });

  const records = snapshot.issues.map((issue): ReportRecord => Object.freeze({
    "Row number": String(issue.sourceRow),
    Product: issue.productKey ?? issue.originalProductHint ?? sourceRowProduct(snapshot, issue.sourceRow),
    "What the problem is": issueLabel(issue.issueCode),
    "Value StockLess saw": issue.observedValue || "blank",
    "Why it is a problem": issue.reason,
    "What to do about it": issue.correctiveAction,
    "Whether that row was used or left out": rowOutcome(sourceRowState(snapshot, issue.sourceRow)),
  }));

  const csvText = recordsToCsv(records);
  return Object.freeze({
    metadata,
    csvText,
    utf8Bytes: new TextEncoder().encode(csvText),
  });
}
