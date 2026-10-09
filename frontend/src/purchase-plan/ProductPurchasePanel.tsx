import { useEffect, useRef, useState } from "react";
import { t, useLanguage } from "../i18n/index.ts";
import { ProductLabelList } from "../components/ProductLabelList.tsx";
import { PlanningInputsPanel } from "../components/PlanningInputsPanel.tsx";
import { DecisionOutcomeControls } from "../components/DecisionOutcomeControls.tsx";

import { addCalendarDays, applyPurchaseQuantityEdit, createPurchaseQuantity, estimatePurchaseCost, evaluateProductPurchasePlan, EPIC5_POLICY, suggestSupplierOrder, type ProductPurchaseInputs, type ProductPurchasePlan, type SupplierOrderTerms, type ProductPlanningContext } from "../engine.ts";
import { purchaseGroup, purchaseGroupLabels, type PurchaseProduct } from "./model.ts";
import { SourceTag, numberText, oneDecimalText } from "./SourceTag.tsx";
import { PurchaseDemandChart, purchaseDate, demandRangeText } from "./PurchaseDemandChart.tsx";
import { PurchaseStockChart } from "./PurchaseStockChart.tsx";

interface Props {
  product: PurchaseProduct; plan?: ProductPurchasePlan; inputs: ProductPurchaseInputs;
  analysisDate: string; terms: SupplierOrderTerms; onTermsChange: (terms: SupplierOrderTerms) => void;
  onChange: (inputs: ProductPurchaseInputs) => void; onReviewData: () => void;
  datasetId?: string; onPlanningChange?: (context: ProductPlanningContext) => void;
  decisionFocus?: { productKey: string; revision: number };
  detailsFocus?: { productKey: string; revision: number };
  onOutcomes?: () => void; onDownloads?: () => void;
  position?: number; total: number; onPrevious?: () => void; onNext?: () => void; onDone: () => void;
}

export function ProductPurchasePanel({ product, plan, inputs, analysisDate, terms, onTermsChange, onChange, onReviewData, datasetId, onPlanningChange, decisionFocus, detailsFocus, onOutcomes, onDownloads, position, total, onPrevious, onNext, onDone }: Props) {
  const language = useLanguage();
  const copy = (en:string,zh:string,ms:string) => language === "zh" ? zh : language === "ms" ? ms : en;
  const [showEvidence, setShowEvidence] = useState(true);
  const [extra, setExtra] = useState<"expiry" | "supplier" | null>(null);
  const [typed, setTyped] = useState<Partial<Record<keyof ProductPurchaseInputs, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof ProductPurchaseInputs, string>>>({});
  const [supplierRaw, setSupplierRaw] = useState<Partial<Record<keyof SupplierOrderTerms, string>>>({});
  const [supplierErrors, setSupplierErrors] = useState<Partial<Record<keyof SupplierOrderTerms, string>>>({});
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [detailsOpen,setDetailsOpen] = useState(false);
  const productDetails = useRef<HTMLDetailsElement>(null);
  useEffect(()=>{if(detailsFocus?.productKey === product.key){setDetailsOpen(true);requestAnimationFrame(()=>{productDetails.current?.scrollIntoView?.({behavior:"smooth",block:"start"});productDetails.current?.querySelector("summary")?.focus({preventScroll:true});});}},[detailsFocus,product.key]);
  const decision = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (decisionFocus?.productKey === product.key) { setDecisionOpen(true); requestAnimationFrame(() => { decision.current?.scrollIntoView?.({behavior:'smooth',block:'start'}); decision.current?.querySelector('summary')?.focus({preventScroll:true}); }); } }, [decisionFocus, product.key]);
  // A reviewed bulk change must also replace any local text for the old order.
  useEffect(() => {
    setTyped(previous => {
      if (previous.plannedOrder === undefined) return previous;
      const edit = applyPurchaseQuantityEdit(inputs.plannedOrder, previous.plannedOrder);
      const matches = edit.accepted && edit.field.state === inputs.plannedOrder.state && (edit.field.state !== "value" || (inputs.plannedOrder.state === "value" && edit.field.value === inputs.plannedOrder.value));
      return matches ? previous : { ...previous, plannedOrder: undefined };
    });
    setErrors(previous => previous.plannedOrder ? { ...previous, plannedOrder: undefined } : previous);
  }, [inputs.plannedOrder]);
  const value = (field: keyof ProductPurchaseInputs) => inputs[field].state === "value" ? inputs[field].value : 0;
  const update = (field: keyof ProductPurchaseInputs, raw: string) => {
    const result = applyPurchaseQuantityEdit(inputs[field], raw);
    setTyped(previous => ({ ...previous, [field]: raw }));
    setErrors(previous => ({ ...previous, [field]: result.accepted ? undefined : result.message }));
    if (result.accepted) onChange({ ...inputs, [field]: result.field });
  };
  const adopt = (quantity: number) => {
    setTyped(previous => ({ ...previous, plannedOrder: String(quantity) }));
    setErrors(previous => ({ ...previous, plannedOrder: undefined }));
    onChange({ ...inputs, plannedOrder: createPurchaseQuantity(quantity, "input by you") });
  };
  const range = !product.issue && product.demand?.label !== "Cannot assess" ? product.demand?.range : undefined;
  const initialMaximum = useRef(Math.max(50, (range?.high ?? 0) * 2, value("plannedOrder"), value("incomingStock"))).current;
  const sliderMaximum = Math.min(EPIC5_POLICY.maximumQuantity, Math.max(initialMaximum, value("plannedOrder")));
  const group = purchaseGroup(plan), restock = plan?.estimatedRestock, audit = plan?.audit, stock = product.stock;
  const plannable = range && restock?.state === "available" && !product.issue;
  const invalidQuantity = Object.values(errors).some(Boolean);
  const spending = product.readinessSnapshot ? estimatePurchaseCost(product.readinessSnapshot, product.key, inputs.plannedOrder.state === "value" ? inputs.plannedOrder.value : undefined) : undefined;
  const supplier = suggestSupplierOrder(restock, terms, analysisDate);
  const supplierInvalid = Object.values(supplierErrors).some(Boolean);
  const hasSupplierQuantity = terms.caseSize !== undefined || terms.minimumOrder !== undefined;
  const changeTerm = (field: keyof SupplierOrderTerms, raw: string) => {
    const minimum = field === "caseSize" ? 1 : 0, maximum = field === "leadTimeDays" ? 3650 : EPIC5_POLICY.maximumQuantity;
    const accepted = raw.trim() === "" || (/^\d+$/.test(raw.trim()) && Number(raw) >= minimum && Number(raw) <= maximum);
    setSupplierRaw(previous => ({ ...previous, [field]: raw }));
    setSupplierErrors(previous => ({ ...previous, [field]: accepted ? undefined : field === "leadTimeDays" ? "Enter whole days from 0 to 3650." : field === "caseSize" ? "Enter a whole case size from 1 to 999999." : "Enter a whole minimum order from 0 to 999999." }));
    if (accepted) onTermsChange({ ...terms, [field]: raw.trim() === "" ? undefined : Number(raw) });
  };
  const metric = (label: string, amount: string, note: string) => <div><small>{t(label)}</small><b className="num">{amount}</b><small>{t(note)}</small></div>;
  const preview = plannable && audit?.state === 'not_planned' ? evaluateProductPurchasePlan(product.demand!, { analysisDate, stock:product.stock, inputs, expiry:product.fileExpiry, previewEmptyOrder:true }) : undefined;
  const figures = audit?.state === "verdict" ? audit.figures : preview?.audit.state === 'verdict' ? preview.audit.figures : undefined;
  // Expiry changes the check only when dated batches were reconciled to the stock count (US5.5).
  const expiryUsed = plan?.expiryRisk?.state === "estimated";
  const reason = product.issue || (product.demand?.label === "Cannot assess" ? product.demand.labelReason?.message : restock?.state === "unavailable" ? restock.reason : product.demand?.labelReason?.message) || "Review the available evidence before planning.";
  return <section className="pp-detail" aria-labelledby="purchase-detail-title">
    <header className="pp-detail-head"><div><span className="pp-kicker">{position === undefined ? t("Selected product outside current filter") : t(`Product ${position + 1} of ${total}`)}</span><h2 id="purchase-detail-title" tabIndex={-1}>{product.title}</h2>
      <p className="pp-detail-sub">{product.sku || t("Not available")}{product.pack ? ` · ${product.pack}` : ""} · {t("Counted")} {stock?.stockAsOfDate ? purchaseDate(stock.stockAsOfDate) : "—"}{stock?.freshness.ageDays !== undefined ? ` · ${t(`${stock.freshness.ageDays} days old`)}` : ""}</p>
    </div><div className="pp-detail-nav"><span className={`pp-pill pp-pill--${group}`}>{t(purchaseGroupLabels[group])}</span><button type="button" onClick={onPrevious} disabled={!onPrevious} aria-label={t("Previous product")}>‹</button><button type="button" onClick={onNext} disabled={!onNext} aria-label={t("Next product")}>›</button></div></header>
    <ProductLabelList labels={product.labels} shown={[product.title, product.sku, product.pack]} />
    {plannable && <section className="pp-demand"><div className="pp-demand-head"><h3>{t("Demand and stock")}</h3><button type="button" className="pp-link-button" aria-expanded={showEvidence} aria-controls="purchase-demand-evidence" onClick={() => setShowEvidence(!showEvidence)}>{t(showEvidence ? "Hide evidence" : "Show evidence")}</button></div>
      {showEvidence && <div className="pp-demand-body" id="purchase-demand-evidence"><div className="pp-demand-main"><p className="pp-small-note">{t("Expected sales in the next 4 weeks")}</p><p className="pp-demand-range"><b>{demandRangeText(range.low, range.high)} {t("units")}</b><span>{purchaseDate(analysisDate)} – {purchaseDate(addCalendarDays(analysisDate, 27))}</span></p>
        <PurchaseDemandChart weeks={product.evidence?.timeline.weeks ?? []} range={range} name={product.title} analysisDate={analysisDate} />
        <p className="pp-small-note">{t(`Range based on ${range.basedOnWeekCount} weeks, from ${range.firstWeekUsed} to ${range.lastWeekUsed}.`)}</p>
        {product.demand?.labelReason?.message && <p className="pp-small-note">{t(product.demand.labelReason.message)}</p>}
      </div><div className="pp-facts">
        {metric("In stock", stock?.currentStock === undefined ? "—" : numberText(stock.currentStock), "from your file")}
        {metric("Recent weekly average", product.evidence?.recentAverage.value === undefined ? "—" : oneDecimalText(product.evidence.recentAverage.value), "worked out by StockLess")}
        {metric("Weeks of cover", product.evidence?.cover.value === undefined ? "—" : oneDecimalText(product.evidence.cover.value), "worked out by StockLess")}
        {metric("Stock counted", stock?.stockAsOfDate ? purchaseDate(stock.stockAsOfDate) : "—", stock?.freshness.ageDays === undefined ? "Not available" : `${stock.freshness.ageDays} days old`)}
      </div></div>}
    </section>}

    {!plannable ? <div className="pp-unavailable"><h3>{t("Unavailable")}</h3><p>{t(reason)}</p><p>{t(restock?.state === "unavailable" ? restock.correctiveAction : product.demand?.historyEvidence?.correctiveAction)}</p><button type="button" className="btn btn--ghost" onClick={onReviewData}>{t("Fix it in Step 3")}</button></div> : <>
      <div className="pp-two"><section className="pp-suggestion"><h3 className="pp-kicker">{t("Suggested order")}</h3><b className="pp-suggestion-number">{numberText(restock.quantity.value)} <small>{t("units")}</small></b><p>{t("Expected sales in the next 4 weeks")}: <b>{demandRangeText(range.low, range.high)} {t("units")}</b></p><p>{t("In stock")}: {numberText(stock?.currentStock ?? 0)} · {t("Incoming")}: {numberText(value("incomingStock"))}</p><SourceTag source="worked out by StockLess" />
        {restock.beforeQuantity && (restock.beforeQuantity.value !== restock.afterQuantity?.value || restock.afterUnavailableReason) && <p>{copy("Before expiry/storage adjustment", "到期／储存调整前", "Sebelum pelarasan luput/penyimpanan")}: {restock.beforeQuantity.value} · {copy("After", "调整后", "Selepas")}: {restock.afterQuantity?.value ?? copy("Unavailable", "不可用", "Tidak tersedia")}{restock.afterUnavailableReason && ` · ${t(restock.afterUnavailableReason)}`}</p>}
        <button type="button" className="btn btn--primary" disabled={invalidQuantity || Boolean(restock.afterUnavailableReason) || restock.quantity.value > EPIC5_POLICY.maximumQuantity} onClick={() => adopt(restock.quantity.value)}>{t(`Use suggested ${numberText(restock.quantity.value)}`)}</button>
      </section><section className="pp-order"><h3 className="pp-kicker">{t("Your planned order")}</h3><div className="pp-order-step"><button type="button" aria-label={t("Decrease planned order")} disabled={value("plannedOrder") === 0} onClick={() => update("plannedOrder", String(Math.max(0, value("plannedOrder") - 1)))}>−</button>
        <input type="text" inputMode="numeric" aria-label={t("Exact planned order quantity")} placeholder="0" value={typed.plannedOrder ?? (inputs.plannedOrder.state === "value" ? String(inputs.plannedOrder.value) : "")} aria-invalid={Boolean(errors.plannedOrder)} aria-describedby={errors.plannedOrder ? "planned-order-error" : "purchase-empty-order"} onChange={event => update("plannedOrder", event.currentTarget.value)} />
        <button type="button" aria-label={t("Increase planned order")} disabled={value("plannedOrder") >= EPIC5_POLICY.maximumQuantity} onClick={() => update("plannedOrder", String(value("plannedOrder") + 1))}>+</button><span>{t("units")}</span>
      </div><input className="pp-quantity-range" type="range" min="0" max={sliderMaximum} step="1" value={value("plannedOrder")} aria-label={t("Planned order")} aria-valuetext={inputs.plannedOrder.state === "empty" ? t("Not entered") : `${numberText(value("plannedOrder"))} ${t("units")}`} onChange={event => update("plannedOrder", event.currentTarget.value)} />
        {errors.plannedOrder && <p id="planned-order-error" className="pp-input-error" role="alert">{t(errors.plannedOrder)}. {t("The check still uses the last valid quantity. Correct this field to update it.")}</p>}
        <div className="pp-incoming"><label htmlFor="purchase-incoming">{t("Incoming stock")}</label><input id="purchase-incoming" type="text" inputMode="numeric" placeholder="0" value={typed.incomingStock ?? (inputs.incomingStock.state === "value" ? String(inputs.incomingStock.value) : "")} aria-invalid={Boolean(errors.incomingStock)} aria-describedby={errors.incomingStock ? "incoming-stock-error" : undefined} onChange={event => update("incomingStock", event.currentTarget.value)} /><span>{t("units")}</span></div>
        {errors.incomingStock && <p id="incoming-stock-error" className="pp-input-error" role="alert">{t(errors.incomingStock)}. {t("The check still uses the last valid quantity. Correct this field to update it.")}</p>}
        {inputs.incomingStock.state === "empty" && <p className="pp-small-note">{copy("Incoming stock not entered — counted as 0 units in this check.", "未填写在途库存——本次检查按 0 件计算。", "Stok akan tiba belum dimasukkan — dikira sebagai 0 unit dalam semakan ini.")}</p>}
        <div className="pp-input-sources">{inputs.plannedOrder.state === "value" && <span>{t("Your order")}: <SourceTag source={inputs.plannedOrder.source} /><button type="button" className="pp-link-button" aria-label={t("Reset order to suggestion")} onClick={() => update("plannedOrder", "")}>{t("Reset to suggestion")}</button></span>}{inputs.incomingStock.state === "value" && <span>{t("Incoming")}: <SourceTag source={inputs.incomingStock.source} /><button type="button" className="pp-link-button" aria-label={t("Clear incoming stock")} onClick={() => update("incomingStock", "")}>{t("Clear")}</button></span>}</div>
        <p id="purchase-empty-order" className="pp-small-note">{t("Suggested drafts are calculated automatically. Adjust the quantity if needed; zero is a valid order.")}</p>
      </section></div>
      <section className="pp-purchase-check" aria-label={t("Purchase check")} aria-live="polite"><div className="pp-check-head"><h3>{t("Purchase check")}</h3></div>
        <div className={`pp-check-message pp-check-message--${group}`}><b>{t(inputs.plannedOrder.state === "empty" ? "Not entered" : group === "check_order" ? "This plan looks too high." : group === "order_needed" ? "This plan looks too low." : "This plan is within range.")}</b><p>{t(audit?.state === "verdict" ? audit.reasonSentence : "Enter a planned order when you are ready.")}</p>{inputs.plannedOrder.state === "empty" && <small>{t("No plan entered; stock after ordering and shortage are not assessed.")}</small>}{audit?.state === "verdict" && audit.gettingOld && <small>{t("The stock count is getting old. A fresher count would be better.")}</small>}{audit?.state === "verdict" && !expiryUsed && <small>{copy("Based on stock and demand only — expiry not checked.", "仅基于库存和需求——未检查过期。", "Berdasarkan stok dan permintaan sahaja — luput tidak disemak.")}</small>}</div>
        <section className="pp-check-explanation pp-check-working" aria-label={t("Why this purchase check?")}><h3>{t("Why this purchase check?")}</h3>
          {figures && <><p className="num">{numberText(figures.stockOnHand.value)} − {numberText(figures.expiryAtRisk?.value ?? 0)} + {numberText(figures.incomingStock.value)} + {numberText(figures.plannedOrder.value)} = {numberText(figures.availableAfterOrder.value)} {t("units")}</p><PurchaseStockChart stock={Math.max(0, figures.stockOnHand.value - (figures.expiryAtRisk?.value ?? 0))} incoming={figures.incomingStock.value} order={figures.plannedOrder.value} low={range.low} high={range.high} /></>}
          <p>{t("Usable stock + incoming stock + your planned order is compared with the expected four-week range. Above the range may leave excess stock; below it may leave a shortfall.")}</p>
          <p>{t("Demand target")}: {numberText(restock.midpointTarget.value)}. {t("Target minus usable stock and incoming, rounded up; confirmed expiry risk and storage limits may change the suggestion.")}</p>
          <ul className="pp-check-inputs">
            <li>{copy("Expected demand, next 4 weeks", "未来 4 周预计需求", "Permintaan dijangka, 4 minggu akan datang")}: {demandRangeText(range.low, range.high)} {t("units")}</li>
            <li>{copy("Stock on hand", "现有库存", "Stok sedia ada")}: {numberText(stock?.currentStock ?? 0)}{figures?.expiryAtRisk ? ` − ${numberText(figures.expiryAtRisk.value)} ${copy("at expiry risk", "件有过期风险", "berisiko luput")}` : ""}</li>
            <li>{copy("Incoming stock", "在途库存", "Stok akan tiba")}: {inputs.incomingStock.state === "value" ? numberText(inputs.incomingStock.value) : `${copy("Not entered", "未输入", "Belum dimasukkan")} (0)`}</li>
            <li>{copy("Your planned order", "您的计划订单", "Pesanan dirancang anda")}: {inputs.plannedOrder.state === "value" ? numberText(inputs.plannedOrder.value) : copy("Not entered", "未输入", "Belum dimasukkan")}</li>
            {figures && <li>{copy("Stock after order", "下单后库存", "Stok selepas pesanan")}: {numberText(figures.availableAfterOrder.value)} {t("units")}</li>}
            <li>{copy("Expiry adjustment", "过期调整", "Pelarasan luput")}: {expiryUsed ? copy(`${numberText(figures?.expiryAtRisk?.value ?? (plan?.expiryRisk?.state === "estimated" ? plan.expiryRisk.quantity : 0))} units at expiry risk are left out of usable stock; suggestion before adjustment ${numberText(restock.beforeQuantity?.value ?? restock.quantity.value)}, after ${restock.afterQuantity ? numberText(restock.afterQuantity.value) : "unavailable"}.`, `${numberText(figures?.expiryAtRisk?.value ?? (plan?.expiryRisk?.state === "estimated" ? plan.expiryRisk.quantity : 0))} 件有过期风险的库存不计入可用库存；建议量调整前 ${numberText(restock.beforeQuantity?.value ?? restock.quantity.value)}，调整后 ${restock.afterQuantity ? numberText(restock.afterQuantity.value) : "不可用"}。`, `${numberText(figures?.expiryAtRisk?.value ?? (plan?.expiryRisk?.state === "estimated" ? plan.expiryRisk.quantity : 0))} unit berisiko luput tidak dikira sebagai stok boleh guna; cadangan sebelum pelarasan ${numberText(restock.beforeQuantity?.value ?? restock.quantity.value)}, selepas ${restock.afterQuantity ? numberText(restock.afterQuantity.value) : "tidak tersedia"}.`) : copy("None — expiry was not checked, so this check is based on stock and demand only.", "无——未检查过期，此检查仅基于库存和需求。", "Tiada — luput tidak disemak, jadi semakan ini berdasarkan stok dan permintaan sahaja.")}</li>
          </ul>
        </section>
      </section>
    </>}
    <section className="pp-spending" aria-label={t("Estimated purchase spending")}><div className="pp-spending-total"><h3>{t("Estimated purchase spending")}</h3><b className="num">{spending?.state === "estimated" && !invalidQuantity ? `MYR ${spending.amount.toFixed(2)}` : t(spending?.state === "not_entered" && !invalidQuantity ? "Not entered" : "Unavailable")}</b></div>{spending?.state === "estimated" && !invalidQuantity ? <small>{spending.quantity} × MYR {spending.unitCost} · {t("Estimated")}</small> : <p className="pp-small-note">{t(invalidQuantity ? "Correct the quantity." : spending?.state !== "estimated" ? spending?.reason : "No validated unit cost.")} {spending?.state !== "estimated" && !invalidQuantity && t(spending?.correctiveAction)}</p>}</section>
    {plan?.expiryRisk?.state === "estimated" && plan.expiryRisk.quantity > 0 && <p className="pp-expiry-warning" role="status">{copy(`${numberText(plan.expiryRisk.quantity)} units may reach expiry before selling. Review expiry information below.`, `${numberText(plan.expiryRisk.quantity)} 件库存可能在售出前到期。请查看下方到期信息。`, `${numberText(plan.expiryRisk.quantity)} unit mungkin luput sebelum dijual. Semak maklumat luput di bawah.`)}</p>}
    <footer className="pp-detail-footer"><button type="button" className="btn btn--primary" onClick={onDone}>{t("Done, next product →")}</button></footer>
    {product.readinessSnapshot && <details className="cp3-controls pp-final-choice" ref={decision} open={decisionOpen} onToggle={event=>setDecisionOpen(event.currentTarget.open)}><summary>{copy('Save your final choice', '保存最终选择', 'Simpan pilihan akhir anda')}<small>{copy('Optional · decide what to buy after reviewing your draft', '可选 · 核对草稿后确定采购量', 'Pilihan · putuskan belian selepas menyemak draf')}</small></summary>{decisionOpen && <DecisionOutcomeControls mode="decisions" datasetId={datasetId} product={product} snapshot={product.readinessSnapshot} plan={plan} plannedQuantity={inputs.plannedOrder.state === 'value' ? inputs.plannedOrder.value : undefined} />}{decisionOpen && (onOutcomes || onDownloads) && <div className="cp3-actions">{onDownloads && <button type="button" className="btn btn--ghost" onClick={onDownloads}>{copy('Download saved final orders', '下载已保存的最终订单', 'Muat turun pesanan akhir disimpan')} →</button>}{onOutcomes && <button type="button" className="btn btn--ghost" onClick={onOutcomes}>{copy('Record what happened in Impact', '在影响页记录实际情况', 'Rekod apa yang berlaku dalam Impak')} →</button>}</div>}</details>}
    <details className="pp-product-details" ref={productDetails} open={detailsOpen} onToggle={event=>setDetailsOpen(event.currentTarget.open)}><summary>{copy("More product details", "更多商品详情", "Butiran produk lanjut")}<small>{copy("Optional corrections, expiry and buying restrictions", "可选修正、到期与采购限制", "Pembetulan pilihan, luput dan sekatan belian")}</small></summary><div className="pp-product-details-body">
    {product.demand?.historyEvidence && <details className="pp-check-explanation"><summary>{t("History to improve")}</summary><p>{t("Usable complete weeks")}: {product.demand.historyEvidence.usableWeekStarts.length} / 8</p><p>{t("Missing weeks")}: {product.demand.historyEvidence.missingWeekStarts.join(", ") || t("None")}</p>{product.demand.historyEvidence.excludedPeriods.map(period => <p key={period.weekStart}>{period.weekStart} · {t("Excluded records")}: {period.sourceRows.join(", ")} · {period.reasons.map(t).join(" ")}</p>)}<p>{t(product.demand.historyEvidence.correctiveAction)}</p><p>{t("Forecast uses positive sales; returns are retained separately.")}</p></details>}
    <div className="pp-two pp-extras"><section className="pp-extra"><button type="button" className="pp-extra-toggle" aria-expanded={extra === "expiry"} aria-controls="purchase-expiry-extra" onClick={() => setExtra(extra === "expiry" ? null : "expiry")}><span><b>{t("Expiry information")}</b><small>{t(plan?.expiry.message ?? "Expiry not checked — evidence mismatch for this product")}</small></span><span aria-hidden="true">{extra === "expiry" ? "−" : "+"}</span></button>{extra === "expiry" && <div id="purchase-expiry-extra" className="pp-extra-body"><p>{copy('Checked expiry information from your file is included automatically.','文件中已核对的到期信息会自动计入。','Maklumat luput disemak daripada fail dikira secara automatik.')}</p>{plan?.expiryRisk?.state === 'estimated' && <p><b>{numberText(plan.expiryRisk.quantity)} {t('units')}</b> {copy('may expire before selling.','可能在售出前到期。','mungkin luput sebelum dijual.')}</p>}{plan?.expiry && "earliestDate" in plan.expiry && <p>{t("Earliest expiry:")} {purchaseDate(plan.expiry.earliestDate, true)} <SourceTag source="from your file" /></p>}{plan?.expiryRisk && plan.expiryRisk.state !== "estimated" && <p>{t(plan.expiryRisk.reason)} {copy("To check expiry, map Expiry date and Expiry quantity (units in each batch at the stock count date) in Step 2. Until then, the check is based on stock and demand only.", "如需检查过期，请在第 2 步对应“到期日”和“到期数量”（盘点日每批数量）。在此之前，检查仅基于库存和需求。", "Untuk menyemak luput, padankan Tarikh luput dan Kuantiti luput (unit setiap kelompok pada tarikh kiraan stok) dalam Langkah 2. Sebelum itu, semakan berdasarkan stok dan permintaan sahaja.")}</p>}</div>}</section>
    <section className="pp-extra"><button type="button" className="pp-extra-toggle" aria-expanded={extra === "supplier"} aria-controls="purchase-supplier-extra" onClick={() => setExtra(extra === "supplier" ? null : "supplier")}><span><b>{t("Supplier terms")}</b><small>{t("Optional · case size, minimum order and delivery time")}</small></span><span aria-hidden="true">{extra === "supplier" ? "−" : "+"}</span></button>{extra === "supplier" && <div id="purchase-supplier-extra" className="pp-extra-body"><div className="pp-supplier-fields">{([ ["caseSize", "Case size"], ["minimumOrder", "Minimum order"], ["leadTimeDays", "Lead time (days)"] ] as const).map(([field, label]) => <label key={field}>{t(label)}<input type="text" inputMode="numeric" value={supplierRaw[field] ?? (terms[field] === undefined ? "" : String(terms[field]))} placeholder="—" aria-invalid={Boolean(supplierErrors[field])} aria-describedby={supplierErrors[field] ? `supplier-${field}-error` : undefined} onChange={event => changeTerm(field, event.currentTarget.value)} />{supplierErrors[field] && <span id={`supplier-${field}-error`} className="pp-input-error" role="alert">{t(supplierErrors[field])}</span>}</label>)}</div>
      {supplierInvalid ? <p>{t("Correct the supplier terms to update this suggestion.")}</p> : supplier.state === "unavailable" ? <p>{t(supplier.reason)}</p> : <><p>{hasSupplierQuantity ? t(`Supplier-adjusted order: ${numberText(supplier.quantity)} units.`) : t("Add a case size or minimum order to adjust the suggested quantity.")}{supplier.cases !== undefined && hasSupplierQuantity && ` ${t(`${numberText(supplier.cases)} cases of ${numberText(terms.caseSize ?? 1)}.`)}`}</p>{supplier.arrivalDate && <p>{t("Estimated arrival:")} {purchaseDate(supplier.arrivalDate, true)}</p>}{supplier.beyondPlanningWindow && <p className="pp-input-error">{t("Delivery falls outside this four-week plan. Lead time does not extend the forecast.")}</p>}{hasSupplierQuantity && <button type="button" className="btn btn--ghost btn--small" disabled={invalidQuantity} onClick={() => adopt(supplier.quantity)}>{t(`Use supplier quantity ${numberText(supplier.quantity)}`)}</button>}</>}
      <p className="pp-small-note">{t("Saved buying restrictions are included automatically in suggestions. Check an adjusted order against the demand range.")}</p>
    </div>}</section></div>
    {product.readinessSnapshot && onPlanningChange && <PlanningInputsPanel snapshot={product.readinessSnapshot} productKey={product.key} value={product.planningContext} onChange={onPlanningChange} />}

    </div></details>
  </section>;
}
