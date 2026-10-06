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
  "File",
  "Worksheet",
  "Product name",
  "Product code",
  "Pack size",
  "Field",
  "Source column",
  "Resolution status",
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

/** Converts an internal issue code to the text shown on screen. */
function issueLabel(issueCode: string): string {
  if (issueCode === "DUPLICATE_CANDIDATE") return "Duplicate rows handled automatically";
  if (issueCode === "DUPLICATE_CONFIRMED") return "Repeated row left out";
  if (issueCode === "UNUSUAL_SALE") return "Unusually large sale";
  if (issueCode === "PRODUCT_IDENTITY_CONFLICT") return "Product identifiers to check";
  return issueCode.toLowerCase().replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

/** Uses the two retailer-facing row outcomes required by the download. */
function rowOutcome(state: RowUseState | undefined): string {
  return state === undefined ? "Not a data row" : state === "excluded" ? "Left out" : "Used";
}

/** Serializes one record per problem as UTF-8 CSV with a compatibility BOM. */
function recordsToCsv(records: readonly ReportRecord[], snapshot: ReadinessSnapshot): string {
  const lines = [
    ["StockLess data source", snapshot.sourceMode === "sample" ? "Sample data" : "Retailer file"].map(csvCell).join(","),
    ["File", snapshot.sourceName, "Worksheet", snapshot.worksheetName ?? "CSV", "Analysis date", snapshot.analysisDate].map(csvCell).join(","),
    ["Rows in", snapshot.reconciliation.rowsIn, "Rows used", snapshot.reconciliation.rowsUsed, "Rows left out", snapshot.reconciliation.rowsExcluded].map(value => csvCell(String(value))).join(","),
    ["Correction summary", snapshot.issues.length === 0 ? "No problems found for this dataset." : snapshot.issues.some(issue => issue.resolutionState === "unresolved") ? "Unresolved problems remain." : "No outstanding problems; handled records are listed below."].map(csvCell).join(","),
    REPORT_COLUMNS.map(csvCell).join(","),
    ...records.map((record) => REPORT_COLUMNS.map((column) => csvCell(record[column])).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** Creates a traceable problem download from the same immutable screen snapshot. */
export function createCorrectionReport(snapshot: ReadinessSnapshot): CorrectionReport {
  const metadata: CorrectionReportMetadata = Object.freeze({
    snapshotId: snapshot.id,
    issueTotal: snapshot.issues.length,
    rowsIn: snapshot.reconciliation.rowsIn,
    rowsUsed: snapshot.reconciliation.rowsUsed,
    rowsExcluded: snapshot.reconciliation.rowsExcluded,
    rowsSafelyNormalized: snapshot.reconciliation.rowsSafelyNormalized,
  });

  const byRow = new Map(snapshot.rows.map(row => [row.sourceRow, row]));
  const sourceRowProduct = (sourceRow: number) => {
    const row = byRow.get(sourceRow);
    return row?.productKey ?? row?.originalProductHint ?? "Unknown";
  };
  function context(sourceRow: number, field: string, sourceColumn: string, resolution: string) {
    const values = byRow.get(sourceRow)?.interpretedValues;
    return { File: snapshot.sourceName, Worksheet: snapshot.worksheetName ?? "", "Product name": values?.productName ?? "", "Product code": values?.productCode ?? "",
      "Pack size": values?.packVariant ?? "", Field: field, "Source column": sourceColumn, "Resolution status": resolution };
  }
  const records: ReportRecord[] = snapshot.issues.map((issue): ReportRecord => Object.freeze({
    "Row number": String(issue.sourceRow),
    Product: issue.productKey ?? issue.originalProductHint ?? sourceRowProduct(issue.sourceRow),
    "What the problem is": issueLabel(issue.issueCode),
    "Value StockLess saw": issue.observedValue || "blank",
    "Why it is a problem": issue.reason,
    "What to do about it": issue.correctiveAction,
    "Whether that row was used or left out": rowOutcome(byRow.get(issue.sourceRow)?.useState),
    ...context(issue.sourceRow, issue.field ?? "row", issue.sourceColumn ?? "", issue.resolutionState === "resolved" ? "Handled" : issue.resolutionState === "unresolved" ? "Needs correction" : "Information"),
  }));

  for (const event of snapshot.normalizations) records.push(Object.freeze({
    "Row number": String(event.sourceRow),
    Product: sourceRowProduct(event.sourceRow),
    "What the problem is": "Safe tidy-up: " + issueLabel(event.normalizationType),
    "Value StockLess saw": event.originalValue,
    "Why it is a problem": `Column ${event.sourceColumn}: ${JSON.stringify(event.originalValue)} → ${JSON.stringify(event.resultingValue)}`,
    "What to do about it": "Nothing to fix. Original values are preserved.",
    "Whether that row was used or left out": rowOutcome(byRow.get(event.sourceRow)?.useState),
    ...context(event.sourceRow, "representation", event.sourceColumn, "Handled"),
  }));

  const csvText = recordsToCsv(records, snapshot);
  return Object.freeze({
    metadata,
    csvText,
    utf8Bytes: new TextEncoder().encode(csvText),
  });
}
