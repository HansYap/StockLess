import { useEffect, useMemo, useState } from "react";
import {
  CAPABILITY_LABELS,
  buildProductTimelines,
  createCorrectionReport,
  detectDateFormatCandidate,
  type ConfirmedDateFormat,
  type DataIssue,
  type DataIssueCode,
  type DateFormatConfirmation,
  type DuplicateDecision,
  type MappingState,
  type NormalizationEvent,
  type ParsedDataset,
  type ReadinessSnapshot,
  type StockFreshness,
  type WeekState,
} from "../engine.ts";

export type ReadinessIssueFilter = "dates" | "quantities" | "identity" | "duplicates" | "stock";

interface ReadinessScreenProps {
  readonly dataset: ParsedDataset;
  readonly mapping: MappingState;
  readonly snapshot: ReadinessSnapshot;
  readonly dateConfirmations: readonly DateFormatConfirmation[];
  readonly checking: boolean;
  readonly error: string | null;
  readonly filter: ReadinessIssueFilter | null;
  readonly onFilter: (kind: ReadinessIssueFilter | null) => void;
  readonly onConfirmDateFormat: (sourceColumnId: string, format: ConfirmedDateFormat) => void;
  readonly onDuplicateDecision: (fingerprint: string, decision: DuplicateDecision) => void;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  readonly reportFilename: string;
}

const FILTER_CODES: Readonly<Record<ReadinessIssueFilter, readonly DataIssueCode[]>> = Object.freeze({
  dates: ["INVALID_DATE", "DATE_FORMAT_CONFIRMATION_REQUIRED"],
  quantities: ["INVALID_QUANTITY"],
  identity: ["MISSING_IDENTITY"],
  duplicates: ["DUPLICATE_CANDIDATE", "DUPLICATE_CONFIRMED"],
  stock: [
    "INVALID_CURRENT_STOCK",
    "MISSING_CURRENT_STOCK",
    "INVALID_STOCK_DATE",
    "MISSING_STOCK_DATE",
    "FUTURE_STOCK_DATE",
    "CONFLICTING_CURRENT_STOCK",
    "CONFLICTING_STOCK_DATE",
  ],
});

const FILTER_META: Readonly<Record<ReadinessIssueFilter, Readonly<{
  label: string;
  hint: string;
  severity: "fix" | "review";
}>>> = Object.freeze({
  dates: { label: "Date issues", hint: "Invalid or unconfirmed date values", severity: "fix" },
  quantities: { label: "Quantity issues", hint: "Values that are not finite decimals", severity: "fix" },
  identity: { label: "Missing identity", hint: "Rows without the chosen product identity", severity: "fix" },
  duplicates: { label: "Exact duplicates", hint: "Matching source rows needing a decision", severity: "review" },
  stock: { label: "Stock evidence", hint: "Optional stock values that limit cover", severity: "review" },
});

const WEEK_LABEL: Readonly<Record<WeekState, string>> = Object.freeze({
  missing: "Missing",
  confirmed_zero_sales: "Confirmed zero",
  net_zero_with_activity: "Net zero + activity",
  observed_demand: "Observed demand",
});

const TIDY_UP_LABEL: Readonly<Record<NormalizationEvent["normalizationType"], string>> = Object.freeze({
  trim_whitespace: "Trim leading and trailing whitespace",
  normalize_line_endings: "Normalise line endings",
  confirmed_date_format: "Use the retailer-confirmed date format",
});

const TIDY_UPS_PER_PAGE = 25;
const PROBLEMS_PER_PAGE = 25;

function issueMatches(issue: DataIssue, filter: ReadinessIssueFilter): boolean {
  return FILTER_CODES[filter].includes(issue.issueCode);
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

/** Uses the retailer-facing stock-age bands without mislabelling invalid dates as old stock. */
function stockFreshnessLabel(freshness: StockFreshness): string {
  if (freshness.state === "current") return "Current · 0–7 days old";
  if (freshness.state === "limited") return "Getting old · 8–14 days old";
  if (freshness.reasonCode === "STALE_STOCK") return "Too old to rely on · more than 14 days old";
  if (freshness.reasonCode === "MISSING_STOCK_DATE") return "Stock count date missing";
  if (freshness.reasonCode === "INVALID_STOCK_DATE") return "Stock count date invalid";
  if (freshness.reasonCode === "FUTURE_STOCK_DATE") return "Stock count date is in the future";
  return "Stock count cannot be relied on";
}

/** Screen 03. Renders the domain engine's immutable Epic 2 evidence snapshot. */
export function ReadinessScreen(props: ReadinessScreenProps) {
  const [problemPage, setProblemPage] = useState(0);
  const [tidyUpPage, setTidyUpPage] = useState(0);
  const timelines = useMemo(() => buildProductTimelines(props.snapshot), [props.snapshot]);
  const report = useMemo(() => createCorrectionReport(props.snapshot), [props.snapshot]);

  useEffect(() => {
    setProblemPage(0);
    setTidyUpPage(0);
  }, [props.snapshot.id]);
  useEffect(() => setProblemPage(0), [props.filter]);

  const dateEvidence = useMemo(() => {
    const fields = ["transaction_date", "stock_as_of_date"] as const;
    return fields.flatMap((field) => {
      const sourceColumnId = props.mapping.mappings[field]?.confirmed
        ? props.mapping.mappings[field]?.sourceColumnId
        : undefined;
      if (!sourceColumnId) return [];
      const column = props.dataset.columns.find((candidate) => candidate.id === sourceColumnId);
      if (!column) return [];
      const detection = detectDateFormatCandidate(props.dataset, sourceColumnId);
      const confirmation = props.dateConfirmations.find((candidate) => candidate.sourceColumnId === sourceColumnId);
      if (!["candidate", "ambiguous"].includes(detection.state) && !confirmation) return [];
      return [{ field, column, detection, confirmation }];
    });
  }, [props.dataset, props.dateConfirmations, props.mapping]);

  const shown = props.filter
    ? props.snapshot.issues.filter((issue) => issueMatches(issue, props.filter!))
    : props.snapshot.issues;
  const problemPageCount = Math.max(1, Math.ceil(shown.length / PROBLEMS_PER_PAGE));
  const currentProblemPage = Math.min(problemPage, problemPageCount - 1);
  const problemStart = currentProblemPage * PROBLEMS_PER_PAGE;
  const visibleProblems = shown.slice(problemStart, problemStart + PROBLEMS_PER_PAGE);
  const unresolvedDuplicates = props.snapshot.duplicateGroups.filter((group) => group.decision === "unresolved").length;
  const leftOut = props.snapshot.reconciliation.rowsExcluded;
  const clean = props.snapshot.issues.length === 0;
  const tidyUpPageCount = Math.max(1, Math.ceil(props.snapshot.normalizations.length / TIDY_UPS_PER_PAGE));
  const currentTidyUpPage = Math.min(tidyUpPage, tidyUpPageCount - 1);
  const tidyUpStart = currentTidyUpPage * TIDY_UPS_PER_PAGE;
  const visibleTidyUps = props.snapshot.normalizations.slice(tidyUpStart, tidyUpStart + TIDY_UPS_PER_PAGE);

  function download() {
    const blob = new Blob([report.csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = props.reportFilename;
    anchor.click();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <>
      <p className="eyebrow">Data readiness · snapshot {props.snapshot.analysisDate}</p>
      <h1 className="title">
        {clean ? "Your file is ready to review." : "Your file is usable, with evidence to review."}
      </h1>
      <p className="lede">
        Every result below comes from one local readiness snapshot. Original cells remain unchanged,
        missing weeks stay distinct from zero sales, and rows left out remain traceable.
      </p>

      {props.checking && <p className="notice notice--info" role="status">Refreshing the readiness evidence locally…</p>}
      {props.error && <p className="notice notice--error" role="alert">{props.error}</p>}

      <div className="ready">
        <div className="ready__left">
          <span className="ready__tick" aria-hidden="true">✓</span>
          <div>
            <h2>Exact row reconciliation</h2>
            <p>
              {props.snapshot.reconciliation.rowsIn.toLocaleString("en")} rows in ={" "}
              {props.snapshot.reconciliation.rowsUsed.toLocaleString("en")} used +{" "}
              {leftOut.toLocaleString("en")} left out. {props.snapshot.reconciliation.rowsSafelyNormalized.toLocaleString("en")}{" "}
              used rows had safe representation-only normalization.
            </p>
          </div>
        </div>
        <div>
          <div className="ready__count">{props.snapshot.reconciliation.rowsUsed.toLocaleString("en")}</div>
          <div className="ready__unit">usable rows of {props.snapshot.reconciliation.rowsIn.toLocaleString("en")}</div>
        </div>
      </div>

      <div className="issues issues--five">
        {(Object.keys(FILTER_META) as ReadinessIssueFilter[]).map((kind) => {
          const meta = FILTER_META[kind];
          const count = props.snapshot.issues.filter((issue) => issueMatches(issue, kind)).length;
          const active = props.filter === kind;
          return (
            <button
              type="button"
              key={kind}
              className={`issue${active ? " issue--active" : ""}`}
              disabled={count === 0}
              aria-pressed={active}
              onClick={() => props.onFilter(active ? null : kind)}
            >
              <span className="issue__head">
                <span className="issue__label">{meta.label}</span>
                <span className={`pill ${meta.severity === "fix" ? "pill--red" : "pill--amber"}`}>
                  {meta.severity === "fix" ? "Fix" : "Review"}
                </span>
              </span>
              <span className="issue__value">{count}</span>
              <span className="issue__hint">{meta.hint}</span>
            </button>
          );
        })}
      </div>

      {(dateEvidence.length > 0 || props.snapshot.duplicateGroups.length > 0) && (
        <section className="decision-grid" aria-label="Readiness decisions">
          {dateEvidence.map(({ column, detection, confirmation }) => (
            <article className="decision-card" key={column.id}>
              <span className="pill pill--amber">Date format</span>
              <h2>{column.header}</h2>
              <p>
                {confirmation
                  ? `${confirmation.format} is explicitly confirmed for this column.`
                  : detection.state === "ambiguous"
                    ? "These values match more than one format. Choose the format used by the whole column."
                    : "Confirm the one detected non-ISO format before these dates are used."}
              </p>
              <div className="decision-card__actions">
                {detection.candidates.map((format) => (
                  <button
                    type="button"
                    className={`btn btn--small ${confirmation?.format === format ? "btn--primary" : "btn--ghost"}`}
                    disabled={props.checking || confirmation?.format === format}
                    onClick={() => props.onConfirmDateFormat(column.id, format)}
                    key={format}
                  >
                    {confirmation?.format === format ? `${format} confirmed` : `Confirm ${format}`}
                  </button>
                ))}
              </div>
            </article>
          ))}

          {props.snapshot.duplicateGroups.map((group, index) => (
            <article className="decision-card" key={group.fingerprint}>
              <span className={`pill ${group.decision === "unresolved" ? "pill--amber" : "pill--teal"}`}>
                Exact duplicate {index + 1}
              </span>
              <h2>Rows {group.sourceRows.join(", ")}</h2>
              <p>
                {group.decision === "unresolved"
                  ? "These rows are identical. Your row count is unchanged and every row remains in use until you decide."
                  : group.decision === "keep_both"
                    ? "You chose “keep both”. Every row remains in use and your row count is unchanged."
                    : `You chose “these are duplicates”. Row ${group.sourceRows[0]} remains in use; rows ${group.sourceRows.slice(1).join(", ")} are left out and marked as duplicates you confirmed.`}
              </p>
              {group.decision === "unresolved" && group.productKeys.length > 0 && (
                <p className="notice notice--info" role="status">
                  Warning for {group.productKeys.join(", ")}: these products cannot pass the order check until you decide.
                </p>
              )}
              <div className="decision-card__actions">
                <button
                  type="button"
                  className={`btn btn--small ${group.decision === "keep_both" ? "btn--primary" : "btn--ghost"}`}
                  disabled={props.checking || group.decision === "keep_both"}
                  onClick={() => props.onDuplicateDecision(group.fingerprint, "keep_both")}
                >
                  keep both
                </button>
                <button
                  type="button"
                  className={`btn btn--small ${group.decision === "treat_as_duplicate" ? "btn--primary" : "btn--ghost"}`}
                  disabled={props.checking || group.decision === "treat_as_duplicate"}
                  onClick={() => props.onDuplicateDecision(group.fingerprint, "treat_as_duplicate")}
                >
                  these are duplicates
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="card evidence-section">
        <div className="card__head">
          <div>
            <h2 className="card-title">Problems and tidy-ups</h2>
            <p className="card-sub">
              {props.filter ? "Problems are filtered by the selected card." : "Problems and permitted tidy-ups from this same local snapshot."}
            </p>
          </div>
          <span className="pill pill--grey">
            {shown.length === 0 ? "0 problems" : `Showing ${problemStart + 1}–${problemStart + visibleProblems.length} of ${shown.length}`}
          </span>
        </div>

        {visibleProblems.length === 0 ? (
          <p className="empty">Nothing to correct in this selection.</p>
        ) : (
          <div className="table-scroll">
            <table className="dtable dtable--readiness">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Product</th>
                  <th>Issue</th>
                  <th>Observed value</th>
                  <th>Reason and action</th>
                  <th>Use</th>
                </tr>
              </thead>
              <tbody>
                {visibleProblems.map((issue) => {
                  const sourceRow = props.snapshot.rows.find((row) => row.sourceRow === issue.sourceRow);
                  const useState = sourceRow?.useState;
                  const product = issue.productKey
                    ?? issue.originalProductHint
                    ?? sourceRow?.productKey
                    ?? sourceRow?.originalProductHint
                    ?? "Unknown";
                  return (
                    <tr key={issue.id}>
                      <td><b>#{issue.sourceRow.toLocaleString("en")}</b></td>
                      <td className="num">{product}</td>
                      <td><span className={`tag ${useState === "excluded" ? "tag--red" : "tag--amber"}`}>{humanize(issue.issueCode)}</span></td>
                      <td className="num">{issue.observedValue || "blank"}</td>
                      <td><b>{issue.reason}</b><span className="cell-detail">{issue.correctiveAction}</span></td>
                      <td><span className={`pill ${useState === "excluded" ? "pill--red" : "pill--amber"}`}>{useState === "excluded" ? "Left out" : "Used"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {shown.length > 0 && (
          <div className="table-pager" aria-label="Problem pages">
            <span>Every problem is included in the download.</span>
            <div className="table-pager__actions">
              <button
                type="button"
                className="btn btn--small btn--ghost"
                disabled={currentProblemPage === 0}
                onClick={() => setProblemPage((page) => Math.max(0, page - 1))}
              >
                ← Previous
              </button>
              <span>Page {currentProblemPage + 1} of {problemPageCount}</span>
              <button
                type="button"
                className="btn btn--small btn--ghost"
                disabled={currentProblemPage >= problemPageCount - 1}
                onClick={() => setProblemPage((page) => Math.min(problemPageCount - 1, page + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {props.snapshot.normalizations.length > 0 && (
          <div className="tidy-up-list">
            <div className="card__head">
              <div>
                <h3 className="card-title">Every tidy-up</h3>
                <p className="card-sub">
                  Each event shows its source row, exact before-and-after value, and the tidy-up permitted by AC2.
                </p>
              </div>
              <span className="pill pill--grey">{props.snapshot.normalizations.length} events</span>
            </div>
            <div className="table-scroll">
              <table className="dtable dtable--tidy-ups">
                <thead>
                  <tr>
                    <th>Row number</th>
                    <th>Column</th>
                    <th>What was there before</th>
                    <th>What it is now</th>
                    <th>Tidy-up applied</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTidyUps.map((event, index) => (
                    <tr key={`${event.sourceRow}-${event.sourceColumn}-${tidyUpStart + index}`}>
                      <td><b>#{event.sourceRow.toLocaleString("en")}</b></td>
                      <td>{props.dataset.columns.find((column) => column.id === event.sourceColumn)?.header ?? event.sourceColumn}</td>
                      <td><code className="trace-value">{JSON.stringify(event.originalValue)}</code></td>
                      <td><code className="trace-value">{JSON.stringify(event.resultingValue)}</code></td>
                      <td>{TIDY_UP_LABEL[event.normalizationType]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-pager" aria-label="Tidy-up pages">
              <span>
                Showing {tidyUpStart + 1}–{tidyUpStart + visibleTidyUps.length} of {props.snapshot.normalizations.length}
              </span>
              <div className="table-pager__actions">
                <button
                  type="button"
                  className="btn btn--small btn--ghost"
                  disabled={currentTidyUpPage === 0}
                  onClick={() => setTidyUpPage((page) => Math.max(0, page - 1))}
                >
                  ← Previous
                </button>
                <span>Page {currentTidyUpPage + 1} of {tidyUpPageCount}</span>
                <button
                  type="button"
                  className="btn btn--small btn--ghost"
                  disabled={currentTidyUpPage >= tidyUpPageCount - 1}
                  onClick={() => setTidyUpPage((page) => Math.min(tidyUpPageCount - 1, page + 1))}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="card evidence-section">
        <div className="card__head">
          <div>
            <h2 className="card-title">{CAPABILITY_LABELS.weekly_history}</h2>
            <p className="card-sub"><b>{CAPABILITY_LABELS.timeline_gap_evidence}</b> · Each product starts at its own first observed week and ends at its own last observed week.</p>
          </div>
          <span className="pill pill--grey">{timelines.length} products</span>
        </div>
        {timelines.length === 0 ? <p className="empty">No valid demand rows are available.</p> : (
          <div className="timeline-list">
            {timelines.slice(0, 12).map((timeline) => (
              <article className="timeline-row" key={timeline.productKey}>
                <div className="timeline-row__summary">
                  <b className="num">{timeline.productKey}</b>
                  <span>{timeline.summary.observedWeekCount} observed · {timeline.summary.weeksInSpan} in span · {timeline.summary.missingWeekCount} missing</span>
                  <span>{timeline.summary.dateRangeStart} to {timeline.summary.dateRangeEnd}</span>
                  <span className={`pill ${timeline.recentWindow.state === "standard" ? "pill--teal" : "pill--amber"}`}>
                    {CAPABILITY_LABELS.recent_weekly_average}: {humanize(timeline.recentWindow.state)}
                  </span>
                </div>
                <div className="week-strip" aria-label={`${CAPABILITY_LABELS.weekly_history} for ${timeline.productKey}`}>
                  {timeline.weeks.map((week) => (
                    <span
                      className={`week-chip week-chip--${week.state}`}
                      title={`${week.weekStart}: ${WEEK_LABEL[week.state]}${week.netQuantity === null ? "" : `, net ${week.netQuantity}`}`}
                      key={week.weekStart}
                    >
                      <b>{week.weekStart.slice(5)}</b>
                      {WEEK_LABEL[week.state]}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {props.snapshot.productStock.length > 0 && (
        <section className="card evidence-section">
          <div className="card__head">
            <div>
              <h2 className="card-title">{CAPABILITY_LABELS.stock_freshness}</h2>
              <p className="card-sub">Age is measured in calendar days at Asia/Kuala_Lumpur midnight.</p>
            </div>
            <span className="pill pill--grey">As at {props.snapshot.analysisDate}</span>
          </div>
          <div className="freshness-grid">
            {props.snapshot.productStock.slice(0, 12).map((stock) => (
              <article className={`freshness-card freshness-card--${stock.freshness.state}`} key={stock.productKey}>
                <b className="num">{stock.productKey}</b>
                <span>Snapshot: {stock.stockAsOfDate ?? "missing"}</span>
                <span>Age: {stock.freshness.ageDays === undefined ? "not available" : `${stock.freshness.ageDays} days`}</span>
                <strong>{stockFreshnessLabel(stock.freshness)}</strong>
                {!stock.usableForCover && <small>Cover unavailable: {stock.reasonCodes.map(humanize).join(" · ") || "stock evidence incomplete"}</small>}
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="footer-row">
        <p className="validity">
          <i aria-hidden="true">✓</i>
          {unresolvedDuplicates > 0
            ? `${unresolvedDuplicates} duplicate decision${unresolvedDuplicates === 1 ? "" : "s"} remain; affected products have Limited data.`
            : `Calculations use ${props.snapshot.reconciliation.rowsUsed.toLocaleString("en")} valid rows only.`}
        </p>
        <div className="footer-row__right">
          <button type="button" className="btn btn--ghost" onClick={download}>↓ Download problems</button>
          <button type="button" className="btn btn--primary" onClick={props.onContinue}>Review demand →</button>
        </div>
      </div>

      <button type="button" className="btn--link back-link" onClick={props.onBack}>← Back to mapping</button>
    </>
  );
}
