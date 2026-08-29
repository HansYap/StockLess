import { useMemo } from "react";
import { analyseReadiness, correctionReportCsv, type IssueKind } from "../mock-analysis.ts";
import type { MappingState, ParsedDataset } from "../engine.ts";

interface ReadinessScreenProps {
  readonly dataset: ParsedDataset;
  readonly mapping: MappingState;
  readonly filter: IssueKind | null;
  readonly onFilter: (kind: IssueKind | null) => void;
  readonly onBack: () => void;
  readonly onContinue: () => void;
}

/** Screen 03. Shows what was excluded and why, and lets every row be traced. */
export function ReadinessScreen(props: ReadinessScreenProps) {
  const result = useMemo(
    () => analyseReadiness(props.dataset, props.mapping),
    [props.dataset, props.mapping],
  );

  const shown = props.filter
    ? result.corrections.filter((row) => row.kind === props.filter)
    : result.corrections;
  const preview = shown.slice(0, 8);
  const clean = result.corrections.length === 0;

  function download() {
    const blob = new Blob([correctionReportCsv(result)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `StockLess_correction_report_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <p className="eyebrow">Data readiness</p>
      <h1 className="title">
        {clean
          ? "Your file is ready to review."
          : "Your file is usable, with issues to review."}
      </h1>
      <p className="lede">
        StockLess shows the exact rows and values that need attention before they can influence the
        descriptive results.
      </p>

      <div className="ready">
        <div className="ready__left">
          <span className="ready__tick" aria-hidden="true">✓</span>
          <div>
            <h2>Ready for descriptive review</h2>
            <p>Only valid rows are included. The correction report keeps every excluded row traceable.</p>
          </div>
        </div>
        <div>
          <div className="ready__count">{result.usableRows.toLocaleString("en")}</div>
          <div className="ready__unit">usable rows of {result.totalRows.toLocaleString("en")}</div>
        </div>
      </div>

      <div className="issues">
        {result.issues.map((issue) => {
          const active = props.filter === issue.kind;
          return (
            <button
              type="button"
              key={issue.kind}
              className={`issue${active ? " issue--active" : ""}`}
              disabled={issue.count === 0}
              aria-pressed={active}
              onClick={() => props.onFilter(active ? null : issue.kind)}
            >
              <span className="issue__head">
                <span className="issue__label">{issue.label}</span>
                <span className={`pill ${issue.severity === "fix" ? "pill--red" : "pill--amber"}`}>
                  {issue.severity === "fix" ? "Fix" : "Review"}
                </span>
              </span>
              <span className="issue__value">{issue.count}</span>
              <span className="issue__hint">{issue.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="split split--wide">
        <section className="card split__main">
          <div className="card__head">
            <div>
              <h2 className="card-title">Rows needing correction</h2>
              <p className="card-sub">
                {props.filter
                  ? "Filtered. Select the same card again to show everything."
                  : "Preview of the downloadable correction report."}
              </p>
            </div>
            <span className="pill pill--grey">
              Showing {preview.length} of {shown.length}
            </span>
          </div>

          {preview.length === 0 ? (
            <p className="empty">Nothing to correct in this selection.</p>
          ) : (
            <div className="table-scroll">
              <table className="dtable">
                <thead>
                  <tr>
                    <th style={{ width: "11%" }}>Row</th>
                    <th style={{ width: "24%" }}>Issue</th>
                    <th style={{ width: "27%" }}>Found value</th>
                    <th style={{ width: "38%" }}>How to fix it</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={`${row.sourceRow}-${row.kind}`}>
                      <td><b>#{row.sourceRow.toLocaleString("en")}</b></td>
                      <td>
                        <span className={`tag ${row.kind === "invalid_date" || row.kind === "invalid_quantity" ? "tag--red" : "tag--amber"}`}>
                          {row.issueLabel}
                        </span>
                      </td>
                      <td className="num">{row.foundValue}</td>
                      <td>{row.howToFix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className={result.warnings.length > 0 ? "panel-warn" : "panel-warn panel-warn--calm"}>
          <span className="panel-warn__icon" aria-hidden="true">
            {result.warnings.length > 0 ? "!" : "✓"}
          </span>
          <h2>
            {result.warnings.length === 0
              ? "No timeline warnings"
              : result.warnings.length === 1
                ? "One timeline warning"
                : `${result.warnings.length} timeline warnings`}
          </h2>
          <p>
            {result.warnings.length === 0
              ? "The recorded history is continuous and the stock snapshot is recent."
              : "These do not make the file unusable, but they change how confidently the history can be interpreted."}
          </p>
          {result.warnings.length > 0 && <hr />}
          {result.warnings.map((warning) => (
            <div className="warn-item" key={warning.title}>
              <b>{warning.title}</b>
              {warning.detail}
            </div>
          ))}
        </aside>
      </div>

      <div className="footer-row">
        <p className="validity">
          <i aria-hidden="true">✓</i>
          Calculations use {result.usableRows.toLocaleString("en")} valid rows only.
        </p>
        <div className="footer-row__right">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={result.corrections.length === 0}
            onClick={download}
          >
            ↓ Download correction report
          </button>
          <button type="button" className="btn btn--primary" onClick={props.onContinue}>
            Review product history →
          </button>
        </div>
      </div>

      <button type="button" className="btn--link back-link" onClick={props.onBack}>
        ← Back to mapping
      </button>
    </>
  );
}
