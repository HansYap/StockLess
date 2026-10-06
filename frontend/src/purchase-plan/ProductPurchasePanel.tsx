import { useRef, useState } from "react";
import { t, useLanguage } from "../i18n/index.ts";
import { ProductLabelList } from "../components/ProductLabelList.tsx";
import { SupplierComparison } from "./SupplierComparison.tsx";
import { addCalendarDays, applyPurchaseQuantityEdit, createPurchaseQuantity, estimatePurchaseCost, EPIC5_POLICY, suggestSupplierOrder, type ProductPurchaseInputs, type ProductPurchasePlan, type SupplierOrderTerms } from "../engine.ts";
import { purchaseGroup, purchaseGroupLabels, type PurchaseProduct } from "./model.ts";
import { SourceTag, numberText, oneDecimalText } from "./SourceTag.tsx";
import { PurchaseDemandChart, purchaseDate } from "./PurchaseDemandChart.tsx";

interface Props {
  product: PurchaseProduct; plan?: ProductPurchasePlan; inputs: ProductPurchaseInputs;
  analysisDate: string; terms: SupplierOrderTerms; onTermsChange: (terms: SupplierOrderTerms) => void;
  onChange: (inputs: ProductPurchaseInputs) => void; onReviewData: () => void;
  position?: number; total: number; onPrevious?: () => void; onNext?: () => void; onDone: () => void;
}

export function ProductPurchasePanel({ product, plan, inputs, analysisDate, terms, onTermsChange, onChange, onReviewData, position, total, onPrevious, onNext, onDone }: Props) {
  useLanguage();
  const [showEvidence, setShowEvidence] = useState(true);
  const [extra, setExtra] = useState<"expiry" | "supplier" | null>(null);
  const [typed, setTyped] = useState<Partial<Record<keyof ProductPurchaseInputs, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof ProductPurchaseInputs, string>>>({});
  const [supplierRaw, setSupplierRaw] = useState<Partial<Record<keyof SupplierOrderTerms, string>>>({});
  const [supplierErrors, setSupplierErrors] = useState<Partial<Record<keyof SupplierOrderTerms, string>>>({});
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
  const figures = audit?.state === "verdict" ? audit.figures : undefined;
  const chartMaximum = figures ? Math.max(figures.demandHigh.value * 1.3, figures.availableAfterOrder.value * 1.08, 4) : 1;
  const percent = (quantity: number) => `${quantity / chartMaximum * 100}%`;
  const reason = product.issue || (product.demand?.label === "Cannot assess" ? product.demand.labelReason?.message : restock?.state === "unavailable" ? restock.reason : product.demand?.labelReason?.message) || "Review the available evidence before planning.";
  return <section className="pp-detail" aria-labelledby="purchase-detail-title">
    <header className="pp-detail-head"><div><span className="pp-kicker">{position === undefined ? t("Selected product outside current filter") : t(`Product ${position + 1} of ${total}`)}</span><h2 id="purchase-detail-title">{product.title}</h2>
      <p className="pp-detail-sub">{product.sku || t("Not available")}{product.pack ? ` · ${product.pack}` : ""} · {t("Counted")} {stock?.stockAsOfDate ? purchaseDate(stock.stockAsOfDate) : "—"}{stock?.freshness.ageDays !== undefined ? ` · ${t(`${stock.freshness.ageDays} days old`)}` : ""}</p>
    </div><div className="pp-detail-nav"><span className={`pp-pill pp-pill--${group}`}>{t(purchaseGroupLabels[group])}</span><button type="button" onClick={onPrevious} disabled={!onPrevious} aria-label={t("Previous product")}>‹</button><button type="button" onClick={onNext} disabled={!onNext} aria-label={t("Next product")}>›</button></div></header>
    <ProductLabelList labels={product.labels} shown={[product.title, product.sku, product.pack]} />
    {product.demand?.historyEvidence && <details><summary>{t("History to improve")}</summary><p>{t("Usable complete weeks")}: {product.demand.historyEvidence.usableWeekStarts.length} / 8</p><p>{t("Missing weeks")}: {product.demand.historyEvidence.missingWeekStarts.join(", ") || t("None")}</p>{product.demand.historyEvidence.excludedPeriods.map(period => <p key={period.weekStart}>{period.weekStart} · {t("Excluded records")}: {period.sourceRows.join(", ")} · {period.reasons.map(t).join(" ")}</p>)}<p>{t(product.demand.historyEvidence.correctiveAction)}</p><p>{t("Forecast uses positive sales; returns are retained separately.")}</p></details>}
    <section aria-label={t("Estimated purchase spending")}><h3>{t("Estimated purchase spending")}</h3>{spending?.state === "estimated" && !invalidQuantity ? <p>MYR {spending.amount.toFixed(2)} · {spending.quantity} × MYR {spending.unitCost} · {t("Estimated")}</p> : <><p>{t(spending?.state === "not_entered" ? "Not entered" : "Unavailable")}</p><p>{t(invalidQuantity ? "Correct the quantity." : spending?.state !== "estimated" ? spending?.reason : "No validated unit cost.")}</p>{spending?.state !== "estimated" && <p>{t(spending?.correctiveAction)}</p>}</>}</section>
    {!plannable ? <div className="pp-unavailable"><h3>{t("Unavailable")}</h3><p>{t(reason)}</p><p>{t(restock?.state === "unavailable" ? restock.correctiveAction : product.demand?.historyEvidence?.correctiveAction)}</p><button type="button" className="btn btn--ghost" onClick={onReviewData}>{t("Fix it in Step 3")}</button></div> : <>
      <section className="pp-demand"><div className="pp-demand-head"><h3>{t("Demand and stock")}</h3><button type="button" className="pp-link-button" aria-expanded={showEvidence} aria-controls="purchase-demand-evidence" onClick={() => setShowEvidence(!showEvidence)}>{t(showEvidence ? "Hide evidence" : "Show evidence")}</button></div>
        {showEvidence && <div className="pp-demand-body" id="purchase-demand-evidence"><div className="pp-demand-main"><p className="pp-demand-range"><b>{numberText(range.low)}–{numberText(range.high)} {t("units")}</b><span>{purchaseDate(analysisDate)} – {purchaseDate(addCalendarDays(analysisDate, 27))}</span></p>
          <PurchaseDemandChart weeks={product.evidence?.timeline.weeks ?? []} range={range} name={product.title} analysisDate={analysisDate} />
          <p className="pp-small-note">{t(`Range based on ${range.basedOnWeekCount} weeks, from ${range.firstWeekUsed} to ${range.lastWeekUsed}.`)}</p>
          {product.demand?.labelReason?.message && <p className="pp-small-note">{t(product.demand.labelReason.message)}</p>}
        </div><div className="pp-facts">
          {metric("In stock", stock?.currentStock === undefined ? "—" : numberText(stock.currentStock), "from your file")}
          {metric("Recent weekly average", product.evidence?.recentAverage.value === undefined ? "—" : oneDecimalText(product.evidence.recentAverage.value), "worked out by StockLess")}
          {metric("Weeks of cover", product.evidence?.cover.value === undefined ? "—" : oneDecimalText(product.evidence.cover.value), "worked out by StockLess")}
          {metric("Stock counted", stock?.stockAsOfDate ? purchaseDate(stock.stockAsOfDate) : "—", stock?.freshness.ageDays === undefined ? "Not available" : `${stock.freshness.ageDays} days old`)}
        </div></div>}
      </section>
      <div className="pp-two"><section className="pp-suggestion"><h3 className="pp-kicker">{t("Suggested order")}</h3><b className="pp-suggestion-number">{numberText(restock.quantity.value)} <small>{t("units")}</small></b><p>{t("Demand target")}: {numberText(restock.midpointTarget.value)} · {t("In stock")}: {numberText(stock?.currentStock ?? 0)} · {t("Incoming")}: {numberText(value("incomingStock"))}<br />{t("Target minus stock and incoming, rounded up; no extra order when stock already covers it.")}</p><SourceTag source="worked out by StockLess" />
        <button type="button" className="btn btn--primary" disabled={invalidQuantity || restock.quantity.value > EPIC5_POLICY.maximumQuantity} onClick={() => adopt(restock.quantity.value)}>{t(`Use suggested ${numberText(restock.quantity.value)}`)}</button>
      </section><section className="pp-order"><h3 className="pp-kicker">{t("Your planned order")}</h3><div className="pp-order-step"><button type="button" aria-label={t("Decrease planned order")} disabled={value("plannedOrder") === 0} onClick={() => update("plannedOrder", String(Math.max(0, value("plannedOrder") - 1)))}>−</button>
        <input type="text" inputMode="numeric" aria-label={t("Exact planned order quantity")} placeholder="0" value={typed.plannedOrder ?? (inputs.plannedOrder.state === "value" ? String(inputs.plannedOrder.value) : "")} aria-invalid={Boolean(errors.plannedOrder)} aria-describedby={errors.plannedOrder ? "planned-order-error" : "purchase-empty-order"} onChange={event => update("plannedOrder", event.currentTarget.value)} />
        <button type="button" aria-label={t("Increase planned order")} disabled={value("plannedOrder") >= EPIC5_POLICY.maximumQuantity} onClick={() => update("plannedOrder", String(value("plannedOrder") + 1))}>+</button><span>{t("units")}</span>
      </div><input className="pp-quantity-range" type="range" min="0" max={sliderMaximum} step="1" value={value("plannedOrder")} aria-label={t("Planned order")} aria-valuetext={inputs.plannedOrder.state === "empty" ? t("Not entered") : `${numberText(value("plannedOrder"))} ${t("units")}`} onChange={event => update("plannedOrder", event.currentTarget.value)} />
        {errors.plannedOrder && <p id="planned-order-error" className="pp-input-error" role="alert">{t(errors.plannedOrder)}. {t("The check still uses the last valid quantity. Correct this field to update it.")}</p>}
        <div className="pp-incoming"><label htmlFor="purchase-incoming">{t("Incoming stock")}</label><input id="purchase-incoming" type="text" inputMode="numeric" placeholder="0" value={typed.incomingStock ?? (inputs.incomingStock.state === "value" ? String(inputs.incomingStock.value) : "")} aria-invalid={Boolean(errors.incomingStock)} aria-describedby={errors.incomingStock ? "incoming-stock-error" : undefined} onChange={event => update("incomingStock", event.currentTarget.value)} /><span>{t("units")}</span></div>
        {errors.incomingStock && <p id="incoming-stock-error" className="pp-input-error" role="alert">{t(errors.incomingStock)}. {t("The check still uses the last valid quantity. Correct this field to update it.")}</p>}
        <div className="pp-input-sources">{inputs.plannedOrder.state === "value" && <span>{t("Your order")}: <SourceTag source={inputs.plannedOrder.source} /><button type="button" className="pp-link-button" aria-label={t("Clear planned order")} onClick={() => update("plannedOrder", "")}>{t("Clear")}</button></span>}{inputs.incomingStock.state === "value" && <span>{t("Incoming")}: <SourceTag source={inputs.incomingStock.source} /><button type="button" className="pp-link-button" aria-label={t("Clear incoming stock")} onClick={() => update("incomingStock", "")}>{t("Clear")}</button></span>}</div>
        <p id="purchase-empty-order" className="pp-small-note">{t("Enter an order quantity to check stock after ordering, shortage and cost. Zero is a valid quantity.")}</p>
      </section></div>
      <section className="pp-purchase-check" aria-label={t("Purchase check")} aria-live="polite"><div className="pp-check-head"><h3>{t("Purchase check")}</h3>{figures && <span className="num">{numberText(figures.stockOnHand.value)} + {numberText(figures.incomingStock.value)} + {numberText(figures.plannedOrder.value)} = {numberText(figures.availableAfterOrder.value)} {t("units")}</span>}</div>
        {figures && <div className="pp-stock-bar" role="img" aria-label={`${t("Stock after order")}: ${numberText(figures.availableAfterOrder.value)} ${t("units")}; ${t("Expected demand")}: ${numberText(range.low)}–${numberText(range.high)}`}><div className="pp-stock-track"><span className="pp-stock-segment pp-stock-segment--stock" style={{ width: percent(figures.stockOnHand.value) }} /><span className="pp-stock-segment pp-stock-segment--incoming" style={{ width: percent(figures.incomingStock.value) }} /><span className="pp-stock-segment pp-stock-segment--order" style={{ width: percent(figures.plannedOrder.value) }} /></div><span className="pp-stock-band" style={{ left: percent(range.low), width: percent(range.high - range.low) }} /><span className="pp-stock-tick" style={{ left: percent(range.low) }}>{numberText(range.low)}</span><span className="pp-stock-tick" style={{ left: percent(range.high) }}>{numberText(range.high)}</span></div>}
        <ul className="pp-legend"><li><i className="pp-swatch pp-stock-segment--stock" />{t("In stock")}</li><li><i className="pp-swatch pp-stock-segment--incoming" />{t("Incoming")}</li><li><i className="pp-swatch pp-stock-segment--order" />{t("Your order")}</li><li><i className="pp-swatch pp-swatch--range" />{t("Expected demand")}</li></ul>
        <div className={`pp-check-message pp-check-message--${group}`}><b>{t(inputs.plannedOrder.state === "empty" ? "Not entered" : group === "check_order" ? "This plan looks too high." : group === "order_needed" ? "This plan looks too low." : "This plan is within range.")}</b><p>{t(audit?.state === "verdict" ? audit.reasonSentence : "Enter a planned order when you are ready.")}</p>{inputs.plannedOrder.state === "empty" && <small>{t("No plan entered; stock after ordering and shortage are not assessed.")}</small>}{audit?.state === "verdict" && audit.gettingOld && <small>{t("The stock count is getting old. A fresher count would be better.")}</small>}</div>
        <details className="pp-check-explanation"><summary>{t("Why this purchase check?")}</summary><p>{t("Stock on hand + incoming stock + your planned order is compared with the expected four-week range. Above the range may leave excess stock; below it may leave a shortfall.")}</p></details>
      </section>
    </>}
    <div className="pp-two pp-extras"><section className="pp-extra"><button type="button" className="pp-extra-toggle" aria-expanded={extra === "expiry"} aria-controls="purchase-expiry-extra" onClick={() => setExtra(extra === "expiry" ? null : "expiry")}><span><b>{t("Expiry information")}</b><small>{t(plan?.expiry.message ?? "Expiry not checked — evidence mismatch for this product")}</small></span><span aria-hidden="true">{extra === "expiry" ? "−" : "+"}</span></button>{extra === "expiry" && <div id="purchase-expiry-extra" className="pp-extra-body"><p>{t("This estimate uses general stock and demand. Expiry is a separate check; affected batch quantities are not included in the adjustment.")}</p>{plan?.expiry && "earliestDate" in plan.expiry && <p>{t("Earliest expiry:")} {purchaseDate(plan.expiry.earliestDate, true)} <SourceTag source="from your file" /></p>}</div>}</section>
    <section className="pp-extra"><button type="button" className="pp-extra-toggle" aria-expanded={extra === "supplier"} aria-controls="purchase-supplier-extra" onClick={() => setExtra(extra === "supplier" ? null : "supplier")}><span><b>{t("Supplier terms")}</b><small>{t("Optional · case size, minimum order and delivery time")}</small></span><span aria-hidden="true">{extra === "supplier" ? "−" : "+"}</span></button>{extra === "supplier" && <div id="purchase-supplier-extra" className="pp-extra-body"><div className="pp-supplier-fields">{([ ["caseSize", "Case size"], ["minimumOrder", "Minimum order"], ["leadTimeDays", "Lead time (days)"] ] as const).map(([field, label]) => <label key={field}>{t(label)}<input type="text" inputMode="numeric" value={supplierRaw[field] ?? (terms[field] === undefined ? "" : String(terms[field]))} placeholder="—" aria-invalid={Boolean(supplierErrors[field])} aria-describedby={supplierErrors[field] ? `supplier-${field}-error` : undefined} onChange={event => changeTerm(field, event.currentTarget.value)} />{supplierErrors[field] && <span id={`supplier-${field}-error`} className="pp-input-error" role="alert">{t(supplierErrors[field])}</span>}</label>)}</div>
      {supplierInvalid ? <p>{t("Correct the supplier terms to update this suggestion.")}</p> : supplier.state === "unavailable" ? <p>{t(supplier.reason)}</p> : <><p>{hasSupplierQuantity ? t(`Supplier-adjusted order: ${numberText(supplier.quantity)} units.`) : t("Add a case size or minimum order to adjust the suggested quantity.")}{supplier.cases !== undefined && hasSupplierQuantity && ` ${t(`${numberText(supplier.cases)} cases of ${numberText(terms.caseSize ?? 1)}.`)}`}</p>{supplier.arrivalDate && <p>{t("Estimated arrival:")} {purchaseDate(supplier.arrivalDate, true)}</p>}{supplier.beyondPlanningWindow && <p className="pp-input-error">{t("Delivery falls outside this four-week plan. Lead time does not extend the forecast.")}</p>}{hasSupplierQuantity && <button type="button" className="btn btn--ghost btn--small" disabled={invalidQuantity} onClick={() => adopt(supplier.quantity)}>{t(`Use supplier quantity ${numberText(supplier.quantity)}`)}</button>}</>}
      <p className="pp-small-note">{t("Supplier terms stay in this visit. The demand forecast is unchanged; check the adjusted order against the range.")}</p>
    </div>}</section></div>
    <SupplierComparison estimate={product.issue ? undefined : restock} analysisDate={analysisDate} sample={product.readinessSnapshot?.sourceMode === "sample"} onAdopt={adopt} disabled={invalidQuantity || Boolean(product.issue)} />
    <footer className="pp-detail-footer"><button type="button" className="btn btn--primary" onClick={onDone}>{t("Done, next product →")}</button></footer>
  </section>;
}
