import "./readiness.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReadinessOverview } from "./ReadinessOverview.tsx";
import { ReadinessCharts, type ReadinessIssueFilter } from "./ReadinessCharts.tsx";
export type { ReadinessIssueFilter } from "./ReadinessCharts.tsx";
import { t, useLanguage } from "../i18n/index.ts";
import { buildProductTimelines, createCorrectionReport, detectDateFormatCandidate, safeSpreadsheetCell, type ConfirmedDateFormat, type DateFormatConfirmation, type MappingState, type ParsedDataset, type ReadinessSnapshot } from "../engine.ts";
import { FOOD_CATEGORIES } from "../readiness/categories.ts";
import { buildFindings, buildReadinessProducts, type Finding, type FindingType } from "../readiness/model.ts";
interface ReadinessScreenProps {
  readonly dataset: ParsedDataset; readonly mapping: MappingState; readonly snapshot: ReadinessSnapshot;
  readonly dateConfirmations: readonly DateFormatConfirmation[]; readonly checking: boolean; readonly error: string | null;
  readonly forecasting: boolean; readonly forecastError: string | null; readonly filter: ReadinessIssueFilter | null;
  readonly onFilter: (kind: ReadinessIssueFilter | null) => void;
  readonly onConfirmDateFormat: (sourceColumnId: string, format: ConfirmedDateFormat) => void;
  readonly onBack: () => void; readonly onContinue: () => void; readonly onClear?: () => void; readonly reportFilename: string;
}
const GROUPS: readonly [FindingType, string][] = [["date", "Dates we couldn't read"], ["quantity", "Quantities to check"], ["identity", "Rows with no product"], ["stock", "Stock counts to check"], ["other", "Other things to check"], ["tidy", "Safe tidy-ups applied"]];
const OUTCOMES = { out: "Left out", in: "Still counted", done: "Done" };
type FilterField = "category" | "type" | "status";
const FIELD_LABELS: Record<FilterField, string> = { category: "Category", type: "Issue type", status: "Status / shown" };
const EMPTY_FILTERS: Record<FilterField, string[]> = { category: [], type: [], status: [] };
const CHART_TO_TYPE = { dates: "date", quantities: "quantity", identity: "identity", stock: "stock" };
function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
}
export function findingsCsv(findings: readonly Finding[], source: string, analysisDate: string, worksheetName = "", sourceMode: "sample" | "user" = "user", filtered = false): string {
  const rows = [["StockLess data source", sourceMode === "sample" ? "Sample data" : "Retailer file"], ["StockLess file", source, "Worksheet", worksheetName], ["Analysis date", analysisDate],
    ["Correction summary", findings.length ? "Problems and handled records are listed below." : filtered ? "No problems match these filters." : "No problems found for this dataset."],
    ["Product", "Code", "Source row", "Related source rows", "Category", "Issue type", "Observed value", "What we found", "What to do", "Status", "File", "Worksheet", "Field", "Source column", "Row usage"],
    ...findings.flatMap(item => {
      const evidence = item.rowEvidence ?? item.sourceRows.map(sourceRow => ({ sourceRow, used: item.status !== "out" }));
      return (evidence.length ? evidence : [undefined]).map(row => [item.name, item.code, row?.sourceRow ?? "", item.sourceRows.join(", "), item.category, item.type, item.observed, item.reason, item.action, OUTCOMES[item.status], source, worksheetName, item.field ?? "row", item.sourceColumn ?? "", row ? row.used ? "Used" : "Left out" : "No source row"]);
    })];
  return "\uFEFF" + rows.map(row => row.map(value => '"' + safeSpreadsheetCell(String(value)).replace(/"/g, '""') + '"').join(",")).join("\r\n") + "\r\n";
}
function FindingGroup({ type, label, items }: { type: FindingType; label: string; items: readonly Finding[] }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [items.length]);
  return <details className={"rd-finding-group rd-finding-group--" + type}>
    <summary><span className="rd-group-icon" aria-hidden="true">{type === "tidy" ? "✓" : "!"}</span><span><b>{t(label)}</b><small>{items.length} {t(type === "stock" ? "stock checks" : type === "tidy" ? "completed items" : "items")}</small></span><span className="rd-toggle" aria-hidden="true">⌄</span></summary>
    <ul>{(expanded ? items : items.slice(0, 25)).map(item => <li className="rd-finding" key={item.id}>
      <div className="rd-finding__who"><b>{item.name === "Unknown product" ? t(item.name) : item.name}</b><small className="num">{item.code}{item.sourceRows.length ? " · " + t("Rows") + " " + item.sourceRows.join(", ") : ""}</small></div>
      {item.observed && <code className="rd-observed">{item.observed}</code>}
      <div className="rd-finding__advice"><p>{t(item.reason)}</p><p>{t(item.action)}</p></div><span className={"rd-pill rd-pill--" + item.status}>{t(OUTCOMES[item.status])}</span>
    </li>)}</ul>
    {items.length > 25 && <button type="button" className="btn btn--ghost btn--small rd-group-more" onClick={() => setExpanded(!expanded)}>{t(expanded ? "Show fewer" : "Show all findings")} ({items.length})</button>}
  </details>;
}

export function ReadinessScreen(props: ReadinessScreenProps) {
  useLanguage();
  const timelines = useMemo(() => buildProductTimelines(props.snapshot), [props.snapshot]);
  const products = useMemo(() => buildReadinessProducts(props.snapshot, timelines), [props.snapshot, timelines]);
  const findings = useMemo(() => buildFindings(props.snapshot, products), [props.snapshot, products]);
  const [filters, setFilters] = useState(EMPTY_FILTERS), [popover, setPopover] = useState(false);
  const [field, setField] = useState<FilterField | null>(null), [filterSearch, setFilterSearch] = useState("");
  const [evidencePage, setEvidencePage] = useState(0), [compact, setCompact] = useState(false);
  const popoverContainer = useRef<HTMLDivElement>(null), filterButton = useRef<HTMLButtonElement>(null), filterInput = useRef<HTMLInputElement>(null);
  useEffect(() => { setFilters(EMPTY_FILTERS); setEvidencePage(0); setPopover(false); }, [props.snapshot.id]);
  useEffect(() => { setFilters(current => ({ ...current, type: props.filter ? [CHART_TO_TYPE[props.filter]] : [] })); }, [props.filter]);
  useEffect(() => {
    const scroll = () => setCompact(previous => window.scrollY > (previous ? 40 : 140));
    window.addEventListener("scroll", scroll, { passive: true }); return () => window.removeEventListener("scroll", scroll);
  }, []);
  useEffect(() => {
    if (!popover) return;
    filterInput.current?.focus();
    const closeOutside = (event: MouseEvent) => { if (!popoverContainer.current?.contains(event.target as Node)) setPopover(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setPopover(false); filterButton.current?.focus(); } };
    document.addEventListener("mousedown", closeOutside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", closeOutside); document.removeEventListener("keydown", escape); };
  }, [popover]);
  const filterValues: Record<FilterField, readonly (readonly [string, string])[]> = {
    category: FOOD_CATEGORIES.filter(category => findings.some(item => item.category === category)).map(category => [category, category]),
    type: GROUPS.filter(([type]) => findings.some(item => item.type === type)),
    status: Object.entries(OUTCOMES).filter(([status]) => findings.some(item => item.status === status)),
  };
  const shown = useMemo(() => findings.filter(item => (!filters.category.length || filters.category.includes(item.category)) && (!filters.type.length || filters.type.includes(item.type)) && (!filters.status.length || filters.status.includes(item.status))), [findings, filters]);
  const filtered = Object.values(filters).some(values => values.length);
  const updateFilter = (which: FilterField, value: string) => setFilters(current => ({ ...current, [which]: current[which].includes(value) ? current[which].filter(item => item !== value) : [...current[which], value] }));
  const dates = useMemo(() => (["transaction_date", "stock_as_of_date", "expiry_date"] as const).flatMap(which => {
    const id = props.mapping.mappings[which]?.confirmed ? props.mapping.mappings[which]?.sourceColumnId : undefined;
    const column = props.dataset.columns.find(item => item.id === id); if (!column) return [];
    const detection = detectDateFormatCandidate(props.dataset, column.id), confirmation = props.dateConfirmations.find(item => item.sourceColumnId === column.id);
    return !confirmation && ["candidate", "ambiguous"].includes(detection.state) ? [{ column, detection }] : [];
  }), [props.dataset, props.mapping, props.dateConfirmations]);
  const excludedRows = new Set(props.snapshot.rows.filter(row => row.useState === "excluded").map(row => row.sourceRow));
  const mustFix = new Set(props.snapshot.issues.filter(issue => issue.issueCode !== "DUPLICATE_CANDIDATE" && issue.issueCode !== "DUPLICATE_CONFIRMED" && excludedRows.has(issue.sourceRow)).map(issue => issue.sourceRow)).size;
  const counts = { ready: 0, review: 0, missing: 0 }; products.forEach(product => counts[product.status]++);
  const title = products.length === 0 || props.snapshot.reconciliation.rowsUsed === 0 ? "Your data needs corrections" : counts.missing > 0 || counts.review > 0 ? "Your data is mostly ready" : "Your data is ready";
  const unavailable = props.checking || props.forecasting || props.snapshot.reconciliation.rowsUsed === 0;
  const continueButton = <button type="button" className="btn btn--primary" onClick={props.onContinue} disabled={unavailable} aria-busy={props.forecasting}>{t(props.forecasting ? "Estimating demand locally…" : "Continue to purchase planning →")}</button>;
  const currentEvidencePage = Math.min(evidencePage, Math.max(0, Math.ceil(findings.length / 25) - 1));
  return <div className="readiness-screen">
    <section className={"rd-hero" + (compact ? " rd-hero--compact" : "")}><div className="rd-wrap">
      <div className="rd-hero__inner"><div><p className="rd-eyebrow">🪴 {t("Step 3 of 3")}</p><h1>{t(title)}</h1><p className="rd-lede">{t("We checked every row. Problems are listed below with what to do. You can continue with usable rows and fix your file later.")}</p></div>
        <div className="rd-file"><span className="rd-file__icon">{/\.xlsx?$/i.test(props.dataset.sourceName) ? "XLS" : "CSV"}</span><div><b>{props.dataset.sourceName}</b><small><span className={"rd-pill rd-pill--" + (props.dataset.sourceMode === "sample" ? "review" : "ready")}>{t(props.dataset.sourceMode === "sample" ? "Sample" : "Retailer file")}</span>{props.dataset.rows.length.toLocaleString()} {t("rows")} · {props.dataset.columns.length} {t("columns")}</small></div>{props.onClear && <button type="button" className="btn--link" onClick={props.onClear}>{t("Clear session")}</button>}</div>
      </div><div className="rd-actions"><button type="button" className="btn--link" onClick={props.onBack}>{t("← Back to matching")}</button><span className="rd-actions__spacer" /><span className="rd-actions__meta">{mustFix} {t("rows to fix in your file")}</span>{continueButton}</div>
    </div></section>
    <div className="rd-wrap rd-main">
      {props.checking && <p className="notice notice--info" role="status">{t("Refreshing the readiness evidence locally…")}</p>}{props.error && <p className="notice notice--error" role="alert">{t(props.error)}</p>}{props.forecastError && <p className="notice notice--error" role="alert">{t(props.forecastError)}</p>}
      <ReadinessOverview snapshot={props.snapshot} timelines={timelines} products={products} />
      <div className="rd-layout"><section className="rd-card rd-findings" aria-labelledby="readiness-findings-title">
        <div className="rd-card__head"><span className="rd-group-icon" aria-hidden="true">⌕</span><div><h2 id="readiness-findings-title">{t("What we found")}</h2><p>{props.snapshot.reconciliation.rowsExcluded} {t("rows left out of")} {props.snapshot.reconciliation.rowsIn.toLocaleString()} · {t("Your file isn't changed")}</p></div><button type="button" className="btn btn--ghost btn--small" onClick={() => downloadText(findingsCsv(shown, props.dataset.sourceName, props.snapshot.analysisDate, props.dataset.worksheetName, props.snapshot.sourceMode, filtered), props.reportFilename.replace(/\.csv$/i, filtered ? "-filtered.csv" : ".csv"))}>{t("Download list")}</button></div>
        <div className="rd-filterbar"><div className="rd-add-filter" ref={popoverContainer}><button type="button" ref={filterButton} className="rd-filter-button" aria-expanded={popover} aria-controls="readiness-filter-menu" onClick={() => { setPopover(!popover); setField(null); setFilterSearch(""); }}>{t("Add filter")} +</button>
          {popover && <div className="rd-filter-menu" id="readiness-filter-menu" role="dialog" aria-label={t("Add filter")}><input ref={filterInput} type="search" aria-label={t("Search filters")} placeholder={t("Search filters")} value={filterSearch} onChange={event => setFilterSearch(event.currentTarget.value)} />
            {field && <button type="button" onClick={() => { setField(null); setFilterSearch(""); }}>{t("← All filters")}</button>}
            {(field ? filterValues[field] : Object.entries(FIELD_LABELS)).filter(([, label]) => t(label).toLowerCase().includes(filterSearch.toLowerCase())).map(([value, label]) => <button key={value} type="button" aria-pressed={field ? filters[field].includes(value) : undefined} onClick={() => { if (field) updateFilter(field, value); else { setField(value as FilterField); setFilterSearch(""); } }}>{field && <span aria-hidden="true">{filters[field].includes(value) ? "☑" : "☐"}</span>}{t(label)}</button>)}
            <button type="button" className="rd-filter-menu__done" onClick={() => { setPopover(false); filterButton.current?.focus(); }}>{t("Apply filters")}</button>
          </div>}
        </div>{(Object.keys(FIELD_LABELS) as FilterField[]).filter(key => filters[key].length).map(key => <span className="rd-filter-chip" key={key}><b>{t(FIELD_LABELS[key])}:</b> {filters[key].map(value => t(filterValues[key].find(([id]) => id === value)?.[1] ?? value)).join(", ")}<button type="button" aria-label={t("Remove filter") + ": " + t(FIELD_LABELS[key])} onClick={() => { setFilters(current => ({ ...current, [key]: [] })); if (key === "type") props.onFilter(null); }}>×</button></span>)}<span className="rd-filter-count">{shown.length} / {findings.length}</span></div>
        {dates.length > 0 && <details className="rd-date-options"><summary>{t("Confirm date formats to use these rows")}</summary>{dates.map(({ column, detection }) => <div key={column.id}><b>{column.header}</b><p>{t("Choose the format used by this whole column. Ambiguous dates are excluded until confirmed.")}</p>{detection.candidates.map(format => <button key={format} type="button" className="btn btn--ghost btn--small" disabled={props.checking} onClick={() => props.onConfirmDateFormat(column.id, format)}>{t("Confirm ")}{format}</button>)}</div>)}</details>}
        {GROUPS.map(([type, label]) => { const items = shown.filter(item => item.type === type); return items.length ? <FindingGroup key={type} type={type} label={label} items={items} /> : null; })}
        {shown.length === 0 && <p className="rd-empty" role="status">{t(findings.length === 0 ? "No problems found." : "Nothing matches these filters.")}</p>}
      </section><aside className="rd-sidebar"><section className="rd-card rd-planning"><h2>🌳 {t("Ready for planning")}</h2><div className="rd-used"><span>{t("Rows used")}</span><b className="num">{props.snapshot.reconciliation.rowsUsed.toLocaleString()}</b><small>{t("of ")}{props.snapshot.reconciliation.rowsIn.toLocaleString()}</small></div><ul><li>{counts.ready} {t("products are ready to plan")}</li><li>{counts.review} {t("products can be planned with a note to review")}</li><li>{counts.missing} {t("products need more data before planning")}</li></ul><p>{t("Missing weeks are never counted as zero sales.")}</p>{continueButton}</section><section className="rd-card rd-privacy"><b>✓ {t("Your data stays on your device")}</b><p>{t("Checked in your browser. Your file isn't changed.")}</p></section></aside></div>
      <details className="deepdive rd-deepdive"><summary>{t("Show the underlying numbers and charts")}</summary><ReadinessCharts snapshot={props.snapshot} filter={props.filter} onFilter={props.onFilter} />
        {props.snapshot.duplicateGroups.length > 0 && <div className="rd-card rd-duplicate-summary"><h3>{t("Duplicate rows handled automatically")}</h3><p>{props.snapshot.duplicateGroups.length} {t("duplicate groups")} · {props.snapshot.duplicateGroups.reduce((sum, group) => sum + group.sourceRows.length - 1, 0)} {t("repeated rows left out")}</p></div>}
        <section className="rd-card rd-evidence"><div className="rd-card__head"><div><h3>{t("Problems and tidy-ups")}</h3><p>{t("Every finding retains its source rows and original evidence.")}</p></div><button type="button" className="btn btn--ghost btn--small" onClick={() => downloadText(createCorrectionReport(props.snapshot).csvText, props.reportFilename)}>{t("Download all row evidence")}</button></div>
          <div className="rd-table-scroll"><table><thead><tr><th>{t("Rows")}</th><th>{t("Product")}</th><th>{t("What we found")}</th><th>{t("What to do")}</th><th>{t("Status")}</th></tr></thead><tbody>{findings.slice(currentEvidencePage * 25, currentEvidencePage * 25 + 25).map(item => <tr key={item.id}><td className="num">{item.sourceRows.join(", ") || "—"}</td><td>{item.name} · {item.code}</td><td>{item.observed && <code>{item.observed}</code>}<p>{t(item.reason)}</p></td><td>{t(item.action)}</td><td>{t(OUTCOMES[item.status])}</td></tr>)}</tbody></table></div>
          {findings.length > 25 && <div className="rd-pager"><button type="button" className="btn btn--ghost btn--small" disabled={currentEvidencePage === 0} onClick={() => setEvidencePage(currentEvidencePage - 1)}>{t("← Previous")}</button><span>{currentEvidencePage + 1} / {Math.ceil(findings.length / 25)}</span><button type="button" className="btn btn--ghost btn--small" disabled={(currentEvidencePage + 1) * 25 >= findings.length} onClick={() => setEvidencePage(currentEvidencePage + 1)}>{t("Next →")}</button></div>}
        </section>
      </details>
    </div>
  </div>;
}
