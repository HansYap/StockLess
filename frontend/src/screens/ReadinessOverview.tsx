import { useMemo, useState } from "react";
import { t, useLanguage } from "../i18n/index.ts";
import type { ProductTimeline, ReadinessSnapshot } from "../engine.ts";

type Status = "ready" | "review" | "missing";
const LABELS: Record<Status, string> = { ready: "Ready", review: "Need review", missing: "Missing data" };

const FOOD_CATEGORIES = ["Produce", "Dairy & eggs", "Meat & seafood", "Bakery", "Beverages", "Pantry & snacks", "Other"] as const;
export function foodCategory(name: string): (typeof FOOD_CATEGORIES)[number] {
  const value = name.toLowerCase();
  if (/apple|banana|pear|berry|mango|orange|grape|lettuce|tomato|potato|carrot|onion|vegetable|fruit|sayur|buah/.test(value)) return "Produce";
  if (/milk|yogurt|cheese|butter|egg|susu|telur/.test(value)) return "Dairy & eggs";
  if (/chicken|beef|fish|salmon|tuna|prawn|meat|ayam|ikan|daging/.test(value)) return "Meat & seafood";
  if (/bread|bun|cake|pastry|croissant|roti/.test(value)) return "Bakery";
  if (/drink|juice|water|coffee|tea|soda|milk tea|minuman|kopi|teh|milo|nescafe|air mineral/.test(value)) return "Beverages";
  if (/rice|noodle|pasta|sauce|oil|flour|sugar|snack|chips|cereal|biscuit|beras|mee|mi segera|biskut|keropok|gula|garam|tepung|minyak|kicap|sos cili|sardin|serbuk kari|cuka/.test(value)) return "Pantry & snacks";
  return "Other";
}

function WeeklySales({ timeline }: { timeline?: ProductTimeline }) {
  const weeks = timeline?.weeks.slice(-8) ?? [];
  const maximum = Math.max(1, ...weeks.map(w => Math.abs(w.netQuantity ?? 0)));
  return <div className="pcard__trend"><span className="pcard__key">{t("Weekly sales")}</span>
    {weeks.length === 0 ? <span className="spark spark--empty">{t("No valid demand rows are available.")}</span> :
      <span className="spark spark--labelled" role="img" aria-label={weeks.map(w => `${w.weekStart}: ${w.state === "missing" ? t("Missing — not zero sales") : w.netQuantity}`).join("; ")}>
        {weeks.map(w => <span className="spark__col" key={w.weekStart} title={`${w.weekStart}: ${w.state === "missing" ? t("Missing — not zero sales") : w.netQuantity}`}>
          <span className="spark__value">{w.netQuantity ?? "—"}</span>
          <span className={`spark__bar${w.state === "missing" ? " spark__bar--missing" : (w.netQuantity ?? 0) < 0 ? " spark__bar--negative" : ""}`} style={{ height: w.state === "missing" ? 7 : `${Math.max(3, Math.abs(w.netQuantity ?? 0) / maximum * 28)}px` }} />
          <span className="spark__day">{w.weekStart.slice(5)}</span>
        </span>)}
      </span>}
  </div>;
}

export function ReadinessOverview({ snapshot, timelines }: { snapshot: ReadinessSnapshot; timelines: readonly ProductTimeline[] }) {
  useLanguage();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("age");
  const [category, setCategory] = useState("All foods");
  const products = useMemo(() => {
    const rowsByKey = new Map<string, (typeof snapshot.rows)[number][]>();
    const rowKeys = new Map<number, string>();
    for (const row of snapshot.rows) {
      if (!row.productKey) continue;
      const group = rowsByKey.get(row.productKey) ?? [];
      group.push(row);
      rowsByKey.set(row.productKey, group);
      rowKeys.set(row.sourceRow, row.productKey);
    }
    const issuesByKey = new Map<string, (typeof snapshot.issues)[number][]>();
    for (const issue of snapshot.issues) {
      const key = issue.productKey ?? rowKeys.get(issue.sourceRow);
      if (!key) continue;
      const group = issuesByKey.get(key) ?? [];
      group.push(issue);
      issuesByKey.set(key, group);
    }
    const stockByKey = new Map(snapshot.productStock.map(stock => [stock.productKey, stock]));
    const timelineByKey = new Map(timelines.map(timeline => [timeline.productKey, timeline]));
    const keys = new Set([...snapshot.rows.flatMap(row => row.productKey ? [row.productKey] : []), ...snapshot.productStock.map(stock => stock.productKey)]);
    return [...keys].map(key => {
      const rows = rowsByKey.get(key) ?? [];
      const values = rows.find(row => row.interpretedValues.productName)?.interpretedValues ?? rows[0]?.interpretedValues;
      const stock = stockByKey.get(key);
      const timeline = timelineByKey.get(key);
      const issues = (issuesByKey.get(key) ?? []).filter(issue => issue.issueCode !== "DUPLICATE_CANDIDATE" && issue.issueCode !== "DUPLICATE_CONFIRMED");
      const blocked = snapshot.productLimitations.some(item => item.productKey === key);
      const excluded = !rows.some(row => row.useState !== "excluded");
      const status: Status = excluded || !stock?.usableForCover || stock.freshness.state === "unusable" ? "missing"
        : issues.length > 0 || blocked || stock.freshness.state === "limited" || !timeline || timeline.summary.missingWeekCount > 0 ? "review" : "ready";
      const reasons = [...new Set([
        ...issues.map(issue => issue.reason),
        ...snapshot.productLimitations.filter(item => item.productKey === key).map(item => item.message),
        ...(!stock?.usableForCover ? ["Stock evidence is incomplete or cannot be relied on."] : stock.freshness.state === "limited" ? ["The stock count is getting old. A fresher count would be better."] : []),
        ...(timeline?.summary.missingWeekCount ? ["Some weeks are missing — they are not zero sales."] : []),
      ])];
      const name = values?.productName ?? values?.productCode ?? key;
      return { key, name, category: foodCategory(name), code: values?.productCode ?? key, pack: values?.packVariant, stock, timeline, status, reasons };
    });
  }, [snapshot, timelines]);
  const counts = { ready: 0, review: 0, missing: 0 };
  products.forEach(p => counts[p.status]++);
  const query = search.trim().replace(/^sku\s*:?\s*/i, "").toLowerCase();
  const categories = FOOD_CATEGORIES.filter(item => products.some(product => product.category === item));
  const inCategory = (product: (typeof products)[number]) => category === "All foods" || product.category === category;
  const attention = products.filter(p => p.status !== "ready" && inCategory(p) && `${p.name} ${p.code} ${p.pack ?? ""}`.toLowerCase().includes(query)).sort((a,b) =>
    sort === "name" ? a.name.localeCompare(b.name) : sort === "status" ? a.status.localeCompare(b.status) : (b.stock?.freshness.ageDays ?? -1) - (a.stock?.freshness.ageDays ?? -1));
  const ready = products.filter(p => p.status === "ready" && inCategory(p));
  return <>
    <p className="validity validity--top"><i aria-hidden="true">✓</i>{t(`Calculations use ${snapshot.reconciliation.rowsUsed.toLocaleString("en")} valid rows only.`)} {snapshot.reconciliation.rowsExcluded} {t("Rows left out")}</p>
    <section className="summary" aria-label={t("Product readiness summary")}>
      <div className="summary__verdict"><span className={`summary__tick${counts.missing > 0 ? " summary__tick--warning" : ""}`} aria-hidden="true">{counts.missing > 0 ? "!" : "✓"}</span><div>
        <h2>{t(products.length === 0 ? "No products can be assessed" : counts.missing > 0 ? "Some products need more data" : counts.review > 0 ? "Your data is mostly ready" : "Your data is ready")}</h2>
        <p>{products.length} {t("products checked")}</p></div></div>
      <ul className="summary__groups">{(["ready", "review", "missing"] as const).map(status => <li className={`summary__group summary__group--${status}`} key={status}>
        <b>{counts[status]}</b><span className="summary__name">{t(LABELS[status])}</span><span className="summary__note">{t(status === "ready" ? "Complete data, no major issues" : status === "review" ? "Usable evidence with issues to review" : "Stock or sales evidence is incomplete")}</span>
      </li>)}</ul>
    </section>
    <p className="nextstep"><b>{t("Next step:")}</b> {t("Continue with the usable rows, or download the problem list and correct your file first.")}</p>
    <nav className="food-tabs" aria-label={t("Food categories")}>
      {["All foods", ...categories].map(item => <button type="button" key={item} className={category === item ? "food-tabs__active" : ""} aria-pressed={category === item} onClick={() => setCategory(item)}>{t(item)} <span>{item === "All foods" ? products.length : products.filter(product => product.category === item).length}</span></button>)}
    </nav>
    {counts.review + counts.missing > 0 && <section className="attention">
      <div className="attention__head">
        <div className="attention__heading"><span className="attention__icon" aria-hidden="true">!</span><div><h2>{attention.length} {t("products need your attention")}</h2><p>{t("Review data issues and stock age before continuing.")}</p></div></div>
        <div className="attention__filters">
          <label className="attention__search"><input type="search" aria-label={t("Search by product name or code")} placeholder={t("Search by product name or code")} value={search} onChange={e => setSearch(e.target.value)} /></label>
          <label className="attention__sort"><select aria-label={t("Sort products")} value={sort} onChange={e => setSort(e.target.value)}><option value="age">{t("Sort by: stock age (oldest)")}</option><option value="name">{t("Sort by: product name")}</option><option value="status">{t("Sort by: issue type")}</option></select></label>
        </div>
      </div>
      <div className="pcards">{attention.map(p => <article className={`pcard pcard--${p.status}`} key={p.key}>
        <header className="pcard__head"><div><b className="pcard__name">{p.name}</b><span className="pcard__code">SKU: {p.code}{p.pack ? ` · ${p.pack}` : ""}</span></div><span className={`pill ${p.status === "missing" ? "pill--red" : "pill--amber"}`}>{t(LABELS[p.status])}</span></header>
        <div className="pcard__facts"><div><span className="pcard__key">{t("Last stock count")}</span><b>{p.stock?.stockAsOfDate ?? "—"}</b></div><div><span className="pcard__key">{t("Stock age")}</span><b>{p.stock?.freshness.ageDays === undefined ? "—" : t(`${p.stock.freshness.ageDays} days`)}</b></div></div>
        <WeeklySales timeline={p.timeline} />
        <p className={`pcard__why pcard__why--${p.status}`}><span aria-hidden="true">i</span><span>{t(p.reasons[0] ?? "Review the available evidence before planning.")}</span></p>
        <details className="pcard__details"><summary className="btn btn--small btn--ghost pcard__action">{t("View details →")}</summary><p>{t("Product")}: {p.name} · {p.code}</p>{p.reasons.map(reason => <p key={reason}>{t(reason)}</p>)}<p>{t("Correct your file and upload again where needed. Original cells remain unchanged.")}</p></details>
      </article>)}</div>
      {attention.length === 0 && <p className="empty" role="status">{t("No matching products.")}</p>}
    </section>}
    {ready.length > 0 && <details className="readylist" open><summary><span className="readylist__tick" aria-hidden="true">✓</span><span><b>{ready.length} {t(ready.length === 1 ? "product is ready" : "products are ready")}</b><span className="readylist__note">{t("Complete data, no major issues")}</span></span></summary>
      <div className="table-scroll"><table className="dtable dtable--ready"><thead><tr><th>{t("Product")}</th><th>{t("Last stock count")}</th><th>{t("Stock age")}</th><th>{t("Weekly sales")}</th><th>{t("Status")}</th></tr></thead><tbody>{ready.map(p => <tr key={p.key}><td><b>{p.name}</b><span className="cell-detail num">{p.code}{p.pack ? ` · ${p.pack}` : ""}</span></td><td>{p.stock?.stockAsOfDate ?? "—"}</td><td>{t(`${p.stock?.freshness.ageDays} days`)}</td><td><WeeklySales timeline={p.timeline} /></td><td><span className="pill pill--confirmed">{t("Ready")}</span></td></tr>)}</tbody></table></div>
    </details>}
  </>;
}
