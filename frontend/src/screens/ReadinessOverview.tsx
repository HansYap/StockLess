import { useEffect, useMemo, useRef, useState } from "react";
import { t, useLanguage } from "../i18n/index.ts";
import { ProductLabelList } from "../components/ProductLabelList.tsx";
import { previousCompleteWeekStarts, buildDemandHistoryEvidence, type ProductTimeline, type ReadinessSnapshot } from "../engine.ts";
import { FOOD_CATEGORIES, type FoodCategory } from "../readiness/categories.ts";
import { buildReadinessProducts, type ProductSummary, type ProductStatus } from "../readiness/model.ts";
export { foodCategory } from "../readiness/categories.ts";
const LABELS: Record<ProductStatus, string> = { ready: "Ready", review: "Need review", missing: "Missing data" };
const NOTES: Record<ProductStatus, string> = { ready: "Complete data, no major issues", review: "Usable, with something to check", missing: "Can't be planned yet" };

function weeksFor(product: ProductSummary, date: string) {
  return previousCompleteWeekStarts(date).map(start => ({ start, evidence: product.timeline?.weeks.find(week => week.weekStart === start) }));
}
function WeeklySales({ product, date }: { product: ProductSummary; date: string }) {
  const weeks = weeksFor(product, date), maximum = Math.max(1, ...weeks.map(week => Math.abs(week.evidence?.netQuantity ?? 0)));
  return <div className="rd-weekly"><small>{t("Weekly sales")}</small><span className="spark rd-bars" role="img" aria-label={weeks.map(week => week.start + ": " + (week.evidence?.state && week.evidence.state !== "missing" ? week.evidence.netQuantity : t("Missing — not zero sales"))).join("; ")}>
    {weeks.map(({ start, evidence }) => <span className="rd-bar" key={start} title={start + ": " + (evidence?.netQuantity ?? t("Missing — not zero sales"))}>
      <span>{evidence?.netQuantity ?? "—"}</span><i className={!evidence || evidence.state === "missing" ? "spark__bar--missing" : (evidence.netQuantity ?? 0) < 0 ? "rd-bar--negative" : ""} style={{ height: !evidence || evidence.state === "missing" ? 6 : Math.max(3, Math.abs(evidence.netQuantity ?? 0) / maximum * 28) }} /><small>{start.slice(5)}</small>
    </span>)}
  </span></div>;
}

export function ReadinessOverview({ snapshot, timelines, products: supplied }: { snapshot: ReadinessSnapshot; timelines: readonly ProductTimeline[]; products?: readonly ProductSummary[] }) {
  useLanguage();
  const derived = useMemo(() => supplied ?? buildReadinessProducts(snapshot, timelines), [supplied, snapshot, timelines]);
  const [search, setSearch] = useState(""), [category, setCategory] = useState<FoodCategory | null>(null);
  const [status, setStatus] = useState<ProductStatus | null>(null), [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<ProductSummary | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { setSearch(""); setCategory(null); setStatus(null); setExpanded(false); dialog.current?.close(); setSelected(null); }, [snapshot.id]);
  const counts = { ready: 0, review: 0, missing: 0 }; derived.forEach(product => counts[product.status]++);
  const categories = [null, ...FOOD_CATEGORIES.filter(item => derived.some(product => product.category === item))];
  const query = search.trim().replace(/^sku\s*:?\s*/i, "").toLowerCase();
  const matches = derived.filter(product => (!category || product.category === category) && (!status || product.status === status) && [product.name, product.code, product.pack, ...(product.labels?.names ?? []), ...(product.labels?.codes ?? []), ...(product.labels?.packs ?? [])].join(" ").toLowerCase().includes(query));
  const visible = expanded ? matches : matches.slice(0, 6);
  const openProduct = (product: ProductSummary) => { setSelected(product); dialog.current?.showModal(); };
  return <>
    <section className="rd-stats" aria-label={t("Product readiness summary")}>{(["ready", "review", "missing"] as const).map(item => <button className={"rd-stat rd-stat--" + item} type="button" key={item} aria-pressed={status === item} onClick={() => { setStatus(status === item ? null : item); setExpanded(false); }}>
      <span className="rd-stat__icon" aria-hidden="true">{item === "ready" ? "✓" : item === "review" ? "!" : "×"}</span><span><b className="num rd-stat__number">{counts[item]}</b> <b>{t(item === "ready" ? "products ready" : item === "review" ? "need review" : "missing data")}</b><small>{t(NOTES[item])}</small></span>
    </button>)}</section>
    <section className="rd-card rd-products" aria-labelledby="readiness-products-title">
      <div className="rd-products__head"><div><h2 id="readiness-products-title">{t("Products by category")}</h2><p>{t("Categories are suggested from product names. Products to check are listed first.")}</p><span className="sr-only">{derived.length} {t("products checked")}</span></div>
        <label className="rd-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={event => { setSearch(event.currentTarget.value); setExpanded(false); }} placeholder={t("Search name or code")} aria-label={t("Search name or code")} /></label>
      </div>
      <div className="rd-tabs" role="tablist" aria-label={t("Food categories")}>{categories.map((item, index) => <button key={item ?? "all"} type="button" role="tab" id={"readiness-category-" + index} aria-selected={category === item} tabIndex={category === item ? 0 : -1} aria-controls="readiness-product-panel" onClick={() => { setCategory(item); setExpanded(false); }} onKeyDown={event => {
        const next = event.key === "ArrowRight" ? (index + 1) % categories.length : event.key === "ArrowLeft" ? (index + categories.length - 1) % categories.length : event.key === "Home" ? 0 : event.key === "End" ? categories.length - 1 : -1;
        if (next < 0) return; event.preventDefault(); setCategory(categories[next]); setExpanded(false); document.getElementById("readiness-category-" + next)?.focus();
      }}>{t(item ?? "All")}<span>{item ? derived.filter(product => product.category === item).length : derived.length}</span></button>)}</div>
      {status && <p className="rd-showing">{t("Showing:")} <b>{t(LABELS[status])}</b> <button type="button" className="btn--link" onClick={() => setStatus(null)}>{t("Clear")}</button></p>}
      <div id="readiness-product-panel" className="rd-product-grid" role="tabpanel" aria-labelledby={"readiness-category-" + categories.indexOf(category)}>{visible.map(product => <article className={"pcard rd-product pcard--" + product.status} key={product.key}>
        <header><div><b>{product.name}</b><small className="num pcard__code">SKU: {product.code}{product.pack ? " · " + product.pack : ""}</small></div><span className={"rd-pill rd-pill--" + product.status}>{t(LABELS[product.status])}</span></header>
        <ProductLabelList labels={product.labels} shown={[product.name, product.code, product.pack]} />
        <div className="rd-product__facts"><div><small>{t("Last stock count")}</small><b className="num">{product.stock?.stockAsOfDate ?? "—"}</b></div><div><small>{t("Stock age")}</small><b>{product.stock?.freshness.ageDays === undefined ? "—" : t(String(product.stock.freshness.ageDays) + " days")}</b></div></div>
        <WeeklySales product={product} date={snapshot.analysisDate} />
        <p className={"rd-product__note rd-product__note--" + product.status}>{t(product.reasons[0] ?? "Complete data, no major issues")}</p>
        <button type="button" className="btn btn--ghost btn--small" aria-label={t("View details") + ": " + product.name + " · " + product.code} onClick={() => openProduct(product)}>{t("View details →")}</button>
      </article>)}</div>
      {matches.length === 0 && <p className="rd-empty" role="status">{t("No matching products.")}</p>}
      {matches.length > 6 && <button type="button" className="btn btn--ghost rd-more" onClick={() => setExpanded(!expanded)}>{t(expanded ? "Show fewer products" : "Show all products")} ({matches.length})</button>}
    </section>
    <dialog ref={dialog} className="rd-dialog" aria-labelledby="readiness-product-dialog-title" onClose={() => setSelected(null)}><button type="button" className="btn btn--ghost btn--small rd-dialog__close" onClick={() => dialog.current?.close()}>{t("Close")}</button>
      {selected && <><h2 id="readiness-product-dialog-title">{selected.name}</h2><p className="num">SKU: {selected.code}{selected.pack ? " · " + selected.pack : ""}</p><span className={"rd-pill rd-pill--" + selected.status}>{t(LABELS[selected.status])}</span>
        <ProductLabelList labels={selected.labels} shown={[selected.name, selected.code, selected.pack]} />
        <h3>{t("What to check")}</h3><ul>{(selected.reasons.length ? selected.reasons : ["Complete data, no major issues"]).map(reason => <li key={reason}>{t(reason)}</li>)}</ul>
        {selected.assessment && <section aria-label={t("Available analyses")}><h3>{t("Available analyses")}</h3><ul>{[selected.assessment.history, selected.assessment.demand, selected.assessment.stockCover, selected.assessment.purchase, selected.assessment.cost].map(item => <li key={item.capability}><b>{t(item.label)}</b>: {t(item.state === "available" ? "Available" : item.state === "limited" ? "Limited data" : "Unavailable")}<ul>{item.reasons.map(reason => <li key={reason.message}>{t(reason.message)}</li>)}</ul></li>)}</ul></section>}
        <section aria-label={t("Unit cost validation")}><h3>{t("Unit cost validation")}</h3>{selected.cost?.state === "usable" ? <p>MYR {selected.cost.value} {t("per sales or stock unit")} · {t("Source rows")}: {selected.cost.sourceRows.join(", ")}</p> : <><p>{t("Unavailable")}: {t(selected.cost?.reason ?? "Map Unit cost in Step 2, then rerun Step 3.")}</p><p>{t(selected.cost?.correctiveAction ?? "Map Unit cost in Step 2, then rerun Step 3.")}</p></>}{selected.cost?.sourceColumn && <p>{t("Source column")}: {selected.cost.sourceColumn}</p>}{selected.cost?.state !== "usable" && selected.cost?.sourceColumn && <p>{t("Source rows")}: {selected.cost.sourceRows.join(", ")}</p>}</section>
        <HistoryEvidence product={selected} snapshot={snapshot} />
        <h3>{t("Weekly sales")}</h3><table><thead><tr><th>{t("Week of")}</th><th>{t("Units sold")}</th></tr></thead><tbody>{weeksFor(selected, snapshot.analysisDate).map(({ start, evidence }) => <tr key={start}><td className="num">{start}</td><td className="num">{evidence?.netQuantity ?? t("Missing — not zero sales")}</td></tr>)}</tbody></table>
      </>}
    </dialog>
  </>;
}

function HistoryEvidence({ product, snapshot }: { product: ProductSummary; snapshot: ReadinessSnapshot }) {
  const evidence = buildDemandHistoryEvidence(product.key, snapshot.analysisDate, product.timeline, snapshot);
  return <section aria-label={t("History to improve")}><h3>{t("History to improve")}</h3>
    <p>{t("Usable complete weeks")}: {evidence.usableWeekStarts.length} / 8 · {t("Additional weeks needed")}: {evidence.additionalWeeksNeeded}</p>
    {evidence.missingWeekStarts.length > 0 && <p>{t("Missing weeks")}: {evidence.missingWeekStarts.join(", ")}</p>}
    {evidence.excludedPeriods.map(period => <p key={period.weekStart}>{t("Excluded records")}: {period.weekStart} · {t("Source rows")}: {period.sourceRows.join(", ")} · {period.reasons.map(t).join(" ")}</p>)}
    {evidence.unplacedExcludedRows.length > 0 && <p>{t("Rows with unreadable dates")}: {evidence.unplacedExcludedRows.join(", ")}</p>}
    <p>{t(evidence.correctiveAction)}</p>
  </section>;
}
