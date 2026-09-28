import { t, useLanguage } from "../i18n/index.ts";
import type { DataIssue, DataIssueCode, ReadinessSnapshot } from "../engine.ts";

export type ReadinessIssueFilter = "dates" | "quantities" | "identity" | "duplicates" | "stock";

export const FILTER_CODES: Readonly<Record<ReadinessIssueFilter, readonly DataIssueCode[]>> = {
  dates: ["INVALID_DATE", "FUTURE_TRANSACTION_DATE", "DATE_FORMAT_CONFIRMATION_REQUIRED", "INVALID_EXPIRY_DATE"],
  quantities: ["INVALID_QUANTITY", "INVALID_PLANNED_ORDER", "INVALID_INCOMING_STOCK", "CONFLICTING_PLANNED_ORDER", "CONFLICTING_INCOMING_STOCK"],
  identity: ["MISSING_IDENTITY"],
  duplicates: ["DUPLICATE_CANDIDATE", "DUPLICATE_CONFIRMED"],
  stock: ["INVALID_CURRENT_STOCK", "MISSING_CURRENT_STOCK", "INVALID_STOCK_DATE", "MISSING_STOCK_DATE", "FUTURE_STOCK_DATE", "CONFLICTING_CURRENT_STOCK", "CONFLICTING_STOCK_DATE"],
};

export const FILTER_META: Readonly<Record<ReadinessIssueFilter, Readonly<{
  label: string;
  hint: string;
  severity: "fix" | "review";
  color: string;
  explanation: string;
}>>> = {
  dates: { label: "Date issues", hint: "Invalid or unconfirmed date values", severity: "fix", color: "#eb6834", explanation: "StockLess checks whether each sale date can be interpreted reliably. Invalid or ambiguous dates are flagged." },
  quantities: { label: "Quantity issues", hint: "Values that are not finite numbers", severity: "fix", color: "#2a78d6", explanation: "Quantities must resolve to valid numbers. Missing, non-numeric or conflicting values are flagged." },
  identity: { label: "Missing product ID", hint: "Rows without the chosen product identity", severity: "fix", color: "#eda100", explanation: "Each sales row needs a reliable product identifier so sales can be grouped correctly." },
  duplicates: { label: "Duplicate rows", hint: "Matching rows need your decision", severity: "review", color: "#e87ba4", explanation: "Identical source rows remain traceable. You can decide whether to count both or exclude repeats." },
  stock: { label: "Stock data", hint: "Optional stock values that limit cover", severity: "review", color: "#4a3aa7", explanation: "Current stock and stock-count dates are optional evidence for coverage and restocking." },
};

export function issueMatches(issue: DataIssue, filter: ReadinessIssueFilter): boolean {
  return FILTER_CODES[filter].includes(issue.issueCode);
}

const kinds = Object.keys(FILTER_META) as ReadinessIssueFilter[];

const BAR_CATEGORIES: Record<ReadinessIssueFilter, readonly { label: string; codes: readonly DataIssueCode[] }[]> = {
  dates: [
    { label: "Invalid format", codes: ["INVALID_DATE", "INVALID_EXPIRY_DATE"] },
    { label: "Future date", codes: ["FUTURE_TRANSACTION_DATE"] },
    { label: "Unconfirmed", codes: ["DATE_FORMAT_CONFIRMATION_REQUIRED"] },
  ],
  quantities: [
    { label: "Not a number", codes: ["INVALID_QUANTITY", "INVALID_PLANNED_ORDER", "INVALID_INCOMING_STOCK"] },
    { label: "Conflicting", codes: ["CONFLICTING_PLANNED_ORDER", "CONFLICTING_INCOMING_STOCK"] },
  ],
  identity: [{ label: "No product ID", codes: ["MISSING_IDENTITY"] }],
  duplicates: [
    { label: "Matching rows", codes: ["DUPLICATE_CANDIDATE", "DUPLICATE_CONFIRMED"] },
    { label: "Left out", codes: ["DUPLICATE_CONFIRMED"] },
  ],
  stock: [
    { label: "Stock missing", codes: ["MISSING_CURRENT_STOCK"] },
    { label: "Stock invalid", codes: ["INVALID_CURRENT_STOCK", "CONFLICTING_CURRENT_STOCK"] },
    { label: "Date missing", codes: ["MISSING_STOCK_DATE", "INVALID_STOCK_DATE", "FUTURE_STOCK_DATE", "CONFLICTING_STOCK_DATE"] },
  ],
};

function rowCount(issues: readonly DataIssue[], codes: readonly DataIssueCode[]): number {
  return new Set(issues.filter(issue => codes.includes(issue.issueCode)).map(issue => issue.sourceRow)).size;
}

export function ReadinessCharts({ snapshot, filter, onFilter }: {
  snapshot: ReadinessSnapshot;
  filter: ReadinessIssueFilter | null;
  onFilter: (filter: ReadinessIssueFilter | null) => void;
}) {
  useLanguage();
  const { rowsIn, rowsUsed, rowsExcluded } = snapshot.reconciliation;
  const excluded = snapshot.rows.filter(row => row.useState === "excluded");
  const excludedByKind = Object.fromEntries(kinds.map(kind => [kind, 0])) as Record<ReadinessIssueFilter, number>;
  let otherExcluded = 0;
  for (const row of excluded) {
    const kind = kinds.find(candidate => snapshot.issues.some(issue => issue.sourceRow === row.sourceRow && issueMatches(issue, candidate)));
    if (kind) excludedByKind[kind] += 1;
    else otherExcluded += 1;
  }
  // A reconciled row is counted once in the donut, even if it has several issues.
  otherExcluded += Math.max(0, rowsExcluded - excluded.length);
  const legend = [
    { label: "Usable rows", count: rowsUsed, color: "#0f9e8c" },
    ...kinds.map(kind => ({ label: FILTER_META[kind].label, count: excludedByKind[kind], color: FILTER_META[kind].color })),
    ...(otherExcluded ? [{ label: "Other", count: otherExcluded, color: "#95a5aa" }] : []),
  ];
  let cumulative = 0;
  const segments = legend.map(item => {
    const start = cumulative;
    cumulative += rowsIn ? item.count / rowsIn * 100 : 0;
    return `${item.color} ${start}% ${cumulative}%`;
  });

  return <>
    <div className="ready">
      <div className="ready__left">
        <span className="ready__tick" aria-hidden="true">✓</span>
        <div>
          <h2>{t("Exact row reconciliation")} <span className="readiness-info" tabIndex={0} title={t("Every source row is tracked through readiness; none is silently discarded.")} aria-label={t("Every source row is tracked through readiness; none is silently discarded.")}>i</span></h2>
          <p>{rowsIn.toLocaleString("en")} → {rowsUsed.toLocaleString("en")} + {rowsExcluded.toLocaleString("en")}</p>
        </div>
      </div>
      <div><div className="ready__count">{rowsUsed.toLocaleString("en")}</div><div className="ready__unit">{t("usable rows of ")}{rowsIn.toLocaleString("en")}</div></div>
    </div>

    <div className="verdict readiness-verdict" aria-label={t("Readiness result")}>
      <div className="verdict__cell verdict__cell--go"><span className="verdict__label">{t("Can continue")}</span><span className="verdict__value">{rowsUsed.toLocaleString("en")}</span><span className="verdict__note">{t("rows passed every check and will be used.")}</span></div>
      <div className="verdict__cell verdict__cell--fix"><span className="verdict__label">{t("Must fix")}</span><span className="verdict__value">{rowsExcluded.toLocaleString("en")}</span><span className="verdict__note">{t("rows are left out until corrected in your file.")}</span></div>
      <div className="verdict__cell verdict__cell--next"><b>{t("Next step:")}</b><p className="verdict__next">{t("Continue with the usable rows, or download the problem list and correct your file first.")}</p></div>
    </div>

    <div className="issues issues--five">
      {kinds.map(kind => {
        const meta = FILTER_META[kind];
        const count = rowCount(snapshot.issues, FILTER_CODES[kind]);
        const active = filter === kind;
        const bars = BAR_CATEGORIES[kind].map(category => ({ ...category, count: rowCount(snapshot.issues, category.codes) }));
        const max = Math.max(1, ...bars.map(bar => bar.count));
        return <div key={kind} className={`issue${active ? " issue--active" : ""}${count === 0 ? " issue--empty" : ""}`}>
          <button className="issue__hit" type="button" disabled={count === 0} aria-label={`${t("Filter")}: ${t(meta.label)}`} aria-pressed={active} onClick={() => onFilter(active ? null : kind)} />
          <span className="issue__head"><span className="issue__label">{t(meta.label)}</span><span className="readiness-info" tabIndex={0} title={t(meta.explanation)} aria-label={t(meta.explanation)}>i</span><span className={`pill ${meta.severity === "fix" ? "pill--red" : "pill--amber"}`}>{t(meta.severity === "fix" ? "Fix" : "Review")}</span></span>
          <span className="issue__value">{count.toLocaleString("en")}</span>
          <span className="issue__hint">{t(meta.hint)}</span>
          <span className="minibars" aria-hidden="true">{bars.map(bar => <span className="minibars__col" key={bar.label}><span className="minibars__value">{bar.count}</span><span className="minibars__track"><span className="minibars__fill" style={{ height: bar.count ? `${Math.max(5, bar.count / max * 100)}%` : "2px", background: bar.count ? meta.color : "var(--line)" }} /></span><span className="minibars__label">{t(bar.label)}</span></span>)}</span>
        </div>;
      })}
    </div>

    <div className="chart-row readiness-chart-row"><section className="card chart-card" aria-label={t("Data quality by row")}>
      <div className="card__head"><div><h2 className="card-title">{t("Data quality by row")}</h2><p className="card-sub">{t("How many rows are usable, and why the rest are set aside.")}</p></div></div>
      <div className="donut"><div className="donut__ring" role="img" aria-label={`${rowsUsed} ${t("usable rows of ")} ${rowsIn}`}><div className="donut__disc" style={{ background: rowsIn ? `conic-gradient(${segments.join(", ")})` : "var(--line-soft)" }} /><div className="donut__centre"><b>{rowsIn.toLocaleString("en")}</b><span>{t("Total rows")}</span></div></div>
      <ul className="donut__legend">{legend.map(item => <li key={item.label}><span className="donut__swatch" style={{ background: item.color }} aria-hidden="true" /><span className="donut__name">{t(item.label)}</span><span className="donut__count">{item.count.toLocaleString("en")}</span><span className="donut__share">{rowsIn ? Math.round(item.count / rowsIn * 100) : 0}%</span></li>)}</ul></div>
    </section></div>
  </>;
}
