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
  type MappingProposal,
  type MappingProposalResult,
  type MappingState,
  type ParsedDataset,
  type CapabilityResult,
} from "../engine.ts";

interface MappingScreenProps {
  readonly dataset: ParsedDataset;
  readonly mapping: MappingState;
  readonly proposals: MappingProposalResult | null;
  readonly onSelectColumn: (field: CanonicalField, sourceColumnId: string | null) => void;
  readonly onConfirmField: (field: CanonicalField) => void;
  readonly onConfirmIdentity: (mode: "stable" | "composite") => void;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  readonly error: string | null;
  readonly checking?: boolean;
}

const BAND_LABEL: Readonly<Record<MappingProposal["scoreBand"], string>> = {
  exact_alias: "Exact alias",
  high: "Likely match",
  unconfirmed: "Needs a choice",
};

/** Screen 02. Every mapping starts unconfirmed; the retailer confirms each one. */
export function MappingScreen(props: MappingScreenProps) {
  const { dataset, mapping, proposals } = props;

  const fields = useMemo(
    () => CANONICAL_FIELDS.filter((field) => FIELD_REGISTRY[field].status !== "later_locked"),
    [],
  );

  const proposalByField = useMemo(() => {
    const map = new Map<CanonicalField, MappingProposal>();
    for (const proposal of proposals?.proposals ?? []) map.set(proposal.targetField, proposal);
    return map;
  }, [proposals]);

  const capabilities = useMemo(() => partitionCapabilities(evaluateCapabilities(mapping)), [mapping]);
  const conflicts = useMemo(() => detectIdentityConflicts(dataset, mapping), [dataset, mapping]);
  const blockers = useMemo(() => getReadinessBlockers(mapping), [mapping]);

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
      <p className="eyebrow">Confirm what your columns mean</p>
      <h1 className="title">
        We found likely matches.
        <br />
        Check them before continuing.
      </h1>
      <p className="lede">
        Your original file is not changed. Mapping only tells StockLess how to interpret it during
        this session.
      </p>

      <div className="filebar">
        <div className="filebar__left">
          <span className="filebar__icon" aria-hidden="true">CSV</span>
          <div>
            <div className="filebar__name">{dataset.sourceName}</div>
            <div className="filebar__meta">
              {dataset.rows.length.toLocaleString("en")} rows · {dataset.columns.length} columns ·{" "}
              {(dataset.sourceByteLength / 1024).toFixed(1)} KB · delimiter{" "}
              {dataset.delimiter === "\t" ? "tab" : dataset.delimiter}
            </div>
          </div>
        </div>
        <span className="pill pill--teal">✓ Read successfully</span>
      </div>

      {proposals && !proposals.usedSemanticModel && proposals.fallbackNotice && (
        <p className="notice notice--info">{proposals.fallbackNotice}</p>
      )}

      <div className="split">
        <section className="card split__main">
          <div className="card__head">
            <div>
              <h2 className="card-title">Column mapping</h2>
              <p className="card-sub">
                Nothing is applied until you confirm it. Transaction date, quantity sold and a
                product identity are required.
              </p>
            </div>
            <span className={`pill ${confirmedCount === fields.length ? "pill--teal" : "pill--grey"}`}>
              {confirmedCount} of {fields.length} confirmed
            </span>
          </div>

          <div className="table-scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th style={{ width: "28%" }}>StockLess field</th>
                  <th style={{ width: "27%" }}>Your column</th>
                  <th style={{ width: "25%" }}>Preview</th>
                  <th style={{ width: "20%" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => {
                  const definition = FIELD_REGISTRY[field];
                  const proposal = proposalByField.get(field);
                  const current = mapping.mappings[field];
                  const column = dataset.columns.find((c) => c.id === current?.sourceColumnId);
                  const required = definition.status === "core";

                  return (
                    <tr key={field}>
                      <td>
                        <b className="dtable__label">{definition.label}</b>
                        {required && <span className="req">Required</span>}
                        <div className="dtable__hint">{definition.description}</div>
                      </td>
                      <td>
                        <select
                          className="select"
                          aria-label={`Source column for ${definition.label}`}
                          value={current?.sourceColumnId ?? ""}
                          onChange={(event) =>
                            props.onSelectColumn(field, event.target.value || null)
                          }
                        >
                          <option value="">Not in this file</option>
                          {dataset.columns.map((sourceColumn) => (
                            <option key={sourceColumn.id} value={sourceColumn.id}>
                              {sourceColumn.header}
                            </option>
                          ))}
                        </select>
                        {proposal?.reason && !current?.confirmed && (
                          <div className="dtable__hint">{proposal.reason}</div>
                        )}
                      </td>
                      <td className="num">
                        {column ? column.previewValues.slice(0, 5).join(" · ") || "—" : "—"}
                      </td>
                      <td>
                        {current?.confirmed ? (
                          <span className="pill pill--teal">Confirmed</span>
                        ) : current ? (
                          <div className="mapping-status">
                            <button
                              type="button"
                              className="btn btn--small btn--ghost"
                              onClick={() => props.onConfirmField(field)}
                            >
                              Confirm
                            </button>
                            {proposal && (
                              <small>
                                {BAND_LABEL[proposal.scoreBand]}
                                {proposal.score === undefined ? "" : ` · ${Math.round(proposal.score * 100)}%`}
                              </small>
                            )}
                          </div>
                        ) : (
                          <span className="pill pill--grey">
                            {proposal
                              ? `${BAND_LABEL[proposal.scoreBand]}${proposal.score === undefined ? "" : ` · ${Math.round(proposal.score * 100)}%`}`
                              : "Not mapped"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="identity">
            <h3 className="identity__title">How should products be kept separate?</h3>
            <p className="identity__lede">
              Pick one path and confirm it. This choice is recorded as evidence for the rest of the
              session.
            </p>
            <div className="identity__paths">
              {CORE_COLUMN_PATHS.map((path) => {
                const ready = identityPathReady(path.id);
                const chosen = mapping.identityMode === path.id && mapping.identityConfirmed;
                return (
                  <div key={path.id} className={`identity__path${chosen ? " identity__path--on" : ""}`}>
                    <div className="identity__path-name">{path.label}</div>
                    <div className="identity__path-fields">
                      {path.requiredFields
                        .filter((f) => f !== "transaction_date" && f !== "quantity_sold")
                        .map((f) => FIELD_REGISTRY[f].label)
                        .join(" + ")}
                    </div>
                    <button
                      type="button"
                      className={`btn btn--small ${chosen ? "btn--ghost" : "btn--primary"}`}
                      disabled={!ready || chosen}
                      onClick={() => props.onConfirmIdentity(path.id)}
                    >
                      {chosen ? "Confirmed" : ready ? "Use this path" : "Confirm its columns first"}
                    </button>
                  </div>
                );
              })}
            </div>

            {conflicts.length > 0 && (
              <div className="alert alert--warn" role="alert">
                <span className="alert__icon alert__icon--warn" aria-hidden="true">!</span>
                <div>
                  <p className="alert__title">
                    {conflicts.length === 1 ? "One identity conflict" : `${conflicts.length} identity conflicts`}
                  </p>
                  <ul className="alert__list">
                    {conflicts.slice(0, 4).map((conflict) => (
                      <li key={`${conflict.code}-${conflict.productHint}`}>
                        <b>{conflict.productHint}</b>{" "}
                        {conflict.code === "CODE_TO_MULTIPLE_VARIANTS"
                          ? "covers more than one pack variant"
                          : "maps to more than one product code"}
                        : {conflict.values.join(", ")} (rows{" "}
                        {conflict.sourceRows.slice(0, 6).join(", ")}
                        {conflict.sourceRows.length > 6 ? "…" : ""})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {props.error && <p className="notice notice--error" role="alert">{props.error}</p>}
        </section>

        <aside className="panel-dark">
          <h2>This file unlocks</h2>
          <p className="panel-dark__lede">
            Capabilities follow the columns you confirmed, not the column names themselves.
          </p>

          <CapabilityGroup title="Available now" tone="on" items={capabilities.availableNow} />
          <CapabilityGroup title="Needs more information" tone="off" items={capabilities.needsMoreInformation} />
          <CapabilityGroup title="Locked until iteration 2" tone="locked" items={capabilities.locked} />
        </aside>
      </div>

      <div className="footer-row">
        <button type="button" className="btn--link" onClick={props.onBack}>
          ← Choose another file
        </button>
        <div className="footer-row__right">
          {blockers.length > 0 && (
            <p className="blockers">Still needed: {blockers.join(" · ")}</p>
          )}
          <button
            type="button"
            className="btn btn--primary"
            disabled={blockers.length > 0 || props.checking}
            onClick={props.onContinue}
          >
            {props.checking ? "Checking locally…" : "Run readiness check →"}
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
  if (items.length === 0) return null;
  return (
    <>
      <p className="panel-dark__eyebrow">{title}</p>
      {items.map((item) => (
        <div className="unlock" key={item.capability}>
          <span className={`unlock__tick unlock__tick--${tone}`} aria-hidden="true">
            {tone === "on" ? "✓" : tone === "locked" ? "‧" : "?"}
          </span>
          <span>
            {item.label}
            {item.state === "limited" && <em className="unlock__state"> · limited</em>}
            {item.reasons.length > 0 && tone !== "on" && (
              <span className="unlock__reason">{item.reasons[0]?.message}</span>
            )}
          </span>
        </div>
      ))}
    </>
  );
}
