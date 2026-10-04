import "./readiness.css";
import { ReadinessOverview, foodCategory } from "./ReadinessOverview.tsx";
import { ReadinessCharts, FILTER_META, issueMatches, type ReadinessIssueFilter } from "./ReadinessCharts.tsx";
export type { ReadinessIssueFilter } from "./ReadinessCharts.tsx";
import { t, useLanguage } from "../i18n/index.ts";
import { useEffect, useMemo, useState } from "react";
import {
  buildProductTimelines,
  createCorrectionReport,
  detectDateFormatCandidate,
  type ConfirmedDateFormat,
  type DataIssue,
  type DateFormatConfirmation,
  type MappingState,
  type NormalizationEvent,
  type ParsedDataset,
  type ReadinessSnapshot,
} from "../engine.ts";

interface ReadinessScreenProps {
  readonly dataset: ParsedDataset;
  readonly mapping: MappingState;
  readonly snapshot: ReadinessSnapshot;
  readonly dateConfirmations: readonly DateFormatConfirmation[];
  readonly checking: boolean;
  readonly error: string | null;
  readonly forecasting: boolean;
  readonly forecastError: string | null;
  readonly filter: ReadinessIssueFilter | null;
  readonly onFilter: (kind: ReadinessIssueFilter | null) => void;
  readonly onConfirmDateFormat: (sourceColumnId: string, format: ConfirmedDateFormat) => void;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  readonly reportFilename: string;
}

const TIDY_UP_LABEL: Readonly<Record<NormalizationEvent["normalizationType"], string>> = Object.freeze({
  trim_whitespace: "Trim leading and trailing whitespace",
  normalize_line_endings: "Normalise line endings",
  confirmed_date_format: "Use the retailer-confirmed date format",
});

const TIDY_UPS_PER_PAGE = 25;
const PROBLEMS_PER_PAGE = 25;

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

/** Screen 03. Renders the domain engine's immutable Epic 2 evidence snapshot. */
export function ReadinessScreen(props: ReadinessScreenProps) {
  useLanguage();
  const [problemPage, setProblemPage] = useState(0);
  const [tidyUpPage, setTidyUpPage] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("All foods");
  const timelines = useMemo(() => buildProductTimelines(props.snapshot), [props.snapshot]);
  const report = useMemo(() => createCorrectionReport(props.snapshot), [props.snapshot]);

  useEffect(() => {
    setProblemPage(0);
    setTidyUpPage(0);
  }, [props.snapshot.id]);
  useEffect(() => setProblemPage(0), [props.filter]);

  const dateEvidence = useMemo(() => {
    const fields = ["transaction_date", "stock_as_of_date", "expiry_date"] as const;
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

  const categoryByRow = new Map(props.snapshot.rows.map(row => [row.sourceRow, foodCategory(row.interpretedValues.productName ?? row.interpretedValues.productCode ?? "")]));
  const availableCategories = [...new Set(categoryByRow.values())].sort();
  const categoryMatches = (sourceRow: number) => categoryFilter === "All foods" || categoryByRow.get(sourceRow) === categoryFilter;
  const actionableIssues = props.snapshot.issues.filter(issue => issue.issueCode !== "DUPLICATE_CANDIDATE" && issue.issueCode !== "DUPLICATE_CONFIRMED");
  const shown = actionableIssues.filter(issue =>
    (!props.filter || issueMatches(issue, props.filter)) && categoryMatches(issue.sourceRow));
  const problemPageCount = Math.max(1, Math.ceil(shown.length / PROBLEMS_PER_PAGE));
  const currentProblemPage = Math.min(problemPage, problemPageCount - 1);
  const problemStart = currentProblemPage * PROBLEMS_PER_PAGE;
  const visibleProblems = shown.slice(problemStart, problemStart + PROBLEMS_PER_PAGE);
  const filteredTidyUps = props.snapshot.normalizations.filter(event => categoryMatches(event.sourceRow));
  const tidyUpPageCount = Math.max(1, Math.ceil(filteredTidyUps.length / TIDY_UPS_PER_PAGE));
  const currentTidyUpPage = Math.min(tidyUpPage, tidyUpPageCount - 1);
  const tidyUpStart = currentTidyUpPage * TIDY_UPS_PER_PAGE;
  const visibleTidyUps = filteredTidyUps.slice(tidyUpStart, tidyUpStart + TIDY_UPS_PER_PAGE);

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
    <div className="readiness-redesign">
      <p className="eyebrow">{t("Data readiness · snapshot ")}{props.snapshot.analysisDate}</p>
      <h1 className="title">{t("Check your data")}</h1>
      <p className="lede">{t("StockLess checked your sales and stock data. Review any issues before planning your purchases.")}</p>

      {t(props.checking && <p className="notice notice--info" role="status">{t("Refreshing the readiness evidence locally…")}</p>)}
      {t(props.error && <p className="notice notice--error" role="alert">{t(props.error)}</p>)}

      <ReadinessOverview snapshot={props.snapshot} timelines={timelines} />

      {props.snapshot.duplicateGroups.length > 0 && <p className="notice notice--info" role="status">{props.snapshot.duplicateGroups.length} {t(props.snapshot.duplicateGroups.length === 1 ? "duplicate group resolved automatically; the latest matching row is kept." : "duplicate groups resolved automatically; the latest matching row is kept.")}</p>}
      {dateEvidence.length > 0 && (
        <section className="decision-grid" aria-label={t("Readiness decisions")}>
          {dateEvidence.map(({ column, detection, confirmation }) => (
            <article className="decision-card" key={column.id}>
              <span className="pill pill--amber">{t("Date format")}</span>
              <h2>{column.header}</h2>
              <p>
                {t(confirmation
                  ? `${confirmation.format} is explicitly confirmed for this column.`
                  : detection.state === "ambiguous"
                    ? "These values match more than one format. Choose the format used by the whole column."
                    : "Confirm the one detected non-ISO format before these dates are used.")}
              </p>
              <div className="decision-card__actions">
                {t(detection.candidates.map((format) => (
                  <button
                    type="button"
                    className={`btn btn--small ${confirmation?.format === format ? "btn--primary" : "btn--ghost"}`}
                    disabled={props.checking || confirmation?.format === format}
                    onClick={() => props.onConfirmDateFormat(column.id, format)}
                    key={format}
                  >
                    {t(confirmation?.format === format ? `${format} confirmed` : `Confirm ${format}`)}
                  </button>
                )))}
              </div>
            </article>
          ))}


        </section>
      )}

      <section className="problems">
        <div className="problems__head"><div><h2>{actionableIssues.length} {t("issues to review")}</h2><p>{t("Here are the issues StockLess found and what you can do about them.")}</p></div>
          <span className="pill pill--grey">{props.snapshot.reconciliation.rowsExcluded} {t("Rows left out")}</span>
        </div>
        <div className="readiness-filters">
          <label>{t("Food category")}<select value={categoryFilter} onChange={event => { setCategoryFilter(event.currentTarget.value); setProblemPage(0); setTidyUpPage(0); }}><option value="All foods">{t("All foods")}</option>{availableCategories.map(category => <option key={category} value={category}>{t(category)}</option>)}</select></label>
          <label>{t("Issue type")}<select value={props.filter ?? "all"} onChange={event => props.onFilter(event.currentTarget.value === "all" ? null : event.currentTarget.value as ReadinessIssueFilter)}><option value="all">{t("All issues")}</option>{Object.entries(FILTER_META).map(([key, meta]) => <option key={key} value={key}>{t(meta.label)}</option>)}</select></label>
        </div>
        <div className="problems__list">
          {[...Object.keys(FILTER_META), "other"].map(kind => {
            const filter = kind as ReadinessIssueFilter;
            const issues = kind === "other" ? shown.filter(issue => !Object.keys(FILTER_META).some(key => issueMatches(issue, key as ReadinessIssueFilter))) : shown.filter(issue => issueMatches(issue, filter));
            if (!issues.length) return null;
            const meta = kind === "other" ? { label: "Other issues", severity: "review" } : FILTER_META[filter];
            return <details className={`igroup igroup--${meta.severity}`} key={kind}>
              <summary><span className="igroup__icon" aria-hidden="true">!</span><span className="igroup__title"><b>{t(meta.label)}</b><span className="igroup__count">{new Set(issues.map(issue => issue.sourceRow)).size} {t("rows affected")}</span></span></summary>
              <ul className="igroup__rows">{issues.map(issue => {
                const row = props.snapshot.rows.find(row => row.sourceRow === issue.sourceRow);
                const values = row?.interpretedValues;
                return <li key={issue.id}>
                  <div className="igroup__who"><b>{values?.productName ?? issue.originalProductHint ?? issue.productKey ?? t("Unknown product")}</b><span className="num">{values?.productCode ?? "—"} · {t("Row")} {issue.sourceRow.toLocaleString("en")}</span></div>
                  <div className="igroup__found"><span className="igroup__key">{t("What StockLess found")}</span><code className="trace-value">{issue.observedValue || t("blank")}</code><p>{t(issue.reason)}</p></div>
                  <div className="igroup__todo"><span className="igroup__key">{t("What to do")}</span>{t(issue.correctiveAction)}</div>
                  <span className={`pill ${row?.useState === "excluded" ? "pill--red" : "pill--amber"}`}>{t(row?.useState === "excluded" ? "Not included in totals" : "Included in totals")}</span>
                </li>;
              })}</ul>
            </details>;
          })}
          {shown.length === 0 && <p className="empty">{t("Nothing to correct in this selection.")}</p>}
        </div>
        {filteredTidyUps.length > 0 && <details className="tidyups"><summary><span className="tidyups__tick" aria-hidden="true">✓</span>{filteredTidyUps.length} {t("safe tidy-ups applied")}</summary><ul className="tidyups__list">{visibleTidyUps.map((event, index) => <li key={`${event.sourceRow}-${event.sourceColumn}-${index}`}><b>{t(TIDY_UP_LABEL[event.normalizationType])}</b><span>{t("Row")} {event.sourceRow}</span><code>{JSON.stringify(event.originalValue)}</code><span aria-hidden="true">→</span><code>{JSON.stringify(event.resultingValue)}</code></li>)}</ul><p className="tidyups__note">{t("Every tidy-up is available in the underlying evidence and download. Your original file has not been changed.")}</p></details>}
        <button type="button" className="btn btn--small btn--ghost problems__download" onClick={download}>{t("↓ Download problem list")}</button>
      </section>

      <details className="deepdive"><summary>{t("Show the underlying numbers and charts")}</summary>
      <ReadinessCharts snapshot={props.snapshot} filter={props.filter} onFilter={props.onFilter} />
      <section className="card evidence-section">
        <div className="card__head">
          <div>
            <h2 className="card-title">{t("Problems and tidy-ups")}</h2>
            <p className="card-sub">
              {t(props.filter ? "Problems are filtered by the selected card." : "Problems and permitted tidy-ups from this same local snapshot.")}
            </p>
          </div>
          <span className="pill pill--grey">
            {t(shown.length === 0 ? "0 problems" : `Showing ${problemStart + 1}–${problemStart + visibleProblems.length} of ${shown.length}`)}
          </span>
        </div>

        {visibleProblems.length === 0 ? (
          <p className="empty">{t("Nothing to correct in this selection.")}</p>
        ) : (
          <div className="table-scroll">
            <table className="dtable dtable--readiness">
              <thead>
                <tr>
                  <th>{t("Row")}</th>
                  <th>{t("Product")}</th>
                  <th>{t("Issue")}</th>
                  <th>{t("Observed value")}</th>
                  <th>{t("Reason and action")}</th>
                  <th>{t("Use")}</th>
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
                      <td><b>#{t(issue.sourceRow.toLocaleString("en"))}</b></td>
                      <td className="num">{product}</td>
                      <td><span className={`tag ${useState === "excluded" ? "tag--red" : "tag--amber"}`}>{t(humanize(issue.issueCode))}</span></td>
                      <td className="num">{issue.observedValue || "blank"}</td>
                      <td><b>{t(issue.reason)}</b><span className="cell-detail">{t(issue.correctiveAction)}</span></td>
                      <td><span className={`pill ${useState === "excluded" ? "pill--red" : "pill--amber"}`}>{t(useState === "excluded" ? "Left out" : "Used")}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {t(shown.length > 0 && (
          <div className="table-pager" aria-label={t("Problem pages")}>
            <span>{t("Every problem is included in the download.")}</span>
            <div className="table-pager__actions">
              <button
                type="button"
                className="btn btn--small btn--ghost"
                disabled={currentProblemPage === 0}
                onClick={() => setProblemPage((page) => Math.max(0, page - 1))}
              >
                {t("← Previous")}</button>
              <span>{t("Page ")}{t(currentProblemPage + 1)} {t("of ")}{t(problemPageCount)}</span>
              <button
                type="button"
                className="btn btn--small btn--ghost"
                disabled={currentProblemPage >= problemPageCount - 1}
                onClick={() => setProblemPage((page) => Math.min(problemPageCount - 1, page + 1))}
              >
                {t("Next →")}</button>
            </div>
          </div>
        ))}

        {props.snapshot.normalizations.length > 0 && (
          <div className="tidy-up-list">
            <div className="card__head">
              <div>
                <h3 className="card-title">{t("Every tidy-up")}</h3>
                <p className="card-sub">
                  {t("Each event shows its source row, exact before-and-after value, and the tidy-up.")}</p>
              </div>
              <span className="pill pill--grey">{t(props.snapshot.normalizations.length)} {t("events")}</span>
            </div>
            <div className="table-scroll">
              <table className="dtable dtable--tidy-ups">
                <thead>
                  <tr>
                    <th>{t("Row number")}</th>
                    <th>{t("Column")}</th>
                    <th>{t("What was there before")}</th>
                    <th>{t("What it is now")}</th>
                    <th>{t("Tidy-up applied")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTidyUps.map((event, index) => (
                    <tr key={`${event.sourceRow}-${event.sourceColumn}-${tidyUpStart + index}`}>
                      <td><b>#{t(event.sourceRow.toLocaleString("en"))}</b></td>
                      <td>{props.dataset.columns.find((column) => column.id === event.sourceColumn)?.header ?? event.sourceColumn}</td>
                      <td><code className="trace-value">{JSON.stringify(event.originalValue)}</code></td>
                      <td><code className="trace-value">{JSON.stringify(event.resultingValue)}</code></td>
                      <td>{t(TIDY_UP_LABEL[event.normalizationType])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-pager" aria-label={t("Tidy-up pages")}>
              <span>
                {t("Showing ")}{t(tidyUpStart + 1)}–{t(tidyUpStart + visibleTidyUps.length)} {t("of ")}{t(props.snapshot.normalizations.length)}
              </span>
              <div className="table-pager__actions">
                <button
                  type="button"
                  className="btn btn--small btn--ghost"
                  disabled={currentTidyUpPage === 0}
                  onClick={() => setTidyUpPage((page) => Math.max(0, page - 1))}
                >
                  {t("← Previous")}</button>
                <span>{t("Page ")}{t(currentTidyUpPage + 1)} {t("of ")}{t(tidyUpPageCount)}</span>
                <button
                  type="button"
                  className="btn btn--small btn--ghost"
                  disabled={currentTidyUpPage >= tidyUpPageCount - 1}
                  onClick={() => setTidyUpPage((page) => Math.min(tidyUpPageCount - 1, page + 1))}
                >
                  {t("Next →")}</button>
              </div>
            </div>
          </div>
        )}
      </section>

      </details>

      {t(props.forecastError && <p className="notice notice--error" role="alert">{t(props.forecastError)}</p>)}

      <div className="footer-row">
        <p className="validity">
          <i aria-hidden="true">✓</i>
          {t(`Calculations use ${props.snapshot.reconciliation.rowsUsed.toLocaleString("en")} valid rows only.`)}
        </p>
        <div className="footer-row__right">
          <button type="button" className="btn btn--ghost" onClick={download}>{t("↓ Download problems")}</button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={props.onContinue}
            disabled={props.forecasting}
            aria-busy={props.forecasting}
          >
            {t(props.forecasting && <span className="btn__spinner" aria-hidden="true" />)}
            {t(props.forecasting ? "Estimating demand locally…" : "Continue to purchase planning →")}
          </button>
        </div>
      </div>

      <button type="button" className="btn--link back-link" onClick={props.onBack}>{t("← Back to mapping")}</button>
    </div>
  );
}
