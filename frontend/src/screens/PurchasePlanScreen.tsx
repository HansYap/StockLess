import { useEffect, useMemo, useRef, useState } from "react";
import { t, useLanguage } from "../i18n/index.ts";
import { ProductLabelList } from "../components/ProductLabelList.tsx";
import { summarizePurchaseExcess, estimatePurchaseCost, type PlanningContexts, type ProductPlanningContext } from "../engine.ts";
import { evaluateProductPurchasePlan, type DemandForecastReview, type ReadinessSnapshot, type ProductPurchaseInputs, type ExpiryCheckInput, type ProductPurchasePlan, type SupplierOrderTerms } from "../engine.ts";
import { evaluatePurchaseProduct, joinPurchaseEvidence, purchaseGroup, purchaseGroupLabels, type PurchaseDrafts, type PurchaseEvaluator, type PurchaseProduct, type PurchaseGroup } from "../purchase-plan/model.ts";
import { ProductPurchasePanel } from "../purchase-plan/ProductPurchasePanel.tsx";
import { automaticPurchaseDrafts, prepareSuggestedOrders, type SuggestedOrderReview } from "../purchase-plan/suggested-orders.ts";
import { SuggestedOrdersReview } from "../purchase-plan/SuggestedOrdersReview.tsx";

import type { ImpactSection } from './ImpactDashboard.tsx';
import { purchaseDate } from "../purchase-plan/PurchaseDemandChart.tsx";
import { numberText } from "../purchase-plan/SourceTag.tsx";
import { purchasePlanFilename, serializePurchasePlanCsv } from "../purchase-plan/purchase-plan-export.ts";
import "../purchase-plan/purchase-plan.css";
import { GrowthIcon } from "../components/GrowthIcon.tsx";

export type SupplierDrafts = Readonly<Record<string, SupplierOrderTerms | undefined>>;
export interface PurchasePlanView { snapshotId: string; query: string; group: PurchaseGroup | 'all'; positiveOnly: boolean; financialSort: boolean; expanded: boolean }
interface Props {
  contexts?: PlanningContexts; datasetId?: string; onContextChange?: (key:string, value:ProductPlanningContext)=>void;
  onContextsChange?: (updates: PlanningContexts) => void;
  snapshot: ReadinessSnapshot; forecast: DemandForecastReview; drafts: PurchaseDrafts;
  selectedKey: string | null; onSelect: (key: string | null) => void;
  initialView?: PurchasePlanView; onViewChange?: (view: PurchasePlanView) => void;
  detailsFocus?: { productKey: string; revision: number };
  onDraftChange: (key: string, inputs: ProductPurchaseInputs) => void; onBack: () => void; onImpact?: (section?: ImpactSection) => void;
  onDraftsChange?: (updates: PurchaseDrafts) => void;
  onReviewProduct?: (key: string) => void;
  evaluatePurchase?: PurchaseEvaluator; expiryByProduct?: Readonly<Record<string, ExpiryCheckInput | undefined>>;
  supplierDrafts?: SupplierDrafts; onSupplierChange?: (key: string, terms: SupplierOrderTerms) => void;
}
interface PlanCacheEntry {
  product: PurchaseProduct; inputs: ProductPurchaseInputs; expiry: ExpiryCheckInput;
  evaluator: PurchaseEvaluator; analysisDate: string; result: ProductPurchasePlan | undefined;
}
const groups: readonly { id: PurchaseGroup; label: string; help: string; icon: string }[] = [
  { id: "order_needed", label: "Order needed", help: "Below expected demand", icon: "🛒" },
  { id: "check_order", label: "Check your order", help: "More than the busiest month", icon: "⚠" },
  { id: "balanced", label: "Looks balanced", help: "Within expected demand", icon: "✓" },
  { id: "need_data", label: "Need more data", help: "Can't be judged yet", icon: "×" },
];
const sk = { fill: "none", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
function DrawnPlanIcon({ group }: { group: PurchaseGroup }) {
  if (group === "order_needed") return <svg viewBox="0 0 64 64" width="48" height="48" aria-hidden="true">
    <path d="M8 30c-2-14 10-24 25-23 15 1 25 9 24 23-1 15-12 27-27 26C15 55 10 44 8 30z" fill="#E8F3F0" />
    <g {...sk} stroke="#11655E"><path d="M15 27.5c11-.6 23-.3 34.4.2" /><path d="M17.2 28.3c1.1 6.4 2.1 12.5 3.4 18.6.4 1.6 1.4 2.4 3 2.4 5.6.2 11.3.1 17-.2 1.6-.1 2.5-.9 2.9-2.4 1.4-6 2.6-12.1 3.6-18.1" /><path d="M24.3 27.6c1.6-5.2 3.6-9.5 6.1-13.1" /><path d="M40.1 27.9c-1.2-5-3.3-9.4-6-13.2" /><path d="M27 34.8c.3 3.5.5 6.9.6 10.2" /><path d="M37.1 34.6c-.2 3.6-.5 7-.9 10.3" /></g>
    <circle cx="49" cy="17" r="8.5" fill="#167D74" /><path d="M49 12.6c.1 2.9.1 5.9-.1 8.8M44.7 17.1c2.9-.2 5.8-.1 8.7.1" {...sk} stroke="#fff" />
  </svg>;
  if (group === "check_order") return <svg viewBox="0 0 64 64" width="48" height="48" aria-hidden="true">
    <path d="M10 32C9 18 19 8 33 8c14 .5 23 10 23 24 0 13-10 24-24 24C18 56 11 45 10 32z" fill="#FFF4DF" />
    <g {...sk} stroke="#8B5C10"><path d="M19.4 16.3c-.6 9.6-.7 19.5-.3 29.4.1 1.3.9 2 2.2 2.1 4.6.2 9.3.2 13.9 0" /><path d="M19.7 16.1c6.4-.4 12.8-.4 19.2 0 1.2.1 1.9.8 2 2.1.2 2.8.2 5.4.1 8" /><path d="M25.3 13.4c3-.3 6.3-.3 9.4.1.3 1.5.3 3-.1 4.4-3 .3-6 .3-9.2 0-.4-1.5-.4-3 .1-4.5z" /><path d="M24.3 25.4c3.3-.2 6.6-.1 9.8.1" /><path d="M24.1 31.6c2.1-.1 4.2 0 6.2.1" /><path d="M42.9 32.2c3.8.2 6.6 3.4 6.4 7.2-.3 3.8-3.5 6.5-7.3 6.3-3.7-.3-6.4-3.4-6.2-7.2.2-3.8 3.3-6.5 7.1-6.3z" /><path d="M47.6 44.7c1.9 1.9 3.7 3.8 5.4 5.8" /></g>
    <path d="M42.6 35.4c.1 1.3.1 2.5 0 3.7" {...sk} stroke="#D99120" /><circle cx="42.6" cy="42" r="1.4" fill="#D99120" />
  </svg>;
  if (group === "balanced") return <svg viewBox="0 0 64 64" width="48" height="48" aria-hidden="true">
    <path d="M9 33C7 19 18 9 32 9c15 0 24 10 23 24-1 14-11 23-25 22C17 54 10 46 9 33z" fill="#E8F3F0" />
    <g {...sk} stroke="#11655E"><path d="M32.2 15.2c-.3 10.6-.2 21.1.2 31.6" /><path d="M24.6 47.4c5-.4 10.1-.4 15.1.1" /><path d="M15.9 21.9c10.8-.9 21.6-.9 32.4 0" /><path d="M17.6 22.4c-2.2 4.4-4.2 8.8-5.9 13.3" /><path d="M18.2 22.3c2.1 4.5 4 9 5.6 13.6" /><path d="M11.4 35.9c3.9 3.4 8.5 3.4 12.6-.1" /><path d="M46.4 22.3c-2.3 4.4-4.3 8.9-5.9 13.4" /><path d="M46.9 22.4c2 4.5 3.9 9 5.6 13.5" /><path d="M40.2 35.8c4 3.5 8.6 3.5 12.6.1" /></g>
    <path d="M28.6 13.5c1.2-1.4 2.6-2 3.9-2 1.4.1 2.6.8 3.6 2.1" {...sk} stroke="#167D74" />
  </svg>;
  return <svg viewBox="0 0 64 64" width="48" height="48" aria-hidden="true">
    <path d="M9 31c0-14 10-23 24-23 14 1 23 11 22 25-1 13-11 22-24 22C17 55 9 45 9 31z" fill="#EEF1F2" />
    <g {...sk} stroke="#4D5E64"><path d="M20.3 14.6c-.4 11.5-.3 23.1.2 34.6" /><path d="M20.4 14.7c7.4-.6 14.9-.6 22.3.1 1.1.1 1.7.8 1.8 1.9.4 10.3.4 20.7-.1 31-.1 1.1-.7 1.7-1.8 1.8-7.3.4-14.7.4-22 0" /><path d="M15.8 21.4c1.6 0 3.1 0 4.6.1" /><path d="M15.7 31.6c1.6-.1 3.1 0 4.7 0" /><path d="M15.9 41.8c1.5 0 3 0 4.5.1" /><path d="M28.3 26.9c.4-3.1 2.8-5 5.6-4.8 2.9.2 4.9 2.4 4.6 5.2-.3 2.4-2.4 3.3-4 4.5-.9.7-1.1 1.5-1.1 3" /></g>
    <circle cx="33.4" cy="40.6" r="1.6" fill="#4D5E64" /><path d="M50 44c.6-1.6 1.2-3.1 1.7-4.7M54.6 47.9c1.5-.4 3-.8 4.6-1.2M47.1 50.5c.2 1.6.4 3.1.5 4.7" fill="none" stroke="#86949A" strokeWidth={2} strokeLinecap="round" />
  </svg>;
}
const rank: Record<PurchaseGroup, number> = { check_order: 0, order_needed: 1, balanced: 2, need_data: 3 };

export function PurchasePlanScreen({ snapshot, forecast, drafts: enteredDrafts, selectedKey, onSelect, initialView, onViewChange, detailsFocus, onDraftChange, onDraftsChange, onBack, onImpact, onReviewProduct, evaluatePurchase = evaluateProductPurchasePlan, expiryByProduct, supplierDrafts, onSupplierChange, contexts, datasetId, onContextChange, onContextsChange }: Props) {
  const language = useLanguage(), copy = (en:string,zh:string,ms:string) => language === "zh" ? zh : language === "ms" ? ms : en;
  const restoredView = initialView?.snapshotId === snapshot.id ? initialView : undefined;
  const [query, setQuery] = useState(restoredView?.query ?? "");
  const [group, setGroup] = useState<PurchaseGroup | "all">(restoredView?.group ?? "all");
  const [positiveOnly, setPositiveOnly] = useState(restoredView?.positiveOnly ?? false);
  const [financialSort, setFinancialSort] = useState(restoredView?.financialSort ?? false);
  const [expanded, setExpanded] = useState(restoredView?.expanded ?? false);
  useEffect(() => { onViewChange?.({ snapshotId:snapshot.id,query,group,positiveOnly,financialSort,expanded }); }, [snapshot.id,query,group,positiveOnly,financialSort,expanded,onViewChange]);
  const detailColumn = useRef<HTMLElement>(null);
  const prepareButton = useRef<HTMLButtonElement>(null);
  const [compactHero, setCompactHero] = useState(false);
  useEffect(() => {
    let compact = false;
    const onScroll = () => {
      if (document.querySelector(".onboarding-coach")) return;
      if (!compact && window.scrollY > 140) { compact = true; setCompactHero(true); }
      else if (compact && window.scrollY < 40) { compact = false; setCompactHero(false); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [localTerms, setLocalTerms] = useState<SupplierDrafts>({});
  const terms = supplierDrafts ?? localTerms;
  const products = useMemo(() => joinPurchaseEvidence(snapshot, forecast, contexts), [snapshot, forecast, contexts]);
  const automatic = useMemo(() => automaticPurchaseDrafts(products, enteredDrafts, terms, snapshot.analysisDate, evaluatePurchase, expiryByProduct), [products, enteredDrafts, terms, snapshot.analysisDate, evaluatePurchase, expiryByProduct]);
  const drafts = automatic.drafts;
  const planCache = useRef(new Map<string, PlanCacheEntry>());
  const plans = useMemo(() => {
    const nextCache = new Map<string, PlanCacheEntry>(), nextPlans = new Map<string, ProductPurchasePlan | undefined>();
    for (const product of products) {
      const inputs = drafts[product.key] ?? product.fileInputs, expiry = expiryByProduct?.[product.key] ?? product.fileExpiry;
      const cached = planCache.current.get(product.key);
      const result = cached && cached.product === product && cached.inputs === inputs && cached.expiry === expiry && cached.evaluator === evaluatePurchase && cached.analysisDate === snapshot.analysisDate
        ? cached.result : evaluatePurchaseProduct(product, snapshot.analysisDate, inputs, evaluatePurchase, expiry);
      nextPlans.set(product.key, result);
      nextCache.set(product.key, { product, inputs, expiry, evaluator: evaluatePurchase, analysisDate: snapshot.analysisDate, result });
    }
    planCache.current = nextCache;
    return nextPlans;
  }, [products, snapshot.analysisDate, drafts, evaluatePurchase, expiryByProduct]);
  const [suggestionReview, setSuggestionReview] = useState<{ data: SuggestedOrderReview; products: typeof products; plans: typeof plans; terms: SupplierDrafts; datasetId: typeof datasetId } | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);
  const prepareOrders = () => {
    setAppliedCount(0);
    setSuggestionReview({ data: prepareSuggestedOrders(products, plans, enteredDrafts, terms, snapshot.analysisDate, evaluatePurchase, expiryByProduct), products, plans, terms, datasetId });
  };
  const reviewStale = !!suggestionReview && (suggestionReview.products !== products || suggestionReview.plans !== plans || suggestionReview.terms !== terms || suggestionReview.datasetId !== datasetId);
  const closeSuggestionReview = () => {
    setSuggestionReview(null);
    window.requestAnimationFrame(() => prepareButton.current?.focus());
  };
  const applySuggestions = (updates: PurchaseDrafts) => {
    if (reviewStale || !onDraftsChange) return;
    onDraftsChange(updates);
    setAppliedCount(Object.keys(updates).length); closeSuggestionReview();
  };
  const inputsFor = (product: PurchaseProduct) => drafts[product.key] ?? product.fileInputs;
  const financialRisk = (key:string) => { const p = plans.get(key); const q = p?.audit.state === 'verdict' ? Math.max(0, p.audit.figures.availableAfterOrder.value - p.audit.figures.demandHigh.value) : undefined; const cost = estimatePurchaseCost(snapshot,key,q); return cost.state === 'estimated' ? cost.amount : -1; };
  const sorted = useMemo(() => [...products].sort((a, b) => (financialSort ? financialRisk(b.key) - financialRisk(a.key) : rank[purchaseGroup(plans.get(a.key))] - rank[purchaseGroup(plans.get(b.key))]) || (a.sku ?? a.key).localeCompare(b.sku ?? b.key)), [products, plans, financialSort]);
  const filtered = (search: string, selectedGroup: PurchaseGroup | "all") => {
    const term = search.trim().replace(/^sku\s*:?\s*/i, "").toLocaleLowerCase();
    return sorted.filter(product => (!positiveOnly || (inputsFor(product).plannedOrder.state === "value" && (inputsFor(product).plannedOrder as {value:number}).value > 0)) && [product.title, product.pack, product.name, product.sku, ...(product.labels?.names ?? []), ...(product.labels?.codes ?? []), ...(product.labels?.packs ?? [])].join(" ").toLocaleLowerCase().includes(term) && (selectedGroup === "all" || purchaseGroup(plans.get(product.key)) === selectedGroup));
  };
  const visible = filtered(query, group), shown = expanded ? visible : visible.slice(0, 12);
  const firstWithoutCost = financialSort ? shown.findIndex(product => financialRisk(product.key) < 0) : -1;
  const withoutCostCount = financialSort ? visible.filter(product => financialRisk(product.key) < 0).length : 0;
  const selected = products.find(product => product.key === selectedKey) ?? (selectedKey === null ? visible[0] : undefined), selectedIndex = visible.findIndex(product => product.key === selected?.key);
  useEffect(() => { if (selectedKey === null && visible.length) onSelect(visible[0].key); }, [selectedKey, visible.length, snapshot.id, onSelect]);
  const firstSelectedSnapshot = useRef<string | null>(null);
  useEffect(() => {
    if (firstSelectedSnapshot.current === snapshot.id) return;
    const restore = firstSelectedSnapshot.current === null && initialView?.snapshotId === snapshot.id;
    firstSelectedSnapshot.current = snapshot.id;
    if (!restore) { setQuery(""); setGroup("all"); setPositiveOnly(false); setFinancialSort(false); setExpanded(false); }
    setLocalTerms({}); setSuggestionReview(null); setAppliedCount(0);
    if (!selectedKey || !products.some(product => product.key === selectedKey)) onSelect(sorted[0]?.key ?? null);
  }, [snapshot.id, products, sorted, selectedKey, onSelect]);
  const changeFilter = (search: string, selectedGroup: PurchaseGroup | "all") => {
    setQuery(search); setGroup(selectedGroup); setExpanded(false);
    const next = filtered(search, selectedGroup);
    if (!next.some(product => product.key === selectedKey)) onSelect(next[0]?.key ?? null);
  };
  const select = (key: string) => {
    onSelect(key);
    if (visible.findIndex(product => product.key === key) >= 12) setExpanded(true);
  };
  const next = () => { const product = visible[(Math.max(-1, selectedIndex) + 1) % visible.length]; if (product) select(product.key); };
  const done = () => {
    next();
    detailColumn.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };
  const counts = Object.fromEntries(groups.map(item => [item.id, products.filter(product => purchaseGroup(plans.get(product.key)) === item.id).length]));
  const excessSummary = summarizePurchaseExcess(products.map(product => ({ inputs: inputsFor(product), plan: plans.get(product.key) })));
  const mismatchCount = products.filter(product => product.issueKind === "evidence").length;
  function download() {
    const rows = [
      ["Source file", snapshot.sourceName], ["Analysis date", snapshot.analysisDate],
      ["Product code", "Product", "Pack", "Data label", "Expected low (4 weeks)", "Expected high (4 weeks)", "In stock", "Stock count date", "Incoming", "Incoming source", "Your order", "Order source", "Suggested", "Check", "Case size", "Minimum order", "Lead time (days)"],
      ...products.map(product => {
        const plan = plans.get(product.key), input = inputsFor(product), supplier = terms[product.key];
        const range = !product.issue && product.demand?.label !== "Cannot assess" ? product.demand?.range : undefined;
        return [product.sku ?? "", product.title, product.pack ?? "", product.issue ?? product.demand?.label ?? "", range?.low ?? "", range?.high ?? "", product.stock?.currentStock ?? "", product.stock?.stockAsOfDate ?? "",
          input.incomingStock.state === "value" ? input.incomingStock.value : "", input.incomingStock.state === "value" ? input.incomingStock.source : "", input.plannedOrder.state === "value" ? input.plannedOrder.value : "", input.plannedOrder.state === "value" ? input.plannedOrder.source : "",
          plan?.estimatedRestock.state === "available" ? plan.estimatedRestock.quantity.value : "", input.plannedOrder.state === "empty" ? "No plan entered" : plan?.audit.state === "verdict" ? plan.audit.verdict : plan?.audit.state === "cannot_judge" ? plan.audit.label : product.issue ?? "", supplier?.caseSize ?? "", supplier?.minimumOrder ?? "", supplier?.leadTimeDays ?? ""];
      }),
    ];
    const url = URL.createObjectURL(new Blob([serializePurchasePlanCsv(rows, snapshot.sourceMode)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = purchasePlanFilename(snapshot.sourceMode); link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return <main className="purchase-plan purchase-plan--new">
    <section className={`pp-hero${compactHero ? " is-compact" : ""}`}><div className="pp-wrap pp-hero-box"><div className="pp-hero-main"><div><p className="pp-kicker"><GrowthIcon stage="tree" size={16} className="growth-icon--inline" /> {t("Purchase plan")}</p><h1>{t("Plan your next order")}</h1><p className="pp-hero-lede">{t(`For the next 4 weeks from ${purchaseDate(snapshot.analysisDate, true)}.`)} {t("Start from our estimate, type what you plan to buy, and we'll check it against expected demand.")}</p></div>
      <button type="button" className="pp-excess" disabled={!onImpact} onClick={()=>onImpact?.()}><span className="pp-icon pp-icon--amber" aria-hidden="true">▣</span><span><small>{t("Possible excess stock")}</small><b className="num">{excessSummary.state === "assessed" ? `${numberText(excessSummary.quantity)} ${t("units")}` : t(excessSummary.state === "not_entered" ? "Not entered" : "Unavailable")}</b>{excessSummary.state === "assessed" ? <><small>{t("Assessed orders")}: {excessSummary.assessedCount} · {t("Orders with excess")}: {excessSummary.excessOrderCount}</small>{excessSummary.excludedCount > 0 && <small>{t("Unassessable orders excluded")}: {excessSummary.excludedCount}</small>}</> : <small>{t(excessSummary.reason)} {t(excessSummary.correctiveAction)}</small>}</span><span className="pp-excess-go">{t("See impact →")}</span></button>
    </div><div className="pp-hero-actions" data-guide="purchase-next"><button type="button" className="pp-back" onClick={onBack}>{t("← Back to readiness")}</button><span className="pp-action-spacer" /><button type="button" className="btn btn--ghost" onClick={download}>{copy("↓ Download draft plan", "↓ 下载草稿计划", "↓ Muat turun pelan draf")}</button><button type="button" className="btn btn--primary" disabled={!onImpact} onClick={()=>onImpact?.()}>{t("See your impact →")}</button></div></div></section>
    <div className="pp-wrap pp-main">
      {mismatchCount > 0 && <p className="notice notice--error" role="alert">{t(`Evidence mismatch affects ${mismatchCount} products. Return to readiness and refresh the forecast.`)}</p>}
      <div className="pp-kpis" role="group" aria-label={t("Filter by what each product needs")}>{groups.map(item => <button key={item.id} type="button" className={`pp-kpi pp-kpi--${item.id}`} aria-pressed={group === item.id} onClick={() => changeFilter(query, group === item.id ? "all" : item.id)}><span className="pp-icon pp-icon--drawn" aria-hidden="true"><DrawnPlanIcon group={item.id} /></span><span><b className="pp-kpi-number num">{counts[item.id]}</b> <b>{t(item.label)}</b><small>{t(item.help)}</small></span></button>)}</div>
      {onDraftsChange && <div className="pp-prepare"><button ref={prepareButton} type="button" className="btn btn--primary" onClick={prepareOrders}>{copy("Review suggested orders", "查看建议订单", "Semak cadangan pesanan")}</button><p>{copy("Suggested drafts are already shown. Review together to save the quantities you choose.", "建议草稿已显示。一起查看并保存您选定的数量。", "Draf cadangan sudah dipaparkan. Semak bersama untuk menyimpan kuantiti pilihan anda.")}</p></div>}
      {appliedCount > 0 && <p className="pp-bulk-status" role="status">{copy(`${appliedCount} draft ${appliedCount === 1 ? "order" : "orders"} updated. You can still edit each quantity.`, `已更新 ${appliedCount} 个草稿订单。每项数量仍可修改。`, `${appliedCount} pesanan draf dikemas kini. Anda masih boleh mengedit setiap kuantiti.`)}</p>}
      <div className="cp3-actions"><label><input type="checkbox" checked={positiveOnly} onChange={e=>setPositiveOnly(e.target.checked)} /> {t("Only products I am ordering")}</label><label><input type="checkbox" checked={financialSort} onChange={e=>setFinancialSort(e.target.checked)} /> {t("Sort by estimated financial risk")}</label></div>
      <div className="pp-layout"><aside className="pp-detail-column" ref={detailColumn}>{selected ? <ProductPurchasePanel onImpact={onImpact ? () => onImpact() : undefined} detailsFocus={detailsFocus} datasetId={datasetId} onPlanningChange={onContextChange ? value => onContextChange(selected.key, value) : undefined} key={selected.key} product={selected} plan={plans.get(selected.key)} inputs={inputsFor(selected)} analysisDate={snapshot.analysisDate} terms={terms[selected.key] ?? {}} onTermsChange={nextTerms => onSupplierChange ? onSupplierChange(selected.key, nextTerms) : setLocalTerms(previous => ({ ...previous, [selected.key]: nextTerms }))} onChange={inputs => onDraftChange(selected.key, inputs)} onReviewData={onReviewProduct ? () => onReviewProduct(selected.key) : onBack} position={selectedIndex >= 0 ? selectedIndex : undefined} total={visible.length} onPrevious={selectedIndex > 0 ? () => select(visible[selectedIndex - 1].key) : undefined} onNext={visible.length > 1 ? next : undefined} onDone={done} /> : <section className="pp-detail pp-empty" data-guide="purchase-empty"><h2>{t("Purchase details")}</h2><p>{t(visible.length ? "Select a product to enter quantities and review its evidence." : "No products match.")}</p></section>}
        <div className="pp-privacy"><span className="pp-icon" aria-hidden="true">✓</span><div><b>{t("Your data stays on your device")}</b><p>{t("Quantities are never sent to a supplier.")}</p><small>{snapshot.sourceName} · {t(snapshot.sourceMode === "sample" ? "Sample data" : "Retailer file")}</small></div></div>
      </aside><section className="pp-list" aria-label={t("Products to review")}><div className="pp-list-toolbar" data-guide="purchase-products"><label className="pp-search"><span aria-hidden="true">⌕</span><input type="search" aria-label={t("Search name or code")} placeholder={t("Search name or code")} value={query} onChange={event => changeFilter(event.currentTarget.value, group)} /></label>{group !== "all" && <><span className="pp-filter-chip">{t(groups.find(item => item.id === group)!.label)} · {counts[group]}</span><button type="button" className="pp-link-button" onClick={() => changeFilter(query, "all")}>{t("Clear")}</button></>}</div>
        <div className="pp-table-wrap"><table className="pp-table"><thead><tr>{["Product", "Expected, 4 weeks", "In stock", "Your order", "Check"].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>{shown.flatMap((product, index) => {
          const plan = plans.get(product.key), input = inputsFor(product), kind = purchaseGroup(plan);
          const range = !product.issue && product.demand?.label !== "Cannot assess" ? product.demand?.range : undefined;
          const expiry = plan?.expiry && "earliestDate" in plan.expiry ? plan.expiry.earliestDate : undefined;
          return [...(index === firstWithoutCost ? [<tr key="without-cost" className="pp-cost-divider"><td colSpan={5}>{t("No usable excess-stock cost: no validated unit cost, or no checked planned order. Listed last.")} ({withoutCostCount})</td></tr>] : []), <tr key={product.key} className={selectedKey === product.key ? "is-selected" : ""} onClick={() => select(product.key)}><td><button type="button" className="pp-product-button" aria-label={t(`Open purchase plan for ${[product.title, product.pack].filter(Boolean).join(" · ")}, SKU ${product.sku || product.key}`)} aria-current={selectedKey === product.key ? "true" : undefined} onClick={event => { event.stopPropagation(); select(product.key); }}><b>{product.title}</b><small>{product.sku || t("Not available")}{product.pack ? ` · ${product.pack}` : ""}</small></button><ProductLabelList labels={product.labels} shown={[product.title, product.sku, product.pack]} />{expiry && <small className="pp-row-expiry">◷ {t("Batch expires")} {purchaseDate(expiry)}</small>}</td><td className="num" data-label={t("Expected, 4 weeks")}>{range ? `${numberText(range.low)}–${numberText(range.high)}` : "—"}</td><td className="num" data-label={t("In stock")}>{product.stock?.currentStock === undefined ? "—" : numberText(product.stock.currentStock)}</td><td data-label={t("Your order")}><b className="num">{input.plannedOrder.state === "value" ? numberText(input.plannedOrder.value) : "—"}</b>{kind !== "balanced" && plan?.estimatedRestock.state === "available" && <small className="pp-row-suggestion">{t(`Suggested ${numberText(plan.estimatedRestock.quantity.value)}`)}</small>}</td><td><span className={`pp-pill pp-pill--${kind}`}>{t(purchaseGroupLabels[kind])}</span></td></tr>];
        })}</tbody></table></div>
        {visible.length === 0 && <p className="pp-list-none">{t("No results.")}</p>}{visible.length > 12 && <button type="button" className="pp-list-more" onClick={() => setExpanded(!expanded)}>{t(expanded ? "Show fewer" : `Show all ${visible.length} products`)}</button>}
        <p className="pp-list-count" role="status">{t(`Showing ${shown.length} of ${visible.length} matching products.`)} {t("Counts above do not change when filtering.")}</p>
      </section></div>
    </div>
    {suggestionReview && <SuggestedOrdersReview review={suggestionReview.data} stale={reviewStale} onRefresh={prepareOrders} onClose={closeSuggestionReview} onApply={applySuggestions} onReviewProduct={key => { setSuggestionReview(null); setQuery(""); setGroup("all"); setPositiveOnly(false); setExpanded(true); onSelect(key); window.requestAnimationFrame(() => { detailColumn.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); detailColumn.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true }); }); }} />}
  </main>;
}
