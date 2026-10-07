import { useState } from "react";
import { t, useLanguage } from "../i18n/index.ts";
import type { SavedDataset, SavedDatasetSummary } from "../storage/saved-datasets.ts";

function quantity(field: { readonly state: string; readonly value?: number }): string {
  return field.state === "value" ? String(field.value) : t("not entered");
}

interface Props {
  readonly items: readonly SavedDatasetSummary[];
  readonly activeId: string | null;
  readonly selected: SavedDataset | null;
  readonly onInspect: (id: string) => void;
  readonly onOpen: (id: string) => void;
  readonly onUpdate: (id: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onClear: () => void;
  readonly onDeletePlan: (key: string) => void;
  readonly onDeleteDecision: (id: string) => void;
  readonly onDeleteOutcome: (id: string) => void;
  readonly onSaveOutcome: (description: string, decisionId?: string) => Promise<boolean>;
  readonly onSaveSupplierTerm: (supplier: string, terms: string) => Promise<boolean>;
  readonly onDeleteSupplierTerm: (supplier: string) => void;
}

/** Isolated controls while the main upload and workspace screens are being redesigned. */
export function SavedDataControls({ items, activeId, selected, onInspect, onOpen, onUpdate, onDelete, onClear, onDeletePlan, onDeleteDecision, onDeleteOutcome, onSaveOutcome, onSaveSupplierTerm, onDeleteSupplierTerm }: Props) {
  useLanguage();
  const [outcome, setOutcome] = useState("");
  const [outcomeDecisionId, setOutcomeDecisionId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [terms, setTerms] = useState("");
  return <section aria-label={t("Saved-data management")} className="card">
    <h2>{t("Saved information")}</h2>
    {items.length === 0 ? <p>{t("Nothing saved")}</p> : <>
      <ul>{items.map((item) => <li key={item.id}>
        <strong>{item.shopName} / {item.datasetName}</strong> · {item.sourceName} · {item.rowCount} {t("records")} · {item.supplierTermCount} {t("supplier terms")} · {item.planCount} {t("plans")} · {item.decisionCount} {t("decisions")} · {item.outcomeCount} {t("outcomes")}
        {item.id === activeId ? ` · ${t("Open")}` : null}
        <div>
          <button type="button" onClick={() => onInspect(item.id)}>{t("Inspect")}</button>{" "}
          <button type="button" onClick={() => onOpen(item.id)}>{t("Open")}</button>{" "}
          <button type="button" onClick={() => onUpdate(item.id)}>{t("Update with a file")}</button>{" "}
          <button type="button" onClick={() => onDelete(item.id)}>{t("Delete")}</button>
        </div>
      </li>)}</ul>
      {selected && <section aria-label={`Details for ${selected.shopName} / ${selected.datasetName}`}>
        <h3>{selected.shopName} / {selected.datasetName}</h3>
        <p>{t("File")}: {selected.envelope.session.dataset?.sourceName}; {t("records")}: {selected.envelope.session.dataset?.rows.length ?? 0}; {t("Analysis date")}: {selected.analysisDate}</p>
        <p>{t("Column settings")}: {Object.values(selected.envelope.session.mapping.mappings).map((item) => item && `${item.targetField} → ${item.sourceColumnId}`).filter(Boolean).join(", ") || t("None")}</p>
        <h4>{t("Supplier terms")}</h4>
        <ul>{Object.entries(selected.supplierTerms ?? {}).map(([name, value]) => <li key={name}>{name}: {value}{" "}<button type="button" onClick={() => onDeleteSupplierTerm(name)}>{t("Delete terms")}</button></li>)}</ul>
        <label>{t("Supplier")} <input value={supplier} onChange={(event) => setSupplier(event.currentTarget.value)} /></label>{" "}
        <label>{t("Terms")} <input value={terms} onChange={(event) => setTerms(event.currentTarget.value)} /></label>{" "}
        <button type="button" disabled={!supplier.trim() || !terms.trim()} onClick={async () => {
          if (await onSaveSupplierTerm(supplier, terms)) { setSupplier(""); setTerms(""); }
        }}>{t("Save supplier terms")}</button>
        <h4>{t("Plans")}</h4>
        <ul>{Object.entries(selected.purchaseDrafts).map(([key, value]) => value && <li key={key}>{key}: {t("order")} {quantity(value.plannedOrder)}, {t("incoming")} {quantity(value.incomingStock)}{" "}<button type="button" onClick={() => onDeletePlan(key)}>{t("Delete plan")}</button></li>)}</ul>
        <h4>{t("Decisions")}</h4>
        <ul>{selected.decisions.map((item) => <li key={item.id}>{item.recordedAt}: {item.note ?? t("Saved recommendation")}{" "}<button type="button" onClick={() => onDeleteDecision(item.id)}>{t("Delete decision")}</button><details><summary>{t("Original recommendation")}</summary>
          <p>{t("Analysis date")}: {item.recommendation.analysisDate}</p>
          <ul>{item.recommendation.products.map((product) => <li key={product.key}>{product.name}: {t("suggested")} {product.plan?.estimatedRestock.state === "available" ? product.plan.estimatedRestock.quantity.value : t("unavailable")}; {t("planned")} {quantity(product.inputs.plannedOrder)}; {product.plan?.audit.state === "verdict" ? t(product.plan.audit.verdict) : t("No verdict")}</li>)}</ul>
        </details></li>)}</ul>
        <h4>{t("Outcomes")}</h4>
        <ul>{selected.outcomes.map((item) => <li key={item.id}>{item.recordedAt}: {String(item.details.description ?? t("Recorded outcome"))}{" "}<button type="button" onClick={() => onDeleteOutcome(item.id)}>{t("Delete outcome")}</button></li>)}</ul>
        <label>{t("Record an outcome")} <input value={outcome} onChange={(event) => setOutcome(event.currentTarget.value)} /></label>{" "}
        <label>{t("Related decision")} <select value={outcomeDecisionId} onChange={(event) => setOutcomeDecisionId(event.currentTarget.value)}>
          <option value="">{t("None")}</option>
          {selected.decisions.map((item) => <option key={item.id} value={item.id}>{item.note ?? item.recordedAt}</option>)}
        </select></label>{" "}
        <button type="button" disabled={!outcome.trim()} onClick={async () => {
          if (await onSaveOutcome(outcome, outcomeDecisionId || undefined)) { setOutcome(""); setOutcomeDecisionId(""); }
        }}>{t("Save outcome")}</button>
      </section>}
      <button type="button" onClick={onClear}>{t("Clear Everything")}</button>
    </>}
  </section>;
}
