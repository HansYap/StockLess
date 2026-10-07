import { t, useLanguage, getLocale } from "../i18n/index.ts";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  FIELD_REGISTRY,
  evaluateCapabilities,
  partitionCapabilities,
  detectIdentityConflicts,
  getReadinessBlockers,
  type CanonicalField,
  type MappingProposalResult,
  type MappingState,
  type ParsedDataset,
} from "../engine.ts";
import { WorkflowIcon } from "../components/WorkflowIcon.tsx";
import { confirmCurrentMapping } from "../mapping-confirmation.ts";
import "./mapping.css";

type IdentityMode = "stable" | "composite";
interface MappingScreenProps {
  readonly dataset: ParsedDataset;
  readonly mapping: MappingState;
  readonly proposals: MappingProposalResult | null;
  readonly onSelectColumn: (field: CanonicalField, sourceColumnId: string | null) => void;
  readonly onUndo?: () => void;
  readonly onSelectIdentity: (mode: IdentityMode) => void;
  readonly onBack: () => void;
  readonly onClear?: () => void;
  readonly onConfirmAllAndContinue: () => void;
  readonly error: string | null;
  readonly notice: string | null;
  readonly sessionNotice?: string | null;
  readonly checking?: boolean;
  readonly children?: ReactNode;
}

const OPTIONAL_FIELDS = [
  ["current_stock", "box", "How much is on the shelf"],
  ["stock_as_of_date", "calendar", "When that stock was counted"],
  ["planned_order_quantity", "document", "Orders you plan to place"],
  ["incoming_stock_quantity", "truck", "Ordered but not yet arrived"],
  ["expiry_date", "expiry", "When each batch expires"],
  ["unit_cost", "cost", "Purchase cost per unit in MYR; checked in Step 3"],
  ["unit_weight_kg", "box", "Food weight in kilograms for one sales unit"],
] as const;

/** Screen 02. Suggestions stay unconfirmed until the retailer confirms this page. */
export function MappingScreen(props: MappingScreenProps) {
  useLanguage();
  const { dataset, mapping } = props;
  const [compactTitle, setCompactTitle] = useState(false);
  useEffect(() => {
    const update = () => setCompactTitle((compact) => window.scrollY > 140 || (compact && window.scrollY >= 40));
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);

  const mode: IdentityMode = mapping.identityMode ?? (mapping.mappings.product_code ? "stable"
    : mapping.mappings.product_name && mapping.mappings.pack_variant ? "composite" : "stable");
  const productFields: readonly CanonicalField[] = mode === "stable" ? ["product_code"] : ["product_name", "pack_variant"];
  const supplementaryFields: readonly CanonicalField[] = mode === "stable" ? ["product_name", "pack_variant"] : ["product_code"];
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const match of Object.values(mapping.mappings)) {
      if (match) counts.set(match.sourceColumnId, (counts.get(match.sourceColumnId) ?? 0) + 1);
    }
    return counts;
  }, [mapping]);
  const conflicts = useMemo(() => detectIdentityConflicts(dataset, mapping), [dataset, mapping]);
  const bulkMapping = useMemo(() => confirmCurrentMapping(mapping), [mapping]);
  const capabilities = partitionCapabilities(evaluateCapabilities(bulkMapping ?? mapping));
  const blockers = bulkMapping ? getReadinessBlockers(bulkMapping) : ["Resolve columns used more than once"];
  const staleColumns = Object.values(mapping.mappings).some(match => match && !dataset.columns.some(column => column.id === match.sourceColumnId));
  const blocked = blockers.length > 0 || staleColumns;

  function columnFor(field: CanonicalField) {
    return dataset.columns.find(column => column.id === mapping.mappings[field]?.sourceColumnId);
  }
  function matched(field: CanonicalField) {
    const column = columnFor(field);
    return !!column && usage.get(column.id) === 1;
  }
  function warningFor(field: CanonicalField, required = false) {
    const column = columnFor(field);
    if (column && (usage.get(column.id) ?? 0) > 1) return "This column is already used above.";
    if (!column && (required || mapping.mappings[field])) return "Choose a column to continue.";
    return null;
  }
  const requiredCount = Number(matched("transaction_date")) + Number(matched("quantity_sold")) + Number(productFields.every(matched));
  const optionalCount = OPTIONAL_FIELDS.filter(([field]) => matched(field)).length;
  const totalCount = requiredCount + optionalCount;
  const totalFields = 3 + OPTIONAL_FIELDS.length;
  const unusedColumns = dataset.columns.filter(column => !usage.has(column.id));
  const otherMatchedFields = (Object.keys(mapping.mappings) as CanonicalField[])
    .filter(field => FIELD_REGISTRY[field].status === "later_locked");
  const fileType = /\.(xlsx|xls)$/i.test(dataset.sourceName) ? "XLS" : "CSV";
  const sessionNotice = props.sessionNotice && !["Sample data loaded.", "Retailer file loaded locally."].includes(props.sessionNotice)
    ? props.sessionNotice : null;

  function selectControl(field: CanonicalField, required = false) {
    const warning = warningFor(field, required);
    const id = "mapping-" + field;
    return <div className="mapping-select">
      <select id={id} value={mapping.mappings[field]?.sourceColumnId ?? ""} disabled={props.checking}
        aria-label={t(`Source column for ${FIELD_REGISTRY[field].label}`)} aria-invalid={!!warning}
        aria-describedby={warning ? id + "-warning" : undefined}
        className={!columnFor(field) ? "mapping-select--empty" : undefined}
        onChange={event => props.onSelectColumn(field, event.target.value || null)}>
        <option value="">{t("Not in this file")}</option>
        {dataset.columns.map(column => <option key={column.id} value={column.id}>{column.header}</option>)}
      </select>
      {warning && <small className="mapping-warning" id={id + "-warning"}>{t(warning)}</small>}
    </div>;
  }
  function fieldRow(field: CanonicalField, icon: "calendar" | "cart" | "box" | "document" | "truck" | "expiry" | "barcode" | "cost", description: string, required = false) {
    return <li className="mapping-row" key={field}>
      <span className="mapping-icon"><WorkflowIcon name={icon} /></span>
      <div className="mapping-label"><b>{t(FIELD_REGISTRY[field].label)}</b><small>{t(description)}</small></div>
      {selectControl(field, required)}
      <div className="mapping-preview">{formatPreview(columnFor(field)?.previewValues ?? [])}</div>
    </li>;
  }
  function productPreview() {
    if (mode === "stable") return formatPreview(columnFor("product_code")?.previewValues ?? []);
    const name = columnFor("product_name"), pack = columnFor("pack_variant");
    if (!name || !pack) return "—";
    const values = dataset.rows.slice(0, 3).map(row => [row.originalValues[name.index], row.originalValues[pack.index]].filter(Boolean).join(" · "));
    return formatPreview(values.length ? values : name.previewValues.map((value, index) => [value, pack.previewValues[index]].filter(Boolean).join(" · ")));
  }

  return <div className="mapping-screen">
    <section className={"mapping-hero" + (compactTitle ? " mapping-hero--compact" : "")} aria-labelledby="mapping-title">
      <div className="mapping-wrap mapping-hero__box">
        <div className="mapping-hero__inner">
          <div className="mapping-hero__copy">
            <p className="mapping-eyebrow"><span aria-hidden="true">🌿</span> {t("Step 2 of 3")}</p>
            <h1 id="mapping-title">{t("Check how we read your file")}</h1>
            <p className="mapping-lede">{t("We matched your columns by their names. Fix anything that's wrong, then confirm. Your file isn't changed.")}</p>
          </div>
          <div className="mapping-file" aria-label={t("Active session")}>
            <span className="mapping-file__icon" aria-hidden="true">{fileType}</span>
            <div className="mapping-file__details">
              <b title={dataset.sourceName}>{dataset.sourceName}</b>
              <small><span className="mapping-tag mapping-tag--teal">✓ {t("Read")}</span>
                {dataset.rows.length.toLocaleString(getLocale())} {t("rows ·")} {dataset.columns.length} {t("columns")}</small>
              <small><span className="mapping-tag">{t(dataset.sourceMode === "sample" ? "Sample data" : "Retailer file")}</span> {(dataset.sourceByteLength / 1024).toFixed(1)} KB</small>
              {dataset.worksheetName && <small>{t("Worksheet")}: {dataset.worksheetName}</small>}
            </div>
            <div className="mapping-file__actions">
              {props.onClear && <button type="button" onClick={props.onClear} disabled={props.checking}>{t("Clear session")}</button>}
            </div>
          </div>
        </div>
        <div className="mapping-actions">
          {props.onUndo && <button type="button" className="btn btn--ghost" onClick={props.onUndo} disabled={props.checking}>{t("Undo last match change")}</button>}
          <span className="mapping-actions__spacer" />
          <span className="mapping-total" role="status">{totalCount} {t("of")} {totalFields} {t("matched")}</span>
          <span className="mapping-meter" aria-hidden="true"><i style={{ width: (100 * totalCount / totalFields) + "%" }} /></span>
          <button type="button" className="btn btn--primary" disabled={blocked || props.checking} aria-busy={props.checking}
            onClick={props.onConfirmAllAndContinue}>{t(props.checking ? "Checking locally…" : "Confirm and check my data →")}</button>
        </div>
      </div>
    </section>
    <main className="mapping-wrap mapping-main">
      <div className="mapping-grid">
        <div className="mapping-left">
          <div className="mapping-all">
            <div><b>{t("All matches look right?")}</b><p>{t("Confirm all selected columns and continue in one step.")}</p>
              <small>{t("Products will be kept separate using:")} {t(mode === "stable" ? "One code column" : "Product name + pack size")}.</small></div>
            <button type="button" className="btn btn--primary" disabled={blocked || props.checking} aria-busy={props.checking}
              onClick={props.onConfirmAllAndContinue}>{t(props.checking ? "Checking locally…" : "Confirm all and continue →")}</button>
          </div>
          {(sessionNotice || props.notice || props.error || props.proposals?.fallbackNotice || blocked) && <div className="mapping-feedback">
            {sessionNotice && <p className="notice notice--info" role="status">{t(sessionNotice)}</p>}
            {props.proposals && !props.proposals.usedSemanticModel && props.proposals.fallbackNotice && <p className="notice notice--info">{t(props.proposals.fallbackNotice)}</p>}
            {props.notice && <p className="notice notice--info" role="status">{t(props.notice)}</p>}
            {props.error && <p className="notice notice--error" role="alert">{t(props.error)}</p>}
            {blocked && <p className="mapping-blockers" role="status">{t("Still needed: ")}{staleColumns ? t("Choose a column to continue.") : blockers.map(t).join(" · ")}</p>}
          </div>}
          <section className="mapping-card" aria-labelledby="mapping-required">
            <div className="mapping-card__head"><span className="mapping-icon mapping-icon--solid"><WorkflowIcon name="leaf" /></span>
              <div><h2 id="mapping-required">{t("Required")}</h2><p>{t("Needed to continue")}</p></div>
              <span className={"mapping-pill" + (requiredCount === 3 ? " mapping-pill--ok" : " mapping-pill--missing")}>{requiredCount} {t("of")} 3 {t("matched")}{requiredCount === 3 ? " ✓" : ""}</span>
            </div>
            <ul className="mapping-list">
              {fieldRow("transaction_date", "calendar", "When each sale or return happened", true)}
              <li className="mapping-row mapping-product">
                <span className="mapping-icon"><WorkflowIcon name="barcode" /></span>
                <div className="mapping-label"><b>{t("Product")}</b><small>{t("How we tell products and pack sizes apart")}</small>
                  <div className="mapping-segment" role="group" aria-label={t("Identify your products")}>
                    <button type="button" aria-pressed={mode === "stable"} disabled={props.checking} onClick={() => props.onSelectIdentity("stable")}>{t("Product code")}</button>
                    <button type="button" aria-pressed={mode === "composite"} disabled={props.checking} onClick={() => props.onSelectIdentity("composite")}>{t("Name + pack size")}</button>
                  </div>
                </div>
                <div className="mapping-product__selects">
                  {productFields.map(field => <div key={field}>{mode === "composite" && <label htmlFor={"mapping-" + field}>{t(FIELD_REGISTRY[field].label)}</label>}{selectControl(field, true)}</div>)}
                </div>
                <div className="mapping-preview">{productPreview()}</div>
                <details className="mapping-product__more" open={supplementaryFields.some(field => warningFor(field)) || undefined}>
                  <summary>{t(mode === "stable" ? "Product name and pack size" : "Product code (optional)")}</summary>
                  <p>{t("Keep these details for product names, pack sizes and identity checks.")}</p>
                  {supplementaryFields.map(field => <div className="mapping-product__detail" key={field}>
                    <label htmlFor={"mapping-" + field}>{t(FIELD_REGISTRY[field].label)}</label>
                    {selectControl(field)}<span className="mapping-preview">{formatPreview(columnFor(field)?.previewValues ?? [])}</span>
                  </div>)}
                </details>
              </li>
              {fieldRow("quantity_sold", "cart", "Units sold, or returned as negative numbers", true)}
            </ul>
          </section>
          <section className="mapping-card" aria-labelledby="mapping-optional">
            <div className="mapping-card__head"><span className="mapping-icon mapping-icon--amber" aria-hidden="true">🪴</span>
              <div><h2 id="mapping-optional">{t("Optional")}</h2><p>{t('Each one adds to your results. Choose "Not in this file" to skip.')}</p></div>
              <span className={"mapping-pill" + (optionalCount === OPTIONAL_FIELDS.length ? " mapping-pill--ok" : "")}>{optionalCount} {t("of")} {OPTIONAL_FIELDS.length} {t("matched")}</span>
            </div>
            <ul className="mapping-list">
              {OPTIONAL_FIELDS.map(([field, icon, description]) => fieldRow(field, icon, description))}
            </ul>
          </section>
          <section className="mapping-unused" aria-labelledby="mapping-unused-title">
            <h3 id="mapping-unused-title">{t("Columns we won't use")}</h3>
            {unusedColumns.length ? <ul>{unusedColumns.map(column => <li key={column.id}>{column.header}</li>)}</ul> : <p>{t("All columns are matched.")}</p>}
            <p>{t("These columns are not mapped to an analysis field. They remain in the source records and help distinguish exact duplicates.")}</p>
          </section>
          {otherMatchedFields.length > 0 && <details className="mapping-additional"
            open={otherMatchedFields.some(field => warningFor(field)) || undefined}>
            <summary>{t("Other matched columns")}</summary>
            <p>{t("These extra suggestions are kept for later steps. You can change or clear them.")}</p>
            {otherMatchedFields.map(field => <div className="mapping-product__detail" key={field}>
              <label htmlFor={"mapping-" + field}>{t(FIELD_REGISTRY[field].label)}</label>
              {selectControl(field)}<span className="mapping-preview">{formatPreview(columnFor(field)?.previewValues ?? [])}</span>
            </div>)}
          </details>}
          {conflicts.length > 0 && <div className="alert alert--warn" role="alert">
            <span className="alert__icon alert__icon--warn" aria-hidden="true">!</span><div>
              <p className="alert__title">{t(conflicts.length === 1 ? "One identity conflict" : `${conflicts.length} identity conflicts`)}</p>
              <ul className="alert__list">{conflicts.slice(0, 4).map(conflict => <li key={`${conflict.code}-${conflict.productHint}`}>
                <b>{conflict.productHint}</b> {t(conflict.code === "CODE_TO_MULTIPLE_NAMES" ? "has more than one product name" : conflict.code === "CODE_TO_MULTIPLE_PACKS" ? "covers more than one pack size" : "maps to more than one product code")}: {conflict.values.join(", ")} {t("(rows")} {conflict.sourceRows.slice(0, 6).join(", ")}{conflict.sourceRows.length > 6 ? "…" : ""})
              </li>)}</ul></div>
          </div>}
          <div className="mapping-saved-controls">{props.children}</div>
        </div>
        <aside className="mapping-help mapping-card">
          <h2><span aria-hidden="true">🌱</span> {t("Check your data")}</h2><p>{t("Review your columns and make sure StockLess has the information it needs.")}</p>
          <ol>{["Read your column names", "Match each column to a StockLess field", "Review the data preview", "Confirm your column mappings"].map((label, index) => <li key={label}><span className="mapping-help__number" aria-hidden="true">{index + 1}</span><span>{t(label)}</span></li>)}</ol>
          <h3>{t("Identify your products")}</h3><p>{t("Choose how StockLess should tell your products apart.")}</p>
          <ol>{[["One code column", "SKU, barcode or product code"], ["Product name + pack size", "Product Name + Pack Variant"]].map(([label, description], index) => <li key={label}><span className="mapping-help__number" aria-hidden="true">{index + 1}</span><span><b>{t(label)}</b><small>{t(description)}</small></span></li>)}</ol>
          <div className="mapping-more"><b>{t("Add more, see more")}</b><small>{t("Confirm these columns to unlock:")}</small>
            <p><b>{t("Sale date + Quantity sold")}</b><small>{t("Weeks of cover, recent weekly average, missing-week check, weekly product history")}</small></p>
            <p><b>{t("Stock on hand + Stock count date")}</b><small>{t("Weeks of cover, purchase check, stock freshness")}</small></p>
            <p><b>{t("Expiry date")}</b><small>{t("Expiry-aware note")}</small></p>
          </div>
          <section aria-label={t("Available analyses")}><h3>{t("Available analyses")}</h3><p>{t("Selected columns support these analyses after Step 3 validation.")}</p><ul>{capabilities.availableNow.map(item => <li key={item.capability}>{t(item.label)}</li>)}</ul><h3>{t("Needs more information")}</h3><ul>{capabilities.needsMoreInformation.map(item => <li key={item.capability}><b>{t(item.label)}</b><small>{item.reasons.map(reason => t(reason.message)).join(" ")}</small></li>)}</ul></section>
          <p className="mapping-privacy"><span aria-hidden="true">🔒</span> {t("Processed in your browser, never uploaded.")}</p>
        </aside>
      </div>
    </main>
  </div>;
}

/** Formats previews without changing the original records or translating product values. */
function formatPreview(values: readonly string[]): string {
  return values.filter(value => value.trim() !== "").slice(0, 5).join(" · ") || "—";
}
