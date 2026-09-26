import { t, useLanguage } from "../i18n/index.ts";
import { useMemo } from "react";
import {
  CANONICAL_FIELDS,
  CORE_COLUMN_PATHS,
  FIELD_REGISTRY,
  detectIdentityConflicts,
  evaluateCapabilities,
  getReadinessBlockers,
  partitionCapabilities,
  type CanonicalField,
  type MappingProposalResult,
  type MappingState,
  type ParsedDataset,
} from "../engine.ts";
import { FieldHelp } from "../components/FieldHelp.tsx";
import { confirmCurrentMapping } from "../storage/saved-matching.ts";

interface MappingScreenProps {
  readonly dataset: ParsedDataset;
  readonly mapping: MappingState;
  readonly proposals: MappingProposalResult | null;
  readonly onSelectColumn: (field: CanonicalField, sourceColumnId: string | null) => void;
  readonly onConfirmField: (field: CanonicalField) => void;
  readonly onConfirmIdentity: (mode: "stable" | "composite") => void;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  readonly onConfirmAllAndContinue: () => void;
  readonly error: string | null;
  readonly notice: string | null;
  readonly checking?: boolean;
}

/** Screen 02. Every mapping starts unconfirmed; the retailer confirms each one. */
export function MappingScreen(props: MappingScreenProps) {
  useLanguage();
  const { dataset, mapping, proposals } = props;

  const fields = useMemo(
    () => CANONICAL_FIELDS.filter((field) => FIELD_REGISTRY[field].status !== "later_locked"),
    [],
  );

  const missingInformation = useMemo(() => {
    const grouped = new Map<string, { fields: string[]; analyses: string[] }>();
    const byField = new Map<string, Set<string>>();
    for (const item of partitionCapabilities(evaluateCapabilities(mapping)).needsMoreInformation) {
      for (const reason of item.reasons) {
        if (!reason.field) continue;
        const labels = byField.get(reason.field) ?? new Set<string>();
        labels.add(item.label);
        byField.set(reason.field, labels);
      }
    }
    for (const [field, labels] of byField) {
      const analyses = [...labels].sort();
      const key = analyses.join('|');
      const entry = grouped.get(key) ?? { fields: [], analyses };
      entry.fields.push(FIELD_REGISTRY[field as CanonicalField].label);
      grouped.set(key, entry);
    }
    return [...grouped.values()];
  }, [mapping]);
  const conflicts = useMemo(() => detectIdentityConflicts(dataset, mapping), [dataset, mapping]);
  const blockers = useMemo(() => getReadinessBlockers(mapping), [mapping]);

  const bulkMapping = useMemo(() => confirmCurrentMapping(mapping), [mapping]);
  const bulkBlockers = bulkMapping ? getReadinessBlockers(bulkMapping) : ["Resolve columns used more than once"];
  const bulkPath = CORE_COLUMN_PATHS.find((path) => path.id === bulkMapping?.identityMode);
  const confirmedCount = fields.filter((field) => mapping.mappings[field]?.confirmed).length;

  function identityPathReady(mode: "stable" | "composite"): boolean {
    const path = CORE_COLUMN_PATHS.find((candidate) => candidate.id === mode);
    if (!path) return false;
    return path.requiredFields
      .filter((field) => field !== "transaction_date" && field !== "quantity_sold")
      .every((field) => mapping.mappings[field]?.confirmed);
  }

  return (
    <>
      <p className="eyebrow">{t("Make sure StockLess understands your data")}</p>
      <h1 className="title">
        {t("We found your data. Let's make sure it's right.")}</h1>
      <p className="lede">
        {t("Review the suggested column matches before continuing. Your original file won't be changed.")}</p>

      <div className="filebar">
        <div className="filebar__left">
          <span className="filebar__icon" aria-hidden="true">{t("CSV")}</span>
          <div>
            <div className="filebar__name">{dataset.sourceName}</div>
            <div className="filebar__meta">
              {t(dataset.rows.length.toLocaleString("en"))} {t("rows · ")}{t(dataset.columns.length)} {t("columns ·")}{t(" ")}
              {t((dataset.sourceByteLength / 1024).toFixed(1))} {t("KB · delimiter")}{t(" ")}
              {t(dataset.delimiter === "\t" ? "tab" : dataset.delimiter)}
            </div>
          </div>
        </div>
        <span className="pill pill--teal">{t("✓ Read successfully")}</span>
      </div>

      {t(proposals && !proposals.usedSemanticModel && proposals.fallbackNotice && (
        <p className="notice notice--info">{t(proposals.fallbackNotice)}</p>
      ))}

      <div className="split">
        <section className="card split__main">
          <div className="card__head">
            <div>
              <h2 className="card-title">{t("Column mapping")}</h2>
              <p className="card-sub">
                {t("Nothing is applied until you confirm it. Sale date, quantity sold and how your products are named or coded are required.")}</p>
            </div>
            <span className={`pill ${confirmedCount === fields.length ? "pill--teal" : "pill--grey"}`}>
              {t(confirmedCount)} {t("of ")}{t(fields.length)} {t("confirmed")}</span>
          </div>

          <div className="mapping-bulk">
            <div>
              <b>{t("All matches look right?")}</b>
              <p>{t("Confirm all selected columns and continue in one step.")}</p>
              {t(bulkPath && <small>{t("Products will be kept separate using: ")}{t(bulkPath.label)}.</small>)}
              {t(bulkBlockers.length > 0 && <small role="status">{t("Still needed: ")}{t(bulkBlockers.map(t).join(" · "))}</small>)}
            </div>
            <button type="button" className="btn btn--primary"
              disabled={bulkBlockers.length > 0 || props.checking}
              aria-busy={props.checking} onClick={props.onConfirmAllAndContinue}>
              {t(props.checking ? "Checking locally…" : "Confirm all and continue →")}
            </button>
          </div>
          <div className="table-scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th style={{ width: "28%" }}>{t("StockLess field")}</th>
                  <th style={{ width: "27%" }}>{t("Your column")}</th>
                  <th style={{ width: "25%" }}>{t("Preview")}</th>
                  <th style={{ width: "20%" }}>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => {
                  const definition = FIELD_REGISTRY[field];
                  const current = mapping.mappings[field];
                  const column = dataset.columns.find((c) => c.id === current?.sourceColumnId);
                  const required = definition.status === "core";

                  return (
                    <tr key={field}>
                      <td>
                        <div className="field-head"><b className="dtable__label">{t(definition.label)}</b>
                        <FieldHelp description={t(definition.description)} />
                        {required && <span className="req">{t("Required")}</span>}</div>
                      </td>
                      <td>
                        <select
                          className="select"
                          disabled={props.checking}
                          aria-label={t(`Source column for ${definition.label}`)}
                          value={current?.sourceColumnId ?? ""}
                          onChange={(event) =>
                            props.onSelectColumn(field, event.target.value || null)
                          }
                        >
                          <option value="">{t("Not in this file")}</option>
                          {dataset.columns.map((sourceColumn) => (
                            <option key={sourceColumn.id} value={sourceColumn.id}>
                              {sourceColumn.header}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="num">
                        {column ? formatPreview(column.previewValues) : "—"}
                      </td>
                      <td>
                        {t(current?.confirmed ? (
                          <span className="pill pill--confirmed">{t("✓ Confirmed")}</span>
                        ) : current ? (
                          <div className="mapping-status">
                            <span className="pill pill--amber">{t("Please confirm")}</span>
                            <button
                              type="button"
                              className="btn btn--small btn--ghost"
                              disabled={props.checking}
                              onClick={() => props.onConfirmField(field)}
                            >
                              {t("Confirm")}</button>
                          </div>
                        ) : (
                          <span className="pill pill--grey">{t("Not matched yet")}</span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="identity">
            <h3 className="identity__title">{t("How should StockLess identify your products?")}</h3>
            <p className="identity__lede">
              {t("Choose how each product should be identified in your sales data.")}</p>
            <div className="identity__paths">
              {t(CORE_COLUMN_PATHS.map((path) => {
                const ready = identityPathReady(path.id);
                const chosen = mapping.identityMode === path.id && mapping.identityConfirmed;
                return (
                  <button key={path.id} type="button" className={`identity__path${chosen ? " identity__path--on" : ""}`}
                    aria-pressed={chosen} disabled={!ready || props.checking}
                    onClick={() => props.onConfirmIdentity(path.id)}>
                    <span className="identity__path-name"><span className="identity__path-number" aria-hidden="true">{path.id === 'stable' ? 1 : 2}</span>{t(path.label)}</span>
                    <span className="identity__path-fields">{t(path.detail)}</span>
                    <span className="identity__path-state">{t(chosen ? "✓ Selected" : ready ? "Use this option" : "Confirm its columns first")}</span>
                  </button>
                );
              }))}
            </div>

            {conflicts.length > 0 && (
              <div className="alert alert--warn" role="alert">
                <span className="alert__icon alert__icon--warn" aria-hidden="true">!</span>
                <div>
                  <p className="alert__title">
                    {t(conflicts.length === 1 ? "One identity conflict" : `${conflicts.length} identity conflicts`)}
                  </p>
                  <ul className="alert__list">
                    {conflicts.slice(0, 4).map((conflict) => (
                      <li key={`${conflict.code}-${conflict.productHint}`}>
                        <b>{conflict.productHint}</b>{t(" ")}
                        {t(conflict.code === "CODE_TO_MULTIPLE_VARIANTS"
                          ? "covers more than one pack size"
                          : "maps to more than one product code")}
                        : {t(conflict.values.join(", "))} {t("(rows")}{t(" ")}
                        {conflict.sourceRows.slice(0, 6).join(", ")}
                        {conflict.sourceRows.length > 6 ? "…" : ""})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {t(props.notice && <p className="notice notice--info" role="status">{t(props.notice)}</p>)}
          {t(props.error && <p className="notice notice--error" role="alert">{t(props.error)}</p>)}
        </section>

        <aside className="panel-sage">
          <h2 className="panel-sage__title"><span aria-hidden="true">🌱</span>{t("Check your data")}</h2>
          <p className="panel-sage__lede">{t("Review your columns and make sure StockLess has the information it needs.")}</p>
          <ol className="sage-steps">{["Read your column names", "Match each column to a StockLess field", "Review the data preview", "Confirm your column mappings"].map(label => <li key={label}>{t(label)}</li>)}</ol>
          <h3 className="panel-sage__subtitle">{t("Identify your products")}</h3>
          <p className="panel-sage__lede">{t("Choose how StockLess should tell your products apart.")}</p>
          <ol className="sage-formats">{CORE_COLUMN_PATHS.map(path => <li key={path.id}><b>{t(path.label)}</b><span>{t(path.hint)}</span></li>)}</ol>
          {missingInformation.length > 0 && <div className="unlocks">
            <h3 className="unlocks__title">{t("Add more, see more")}</h3>
            <p className="unlocks__lede">{t("Confirm these columns to unlock:")}</p>
            <ul className="unlocks__list">{missingInformation.map(group => <li key={group.fields.join('|')}><b>{group.fields.map(t).join(' + ')}</b><span>{group.analyses.map(t).join(', ')}</span></li>)}</ul>
          </div>}
          <p className="panel-sage__privacy"><span className="panel-sage__lock" aria-hidden="true">🔒</span><span><b>{t("Your data stays on your device.")}</b>{t("Your file is processed directly in your browser. Your sales data and product information are not uploaded to an AI or API service.")}</span></p>
        </aside>
      </div>

      <div className="footer-row">
        <button type="button" className="btn--link" onClick={props.onBack}>
          {t("← Choose another file")}</button>
        <div className="footer-row__right">
          {t(blockers.length > 0 && (
            <p className="blockers">{t("Still needed: ")}{t(blockers.map(t).join(" · "))}</p>
          ))}
          <button
            type="button"
            className="btn btn--primary"
            disabled={blockers.length > 0 || props.checking}
            onClick={props.onContinue}
            aria-busy={props.checking}
          >
            {t(props.checking && <span className="btn__spinner" aria-hidden="true" />)}
            {t(props.checking ? "Checking locally…" : "Check my data →")}
          </button>
        </div>
      </div>
    </>
  );
}

/** Preview only: this does not normalise or modify source records. */
function formatPreview(values: readonly string[]): string {
 const unique = [...new Set(values.map(value => value.trim()).filter(Boolean))].slice(0, 3);
 const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 return unique.map(value => {
   const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
   if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return value;
   return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
 }).join(' · ') || '—';
}
