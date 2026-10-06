import { useState } from "react";
import { t, useLanguage } from "../i18n/index.ts";
import { compareSupplierOrders, type RestockEstimate, type SupplierScenario } from "../engine.ts";
import { purchaseDate } from "./PurchaseDemandChart.tsx";
import { numberText } from "./SourceTag.tsx";

export function SupplierComparison({ estimate, analysisDate, sample, onAdopt, disabled }: { estimate?: RestockEstimate; analysisDate: string; sample: boolean; onAdopt: (quantity: number) => void; disabled: boolean }) {
  useLanguage();
  const [scenarios, setScenarios] = useState<readonly SupplierScenario[]>(() => sample ? [
    { id: "a", name: "Sample supplier A", terms: { caseSize: 6, minimumOrder: 24, leadTimeDays: 2 } },
    { id: "b", name: "Sample supplier B", terms: { caseSize: 12, minimumOrder: 60, leadTimeDays: 9 } },
  ] : [{ id: "a", name: "Supplier A", terms: {} }, { id: "b", name: "Supplier B", terms: {} }]);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const comparison = compareSupplierOrders(estimate, scenarios, analysisDate);
  function changeTerm(id: string, field: "caseSize" | "minimumOrder" | "leadTimeDays", value: string) {
    const key = `${id}-${field}`, minimum = field === "caseSize" ? 1 : 0, maximum = field === "leadTimeDays" ? 3650 : 999999;
    const valid = !value.trim() || (/^\d+$/.test(value.trim()) && Number(value) >= minimum && Number(value) <= maximum);
    setRaw(previous => ({ ...previous, [key]: value }));
    setErrors(previous => ({ ...previous, [key]: valid ? undefined : "Enter a valid whole-number supplier term." }));
    // An invalid edit makes this scenario unavailable instead of showing its previous result.
    setScenarios(previous => previous.map(item => item.id === id ? { ...item, terms: { ...item.terms, [field]: valid && value.trim() ? Number(value) : undefined } } : item));
  }
  return <details className="pp-supplier-comparison">
    <summary>{t("Compare supplier options")}{sample && <span className="source-tag">{t("Sample data")}</span>}</summary>
    <p className="pp-small-note">{t("Compare case size, minimum order and arrival against the same demand estimate. Prices are not compared.")}</p>
    <div className="pp-supplier-options">{comparison.map(option => <section key={option.id} aria-label={t(option.id === "a" ? "Supplier option A" : "Supplier option B")}>
      <label>{t("Supplier name")}<input value={scenarios.find(item => item.id === option.id)?.name ?? ""} onChange={event => setScenarios(previous => previous.map(item => item.id === option.id ? { ...item, name: event.target.value } : item))} /></label>
      {([ ["caseSize", "Case size"], ["minimumOrder", "Minimum order"], ["leadTimeDays", "Lead time (days)"] ] as const).map(([field, label]) => {
        const key = `${option.id}-${field}`;
        return <label key={field}>{t(option.id === "a" ? "Supplier option A" : "Supplier option B")} · {t(label)}<input type="text" inputMode="numeric" value={raw[key] ?? option.terms[field] ?? ""} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `compare-${key}-error` : undefined} onChange={event => changeTerm(option.id, field, event.target.value)} />{errors[key] && <span id={`compare-${key}-error`} className="pp-input-error" role="alert">{t(errors[key])}</span>}</label>;
      })}
      {option.result.state === "unavailable" ? <p>{t("Unavailable")}: {t(option.result.reason)}</p> : <>
        <p>{t("Supplier-adjusted quantity")}: <b className="num">{numberText(option.result.quantity)}</b> {t("units")}</p>
        <p>{t("Extra units above restock target")}: <span className="num">{numberText(option.extraUnits ?? 0)}</span></p>
        <p>{t("Estimated arrival:")} {option.result.arrivalDate ? purchaseDate(option.result.arrivalDate, true) : t("Not entered")}</p>
        {option.result.beyondPlanningWindow && <p className="pp-input-error">{t("Delivery falls outside this four-week plan. Lead time does not extend the forecast.")}</p>}
        <button type="button" className="btn btn--ghost" disabled={disabled || Object.keys(errors).some(key => key.startsWith(option.id + "-") && errors[key])} onClick={() => { if (option.result.state === "available") onAdopt(option.result.quantity); }}>{t("Use this supplier quantity")}</button>
      </>}
    </section>)}</div>
    <p className="pp-small-note">{t("Supplier comparisons stay in this visit. Choosing a quantity updates your planned order; it does not send an order to a supplier.")}</p>
  </details>;
}
