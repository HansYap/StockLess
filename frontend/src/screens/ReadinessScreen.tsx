import { useMemo } from "react";
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
  type ParsedDataset,
  type ReadinessSnapshot,
  type StockFreshnessState,
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

const FRESHNESS_LABEL: Readonly<Record<StockFreshnessState, string>> = Object.freeze({
  current: "Current · 0–7 days",
  limited: "Limited · 8–14 days",
  unusable: "Unusable · over 14 days or invalid",
});

function issueMatches(issue: DataIssue, filter: ReadinessIssueFilter): boolean {
  return FILTER_CODES[filter].includes(issue.issueCode);
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

/** Screen 03. Renders the domain engine's immutable Epic 2 evidence snapshot. */
export function ReadinessScreen(props: ReadinessScreenProps) {
  const timelines = useMemo(() => buildProductTimelines(props.snapshot), [props.snapshot]);
  const report = useMemo(() => createCorrectionReport(props.snapshot), [props.snapshot]);

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
  const preview = shown.slice(0, 12);
  const unresolvedDuplicates = props.snapshot.duplicateGroups.filter((group) => group.decision === "unresolved").length;
  const excluded = props.snapshot.reconciliation.rowsExcluded;
  const clean = props.snapshot.issues.length === 0;

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
        missing weeks stay distinct from zero sales, and excluded rows remain traceable.
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
              {excluded.toLocaleString("en")} excluded. {props.snapshot.reconciliation.rowsSafelyNormalized.toLocaleString("en")}{" "}
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
          const count = new Set(
            props.snapshot.issues.filter((issue) => issueMatches(issue, kind)).map((issue) => issue.sourceRow),
          ).size;
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
                Every source cell matches after permitted normalization. Both remain used until you decide;
                unresolved products are Limited.
              </p>
              <div className="decision-card__actions">
                <button
                  type="button"
                  className={`btn btn--small ${group.decision === "keep_both" ? "btn--primary" : "btn--ghost"}`}
                  disabled={props.checking || group.decision === "keep_both"}
                  onClick={() => props.onDuplicateDecision(group.fingerprint, "keep_both")}
                >
                  Keep both
                </button>
                <button
                  type="button"
                  className={`btn btn--small ${group.decision === "treat_as_duplicate" ? "btn--primary" : "btn--ghost"}`}
                  disabled={props.checking || group.decision === "treat_as_duplicate"}
                  onClick={() => props.onDuplicateDecision(group.fingerprint, "treat_as_duplicate")}
                >
                  Treat as duplicate
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="card evidence-section">
        <div className="card__head">
          <div>
            <h2 className="card-title">Rows and values needing attention</h2>
            <p className="card-sub">
              {props.filter ? "Filtered by the selected card." : "The first 12 issue records from this same export snapshot."}
            </p>
          </div>
          <span className="pill pill--grey">Showing {preview.length} of {shown.length}</span>
        </div>

        {preview.length === 0 ? (
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
                {preview.map((issue) => {
                  const useState = props.snapshot.rows.find((row) => row.sourceRow === issue.sourceRow)?.useState;
                  return (
                    <tr key={issue.id}>
                      <td><b>#{issue.sourceRow.toLocaleString("en")}</b></td>
                      <td className="num">{issue.productKey ?? issue.originalProductHint ?? "Unknown"}</td>
                      <td><span className={`tag ${useState === "excluded" ? "tag--red" : "tag--amber"}`}>{humanize(issue.issueCode)}</span></td>
                      <td className="num">{issue.observedValue || "blank"}</td>
                      <td><b>{issue.reason}</b><span className="cell-detail">{issue.correctiveAction}</span></td>
                      <td><span className={`pill ${useState === "excluded" ? "pill--red" : "pill--amber"}`}>{useState ?? "used"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                <strong>{FRESHNESS_LABEL[stock.freshness.state]}</strong>
                {!stock.usableForCover && <small>Cover unavailable: {stock.reasonCodes.map(humanize).join(" · ") || "stock evidence incomplete"}</small>}
              </article>
            ))}
          </div>
        </section>
      )}

      {props.snapshot.normalizations.length > 0 && (
        <section className="card evidence-section">
          <div className="card__head">
            <div>
              <h2 className="card-title">Safe normalizations</h2>
              <p className="card-sub">Whitespace, line endings, and retailer-confirmed date representations only.</p>
            </div>
            <span className="pill pill--grey">{props.snapshot.normalizations.length} events</span>
          </div>
          <div className="table-scroll">
            <table className="dtable">
              <thead><tr><th>Row</th><th>Column</th><th>Original</th><th>Result</th><th>Type</th></tr></thead>
              <tbody>
                {props.snapshot.normalizations.slice(0, 12).map((event, index) => (
                  <tr key={`${event.sourceRow}-${event.sourceColumn}-${index}`}>
                    <td>#{event.sourceRow}</td><td>{event.sourceColumn}</td><td className="num">{event.originalValue}</td>
                    <td className="num">{event.resultingValue}</td><td>{humanize(event.normalizationType)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="footer-row">
        <p className="validity">
          <i aria-hidden="true">✓</i>
          {unresolvedDuplicates > 0
            ? `${unresolvedDuplicates} duplicate decision${unresolvedDuplicates === 1 ? "" : "s"} remain; affected products are Limited.`
            : `Calculations use ${props.snapshot.reconciliation.rowsUsed.toLocaleString("en")} valid rows only.`}
        </p>
        <div className="footer-row__right">
          <button type="button" className="btn btn--ghost" onClick={download}>↓ Download correction report</button>
          <button type="button" className="btn btn--primary" onClick={props.onContinue}>Review demand →</button>
        </div>
      </div>

      <button type="button" className="btn--link back-link" onClick={props.onBack}>← Back to mapping</button>
    </>
  );
}
