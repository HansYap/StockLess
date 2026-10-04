import { useState } from "react";
import type { SavedDataset, SavedDatasetSummary } from "../storage/saved-datasets.ts";

function quantity(field: { readonly state: string; readonly value?: number }): string {
  return field.state === "value" ? String(field.value) : "not entered";
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
  const [outcome, setOutcome] = useState("");
  const [outcomeDecisionId, setOutcomeDecisionId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [terms, setTerms] = useState("");
  return <section aria-label="Saved-data management" className="card">
    <h2>Saved information</h2>
    {items.length === 0 ? <p>Nothing saved</p> : <>
      <ul>{items.map((item) => <li key={item.id}>
        <strong>{item.shopName} / {item.datasetName}</strong> · {item.sourceName} · {item.rowCount} records · {item.supplierTermCount} supplier terms · {item.planCount} plans · {item.decisionCount} decisions · {item.outcomeCount} outcomes
        {item.id === activeId ? " · Open" : null}
        <div>
          <button type="button" onClick={() => onInspect(item.id)}>Inspect</button>{" "}
          <button type="button" onClick={() => onOpen(item.id)}>Open</button>{" "}
          <button type="button" onClick={() => onUpdate(item.id)}>Update with a file</button>{" "}
          <button type="button" onClick={() => onDelete(item.id)}>Delete</button>
        </div>
      </li>)}</ul>
      {selected && <section aria-label={`Details for ${selected.shopName} / ${selected.datasetName}`}>
        <h3>{selected.shopName} / {selected.datasetName}</h3>
        <p>File: {selected.envelope.session.dataset?.sourceName}; records: {selected.envelope.session.dataset?.rows.length ?? 0}; analysis date: {selected.analysisDate}</p>
        <p>Column settings: {Object.values(selected.envelope.session.mapping.mappings).map((item) => item && `${item.targetField} → ${item.sourceColumnId}`).filter(Boolean).join(", ") || "None"}</p>
        <h4>Supplier terms</h4>
        <ul>{Object.entries(selected.supplierTerms ?? {}).map(([name, value]) => <li key={name}>{name}: {value}{" "}<button type="button" onClick={() => onDeleteSupplierTerm(name)}>Delete terms</button></li>)}</ul>
        <label>Supplier <input value={supplier} onChange={(event) => setSupplier(event.currentTarget.value)} /></label>{" "}
        <label>Terms <input value={terms} onChange={(event) => setTerms(event.currentTarget.value)} /></label>{" "}
        <button type="button" disabled={!supplier.trim() || !terms.trim()} onClick={async () => {
          if (await onSaveSupplierTerm(supplier, terms)) { setSupplier(""); setTerms(""); }
        }}>Save supplier terms</button>
        <h4>Plans</h4>
        <ul>{Object.entries(selected.purchaseDrafts).map(([key, value]) => value && <li key={key}>{key}: order {quantity(value.plannedOrder)}, incoming {quantity(value.incomingStock)}{" "}<button type="button" onClick={() => onDeletePlan(key)}>Delete plan</button></li>)}</ul>
        <h4>Decisions</h4>
        <ul>{selected.decisions.map((item) => <li key={item.id}>{item.recordedAt}: {item.note ?? "Saved recommendation"}{" "}<button type="button" onClick={() => onDeleteDecision(item.id)}>Delete decision</button><details><summary>Original recommendation</summary>
          <p>Analysis date: {item.recommendation.analysisDate}</p>
          <ul>{item.recommendation.products.map((product) => <li key={product.key}>{product.name}: suggested {product.plan?.estimatedRestock.state === "available" ? product.plan.estimatedRestock.quantity.value : "unavailable"}; planned {quantity(product.inputs.plannedOrder)}; {product.plan?.audit.state === "verdict" ? product.plan.audit.verdict : "No verdict"}</li>)}</ul>
        </details></li>)}</ul>
        <h4>Outcomes</h4>
        <ul>{selected.outcomes.map((item) => <li key={item.id}>{item.recordedAt}: {String(item.details.description ?? "Recorded outcome")}{" "}<button type="button" onClick={() => onDeleteOutcome(item.id)}>Delete outcome</button></li>)}</ul>
        <label>Record an outcome <input value={outcome} onChange={(event) => setOutcome(event.currentTarget.value)} /></label>{" "}
        <label>Related decision <select value={outcomeDecisionId} onChange={(event) => setOutcomeDecisionId(event.currentTarget.value)}>
          <option value="">None</option>
          {selected.decisions.map((item) => <option key={item.id} value={item.id}>{item.note ?? item.recordedAt}</option>)}
        </select></label>{" "}
        <button type="button" disabled={!outcome.trim()} onClick={async () => {
          if (await onSaveOutcome(outcome, outcomeDecisionId || undefined)) { setOutcome(""); setOutcomeDecisionId(""); }
        }}>Save outcome</button>
      </section>}
      <button type="button" onClick={onClear}>Clear Everything</button>
    </>}
  </section>;
}

interface SaveProps {
  readonly defaultName: string;
  readonly shops: readonly string[];
  readonly onSave: (shop: string, dataset: string) => Promise<void>;
}

export function SaveDatasetControls({ defaultName, shops, onSave }: SaveProps) {
  const [shop, setShop] = useState("");
  const [dataset, setDataset] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  return <section aria-label="Save dataset" className="card">
    <h2>Save this dataset</h2>
    <label>Shop name <input list="saved-shop-names" value={shop} onChange={(event) => setShop(event.currentTarget.value)} /></label>{" "}
    <datalist id="saved-shop-names">{shops.map((value) => <option key={value} value={value} />)}</datalist>
    <label>Dataset name <input value={dataset} onChange={(event) => setDataset(event.currentTarget.value)} /></label>{" "}
    <button type="button" disabled={saving || !shop.trim() || !dataset.trim()} onClick={async () => {
      setSaving(true);
      try { await onSave(shop, dataset); } finally { setSaving(false); }
    }}>Save dataset</button>
  </section>;
}
