import { useId, useState } from "react";
import { t, useLanguage } from "../i18n/index.ts";
import { EPIC5_POLICY, suggestSupplierOrder, type RestockEstimate, type SupplierOrderTerms } from "../engine.ts";
import { numberText } from "./SourceTag.tsx";
import { purchaseDate } from "./PurchaseDemandChart.tsx";

interface Props {
  estimate?: RestockEstimate;
  terms: SupplierOrderTerms;
  analysisDate: string;
  invalidQuantity: boolean;
  onTermsChange: (terms: SupplierOrderTerms) => void;
  onApply: (quantity: number) => void;
}

/** Product-level buying rules sit with the order they adjust, outside impact checks. */
export function SupplierOrderPanel({ estimate, terms, analysisDate, invalidQuantity, onTermsChange, onApply }: Props) {
  const language = useLanguage();
  const c = (en: string, zh: string, ms: string) => language === "zh" ? zh : language === "ms" ? ms : en;
  const id = useId();
  const [raw, setRaw] = useState<Partial<Record<keyof SupplierOrderTerms, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof SupplierOrderTerms, string>>>({});
  const suggestion = suggestSupplierOrder(estimate, terms, analysisDate);
  const invalid = Object.values(errors).some(Boolean);
  const hasQuantityRules = terms.caseSize !== undefined || terms.minimumOrder !== undefined;
  const change = (field: keyof SupplierOrderTerms, text: string) => {
    const minimum = field === "caseSize" ? 1 : 0;
    const maximum = field === "leadTimeDays" ? 3650 : EPIC5_POLICY.maximumQuantity;
    const accepted = text.trim() === "" || (/^\d+$/.test(text.trim()) && Number(text) >= minimum && Number(text) <= maximum);
    setRaw(previous => ({ ...previous, [field]: text }));
    setErrors(previous => ({ ...previous, [field]: accepted ? undefined : field === "leadTimeDays" ? "Enter whole days from 0 to 3650." : field === "caseSize" ? "Enter a whole case size from 1 to 999999." : "Enter a whole minimum order from 0 to 999999." }));
    if (accepted) onTermsChange({ ...terms, [field]: text.trim() === "" ? undefined : Number(text) });
  };

  return <section className="pp-supplier-order" aria-labelledby={`${id}-title`}>
    <div className="pp-supplier-order-head"><h3 id={`${id}-title`}>{c("Supplier ordering rules", "供应商订货规则", "Peraturan pesanan pembekal")}</h3><span className="pp-pill pp-pill--balanced">{c("Optional · this product", "可选 · 此商品", "Pilihan · produk ini")}</span></div>
    <p className="pp-small-note">{c("These rules adjust the suggested order above. Apply the result to your purchase plan.", "这些规则会调整上方的建议订购量。将结果应用到您的采购计划。", "Peraturan ini melaraskan cadangan pesanan di atas. Gunakan hasilnya dalam pelan belian anda.")}</p>
    <fieldset className="pp-supplier-fields">
      <legend className="sr-only">{c("Ordering rules for this product", "此商品的订货规则", "Peraturan pesanan untuk produk ini")}</legend>
      {([
        ["caseSize", c("Units per case", "每箱件数", "Unit setiap kotak")],
        ["minimumOrder", c("Minimum order (units)", "最低订量（件）", "Pesanan minimum (unit)")],
        ["leadTimeDays", c("Delivery time (days)", "送货时间（天）", "Masa penghantaran (hari)")],
      ] as const).map(([field, label]) => <label key={field} htmlFor={`${id}-${field}`}>{label}<input id={`${id}-${field}`} type="text" inputMode="numeric" value={raw[field] ?? (terms[field] === undefined ? "" : String(terms[field]))} placeholder="—" aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `${id}-${field}-error` : undefined} onChange={event => change(field, event.currentTarget.value)} />{errors[field] && <span id={`${id}-${field}-error`} className="pp-input-error" role="alert">{t(errors[field])}</span>}</label>)}
    </fieldset>
    <div className="pp-supplier-order-result" aria-live="polite">
      {invalid ? <p>{t("Correct the supplier terms to update this suggestion.")}</p> : suggestion.state === "unavailable" ? <p>{t(suggestion.reason)}</p> : <>
        <div className="pp-supplier-order-quantity"><small>{c("After supplier rules", "应用供应商规则后", "Selepas peraturan pembekal")}</small><b className="num">{numberText(suggestion.quantity)} <small>{t("units")}</small></b>
          {hasQuantityRules && estimate?.state === "available" && <p>{c("Before supplier rules", "应用供应商规则前", "Sebelum peraturan pembekal")}: <span className="num">{numberText(estimate.quantity.value)} → {numberText(suggestion.quantity)}</span> {t("units")}{suggestion.cases !== undefined && ` · ${t(`${numberText(suggestion.cases)} cases of ${numberText(terms.caseSize ?? 1)}.`)}`}</p>}
          {!hasQuantityRules && <p className="pp-small-note">{t("Add a case size or minimum order to adjust the suggested quantity.")}</p>}
          {suggestion.arrivalDate && <p className="pp-small-note">{t("Estimated arrival:")} {purchaseDate(suggestion.arrivalDate, true)}</p>}
          {suggestion.beyondPlanningWindow && <p className="pp-input-error">{t("Delivery falls outside this four-week plan. Lead time does not extend the forecast.")}</p>}
        </div>
        {hasQuantityRules && <button type="button" className="btn btn--primary" disabled={invalidQuantity} onClick={() => onApply(suggestion.quantity)}>{c(`Use ${numberText(suggestion.quantity)} units in my plan`, `将 ${numberText(suggestion.quantity)} 件应用到计划`, `Gunakan ${numberText(suggestion.quantity)} unit dalam pelan saya`)}</button>}
      </>}
    </div>
    <p className="pp-small-note">{c("Saved rules are included in automatic suggestions. An order you entered stays until you apply the adjusted quantity.", "已保存的规则会计入自动建议。您手动填写的订量会保留，直到应用调整后的数量。", "Peraturan disimpan diambil kira dalam cadangan automatik. Pesanan yang anda masukkan kekal sehingga anda menggunakan kuantiti dilaraskan.")}</p>
  </section>;
}
