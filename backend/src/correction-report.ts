import type {
  CorrectionReport,
  CorrectionReportMetadata,
  DemandProductEvidence,
  ReadinessSnapshot,
  RowUseState,
} from "./contracts.ts";
import { buildDemandReview } from "./demand.ts";

const REPORT_COLUMNS = Object.freeze([
  "record_type",
  "snapshot_id",
  "source_mode",
  "source_file",
  "source_row",
  "product",
  "issue_code",
  "source_column",
  "observed_value",
  "resulting_value",
  "normalization_type",
  "confirmation_id",
  "reason",
  "corrective_action",
  "use_state",
  "rows_in",
  "rows_used",
  "rows_excluded",
  "rows_safely_normalized",
  "issue_total",
  "first_week",
  "last_week",
  "observed_weeks",
  "weeks_in_span",
  "missing_weeks",
  "recent_window_start",
  "recent_window_end",
  "recent_observed_weeks",
  "recent_window_state",
  "recent_window_reasons",
  "recent_average",
  "current_stock",
  "stock_as_of_date",
  "stock_age_days",
  "stock_freshness_state",
  "weeks_of_cover",
  "cover_state",
  "cover_reasons",
  "forecast_ready",
  "week_start",
  "week_end",
  "positive_quantity",
  "negative_quantity",
  "net_quantity",
  "week_record_count",
  "week_state",
  "week_source_rows",
] as const);

type ReportColumn = typeof REPORT_COLUMNS[number];
type ReportRecord = Readonly<Record<ReportColumn, string>>;

/** Neutralizes text that spreadsheet software could interpret as a formula. */
export function safeSpreadsheetCell(value: string): string {
  return /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
}

/** Escapes one neutralized value as a quoted RFC-style CSV cell. */
function csvCell(value: string): string {
  return `"${safeSpreadsheetCell(value).replace(/"/g, '""')}"`;
}

/** Creates an empty correction-report record with every required column. */
function emptyRecord(): Record<ReportColumn, string> {
  return Object.fromEntries(REPORT_COLUMNS.map((column) => [column, ""])) as Record<ReportColumn, string>;
}

/** Finds the terminal row state for a source row when one exists. */
function sourceRowState(
  snapshot: ReadinessSnapshot,
  sourceRow: number,
): RowUseState | undefined {
  return snapshot.rows.find((row) => row.sourceRow === sourceRow)?.useState;
}

/** Finds the confirmed product key or original product hint for a source row. */
function sourceRowProduct(snapshot: ReadinessSnapshot, sourceRow: number): string {
  const row = snapshot.rows.find((candidate) => candidate.sourceRow === sourceRow);
  return row?.productKey ?? row?.originalProductHint ?? "";
}

/** Converts report records to safe UTF-8 CSV text. */
function recordsToCsv(records: readonly ReportRecord[]): string {
  const lines = [
    REPORT_COLUMNS.map(csvCell).join(","),
    ...records.map((record) => REPORT_COLUMNS.map((column) => csvCell(record[column])).join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

/** Serializes issues, normalizations, and matching summary counts without mutation. */
export function createCorrectionReport(snapshot: ReadinessSnapshot): CorrectionReport {
  const demandReview = buildDemandReview(snapshot);
  const metadata: CorrectionReportMetadata = Object.freeze({
    snapshotId: snapshot.id,
    issueTotal: snapshot.issues.length,
    rowsIn: snapshot.reconciliation.rowsIn,
    rowsUsed: snapshot.reconciliation.rowsUsed,
    rowsExcluded: snapshot.reconciliation.rowsExcluded,
    rowsSafelyNormalized: snapshot.reconciliation.rowsSafelyNormalized,
  });
  const summary = emptyRecord();
  Object.assign(summary, {
    record_type: "summary",
    snapshot_id: metadata.snapshotId,
    source_mode: snapshot.sourceMode === "sample" ? "Sample data" : "Retailer file",
    source_file: snapshot.sourceName,
    rows_in: String(metadata.rowsIn),
    rows_used: String(metadata.rowsUsed),
    rows_excluded: String(metadata.rowsExcluded),
    rows_safely_normalized: String(metadata.rowsSafelyNormalized),
    issue_total: String(metadata.issueTotal),
  });

  const issueRecords = snapshot.issues.map((issue): ReportRecord => {
    const record = emptyRecord();
    Object.assign(record, {
      record_type: "issue",
      snapshot_id: metadata.snapshotId,
      source_mode: snapshot.sourceMode === "sample" ? "Sample data" : "Retailer file",
      source_file: snapshot.sourceName,
      source_row: String(issue.sourceRow),
      product: issue.productKey ?? issue.originalProductHint ?? sourceRowProduct(snapshot, issue.sourceRow),
      issue_code: issue.issueCode,
      source_column: issue.sourceColumn ?? issue.field ?? "",
      observed_value: issue.observedValue,
      reason: issue.reason,
      corrective_action: issue.correctiveAction,
      use_state: sourceRowState(snapshot, issue.sourceRow) ?? "",
      rows_in: String(metadata.rowsIn),
      rows_used: String(metadata.rowsUsed),
      rows_excluded: String(metadata.rowsExcluded),
      rows_safely_normalized: String(metadata.rowsSafelyNormalized),
      issue_total: String(metadata.issueTotal),
    });
    return Object.freeze(record);
  });

  const normalizationRecords = snapshot.normalizations.map((event): ReportRecord => {
    const record = emptyRecord();
    Object.assign(record, {
      record_type: "normalization",
      snapshot_id: metadata.snapshotId,
      source_mode: snapshot.sourceMode === "sample" ? "Sample data" : "Retailer file",
      source_file: snapshot.sourceName,
      source_row: String(event.sourceRow),
      product: sourceRowProduct(snapshot, event.sourceRow),
      source_column: event.sourceColumn,
      observed_value: event.originalValue,
      resulting_value: event.resultingValue,
      normalization_type: event.normalizationType,
      confirmation_id: event.confirmationId ?? "",
      reason: "A permitted representation-only normalization was applied.",
      corrective_action: "No business value was guessed or imputed.",
      use_state: sourceRowState(snapshot, event.sourceRow) ?? "",
      rows_in: String(metadata.rowsIn),
      rows_used: String(metadata.rowsUsed),
      rows_excluded: String(metadata.rowsExcluded),
      rows_safely_normalized: String(metadata.rowsSafelyNormalized),
      issue_total: String(metadata.issueTotal),
    });
    return Object.freeze(record);
  });

  const productSummaryRecords = demandReview.products.map((product): ReportRecord => {
    const { timeline, recentAverage, cover } = product;
    const record = emptyRecord();
    Object.assign(record, {
      record_type: "product_summary",
      snapshot_id: metadata.snapshotId,
      source_mode: snapshot.sourceMode === "sample" ? "Sample data" : "Retailer file",
      source_file: snapshot.sourceName,
      product: timeline.productKey,
      rows_in: String(metadata.rowsIn),
      rows_used: String(metadata.rowsUsed),
      rows_excluded: String(metadata.rowsExcluded),
      rows_safely_normalized: String(metadata.rowsSafelyNormalized),
      issue_total: String(metadata.issueTotal),
      first_week: timeline.summary.firstWeek,
      last_week: timeline.summary.lastWeek,
      observed_weeks: String(timeline.summary.observedWeekCount),
      weeks_in_span: String(timeline.summary.weeksInSpan),
      missing_weeks: String(timeline.summary.missingWeekCount),
      recent_window_start: timeline.recentWindow.windowStart ?? "",
      recent_window_end: timeline.recentWindow.windowEnd ?? "",
      recent_observed_weeks: String(timeline.recentWindow.observedWeekCount),
      recent_window_state: timeline.recentWindow.state,
      recent_window_reasons: timeline.recentWindow.reasonCodes.join("|"),
      recent_average: recentAverage.value === undefined ? "" : String(recentAverage.value),
      current_stock: cover.currentStock === undefined ? "" : String(cover.currentStock),
      stock_as_of_date: cover.stockAsOfDate ?? "",
      stock_age_days: cover.stockAgeDays === undefined ? "" : String(cover.stockAgeDays),
      stock_freshness_state: cover.freshnessState ?? "",
      weeks_of_cover: cover.value === undefined ? "" : String(cover.value),
      cover_state: cover.state,
      cover_reasons: cover.reasonCodes.join("|"),
      forecast_ready: String(product.forecastReady),
    });
    return Object.freeze(record);
  });

  const weeklyRecords = demandReview.products.flatMap((product) =>
    product.timeline.weeks.map((week): ReportRecord => {
      const record = demandProductRecord(metadata, snapshot, product);
      Object.assign(record, {
        record_type: "weekly_evidence",
        week_start: week.weekStart,
        week_end: week.weekEnd,
        positive_quantity: week.positiveQuantity === null ? "" : String(week.positiveQuantity),
        negative_quantity: week.negativeQuantity === null ? "" : String(week.negativeQuantity),
        net_quantity: week.netQuantity === null ? "" : String(week.netQuantity),
        week_record_count: String(week.recordCount),
        week_state: week.state,
        week_source_rows: week.sourceRows.join("|"),
      });
      return Object.freeze(record);
    }),
  );

  const csvText = recordsToCsv([
    Object.freeze(summary),
    ...issueRecords,
    ...normalizationRecords,
    ...productSummaryRecords,
    ...weeklyRecords,
  ]);
  return Object.freeze({
    metadata,
    csvText,
    utf8Bytes: new TextEncoder().encode(csvText),
  });
}

/** Creates the shared product-level evidence columns used by summary and weekly records. */
function demandProductRecord(
  metadata: CorrectionReportMetadata,
  snapshot: ReadinessSnapshot,
  product: DemandProductEvidence,
): Record<ReportColumn, string> {
  const record = emptyRecord();
  const { timeline, recentAverage, cover } = product;
  Object.assign(record, {
    snapshot_id: metadata.snapshotId,
    source_mode: snapshot.sourceMode === "sample" ? "Sample data" : "Retailer file",
    source_file: snapshot.sourceName,
    product: product.productKey,
    rows_in: String(metadata.rowsIn),
    rows_used: String(metadata.rowsUsed),
    rows_excluded: String(metadata.rowsExcluded),
    rows_safely_normalized: String(metadata.rowsSafelyNormalized),
    issue_total: String(metadata.issueTotal),
    first_week: timeline.summary.firstWeek,
    last_week: timeline.summary.lastWeek,
    observed_weeks: String(timeline.summary.observedWeekCount),
    weeks_in_span: String(timeline.summary.weeksInSpan),
    missing_weeks: String(timeline.summary.missingWeekCount),
    recent_window_start: recentAverage.windowStart ?? "",
    recent_window_end: recentAverage.windowEnd ?? "",
    recent_observed_weeks: String(recentAverage.observedWeekCount),
    recent_window_state: recentAverage.state,
    recent_window_reasons: recentAverage.reasonCodes.join("|"),
    recent_average: recentAverage.value === undefined ? "" : String(recentAverage.value),
    current_stock: cover.currentStock === undefined ? "" : String(cover.currentStock),
    stock_as_of_date: cover.stockAsOfDate ?? "",
    stock_age_days: cover.stockAgeDays === undefined ? "" : String(cover.stockAgeDays),
    stock_freshness_state: cover.freshnessState ?? "",
    weeks_of_cover: cover.value === undefined ? "" : String(cover.value),
    cover_state: cover.state,
    cover_reasons: cover.reasonCodes.join("|"),
    forecast_ready: String(product.forecastReady),
  });
  return record;
}
