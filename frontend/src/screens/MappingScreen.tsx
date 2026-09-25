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
  type CapabilityResult,
} from "../engine.ts";
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

  const capabilities = useMemo(() => partitionCapabilities(evaluateCapabilities(mapping)), [mapping]);
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
      <p className="eyebrow">{t("Confirm what your columns mean")}</p>
      <h1 className="title">
        {t("We found likely matches.")}<br />
        {t("Check them before continuing.")}</h1>
      <p className="lede">
        {t("Your original file is not changed. Mapping only tells StockLess how to interpret it during this session.")}</p>

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
              {t(props.checking ? "Checking locally…" : "Looks well, next step")}
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
                        <b className="dtable__label">{t(definition.label)}</b>
                        {t(required && <span className="req">{t("Required")}</span>)}
                        <div className="dtable__hint">{t(definition.description)}</div>
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
                        {column ? column.previewValues.slice(0, 5).join(" · ") || "—" : "—"}
                      </td>
                      <td>
                        {t(current?.confirmed ? (
                          <span className="pill pill--teal">{t("Confirmed")}</span>
                        ) : current ? (
                          <div className="mapping-status">
                            <span className="pill pill--amber">{t("Suggested — please check")}</span>
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
            <h3 className="identity__title">{t("How should products be kept separate?")}</h3>
            <p className="identity__lede">
              {t("Pick one path and confirm it. This choice is recorded as evidence for the rest of the session.")}</p>
            <div className="identity__paths">
              {t(CORE_COLUMN_PATHS.map((path) => {
                const ready = identityPathReady(path.id);
                const chosen = mapping.identityMode === path.id && mapping.identityConfirmed;
                return (
                  <div key={path.id} className={`identity__path${chosen ? " identity__path--on" : ""}`}>
                    <div className="identity__path-name">{t(path.label)}</div>
                    <div className="identity__path-fields">
                      {t(path.requiredFields
                        .filter((f) => f !== "transaction_date" && f !== "quantity_sold")
                        .map((f) => t(FIELD_REGISTRY[f].label))
                        .join(" + "))}
                    </div>
                    <button
                      type="button"
                      className={`btn btn--small ${chosen ? "btn--ghost" : "btn--primary"}`}
                      disabled={!ready || chosen || props.checking}
                      onClick={() => props.onConfirmIdentity(path.id)}
                    >
                      {t(chosen ? "Confirmed" : ready ? "Use this path" : "Confirm its columns first")}
                    </button>
                  </div>
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

        <aside className="panel-dark">
          <h2>{t("This file unlocks")}</h2>
          <p className="panel-dark__lede">
            {t("Capabilities follow the columns you confirmed, not the column names themselves.")}</p>

          <CapabilityGroup title={t("You can do this now")} tone="on" items={capabilities.availableNow} />
          <CapabilityGroup title={t("Needs more information")} tone="off" items={capabilities.needsMoreInformation} />
          <CapabilityGroup title={t("Locked until iteration 3")} tone="locked" items={capabilities.locked} />
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
            {t(props.checking ? "Checking locally…" : "Run readiness check →")}
          </button>
        </div>
      </div>
    </>
  );
}

/** Renders one capability section with its engine-supplied reasons. */
function CapabilityGroup({
  title,
  tone,
  items,
}: {
  readonly title: string;
  readonly tone: "on" | "off" | "locked";
  readonly items: readonly CapabilityResult[];
}) {
  useLanguage();
  if (items.length === 0) return null;
  return (
    <>
      <p className="panel-dark__eyebrow">{t(title)}</p>
      {t(items.map((item) => (
        <div className="unlock" key={item.capability}>
          <span className={`unlock__tick unlock__tick--${tone}`} aria-hidden="true">
            {t(tone === "on" ? "✓" : tone === "locked" ? "‧" : "?")}
          </span>
          <span>
            {t(item.label)}
            {t(item.state === "limited" && <em className="unlock__state"> {t("· Limited data")}</em>)}
            {t(item.reasons.length > 0 && tone !== "on" && (
              <span className="unlock__reason">{t(item.reasons[0]?.message)}</span>
            ))}
          </span>
        </div>
      )))}
    </>
  );
}
