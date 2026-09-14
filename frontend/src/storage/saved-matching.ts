import {
  confirmIdentityMode,
  confirmMapping,
  recordConfirmedIdentity,
  setMapping,
  updateSessionMapping,
  type CanonicalField,
  type MappingState,
  type SessionEnvelope,
} from "../engine.ts";
import { withStore } from "./browser-db.ts";

/** US7.1: one saved column matching per file shape. Nothing from the file's rows is kept. */
export interface MappingTemplate {
  /** Every column heading of the file, trimmed and sorted, as a JSON array. */
  readonly headersKey: string;
  readonly savedAt: string;
  /** Column heading → StockLess attribute, for every match that was confirmed. */
  readonly rules: Readonly<Record<string, CanonicalField>>;
  /** How products were kept separate: one code column, or product name together with pack size. */
  readonly identityMode?: MappingState["identityMode"];
}

/** Saves the confirmed matches for this file shape, replacing an earlier save for the same headings. */
export async function saveMatching(envelope: SessionEnvelope): Promise<boolean> {
  const { dataset, mapping } = envelope.session;
  if (!dataset || dataset.sourceMode === "sample") return false;

  const rules: Record<string, CanonicalField> = {};
  for (const match of Object.values(mapping.mappings)) {
    const column = dataset.columns.find((candidate) => candidate.id === match?.sourceColumnId);
    if (match?.confirmed && column) rules[column.normalizedHeader] = match.targetField;
  }
  const template: MappingTemplate = {
    headersKey: JSON.stringify(dataset.columns.map((column) => column.normalizedHeader).sort()),
    savedAt: new Date().toISOString(),
    rules,
    identityMode: mapping.identityConfirmed ? mapping.identityMode : undefined,
  };
  return withStore("mapping_templates", "readwrite", (store) => store.put(template)).then(() => true, () => false);
}

/**
 * Fills in, unconfirmed, the most recently saved matching whose every column is in this file,
 * together with its saved way of keeping products separate.
 *
 * Resolves null when nothing is saved (or for the sample), so the usual suggestions run.
 * When matchings are saved but none fits, the mapping stays blank for manual selection.
 */
export async function loadSavedMatching(
  envelope: SessionEnvelope,
): Promise<{ readonly envelope: SessionEnvelope; readonly offered: boolean } | null> {
  const dataset = envelope.session.dataset;
  if (!dataset || dataset.sourceMode === "sample") return null;

  const templates = await withStore<MappingTemplate[]>("mapping_templates", "readonly", (store) => store.getAll())
    .catch((): MappingTemplate[] => []);
  if (templates.length === 0) return null;

  const columnIdByHeader = new Map(dataset.columns.map((column) => [column.normalizedHeader, column.id] as const));
  const template = templates
    .filter((candidate) => Object.keys(candidate.rules).every((header) => columnIdByHeader.has(header)))
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0];
  if (!template) return { envelope, offered: false };

  let mapping: MappingState = Object.freeze({ ...envelope.session.mapping, identityMode: template.identityMode });
  for (const [header, field] of Object.entries(template.rules)) {
    mapping = setMapping(mapping, field, columnIdByHeader.get(header)!, false);
  }
  return { envelope: updateSessionMapping(envelope, mapping), offered: true };
}

/** Confirms every filled-in match, then the saved way of keeping products separate. */
export function confirmAll(mapping: MappingState): MappingState {
  let next = mapping;
  for (const field of Object.keys(next.mappings) as CanonicalField[]) {
    if (next.mappings[field]?.confirmed === false) next = confirmMapping(next, field);
  }
  if (!next.identityMode || next.identityConfirmed) return next;
  try {
    return confirmIdentityMode(next, next.identityMode);
  } catch {
    // Its columns are no longer all matched, so the retailer picks a path by hand.
    return next;
  }
}

/** "Confirm all" as one action, recording the identity choice as a manual confirmation does. */
export function confirmAllMatches(envelope: SessionEnvelope): SessionEnvelope {
  const mapping = confirmAll(envelope.session.mapping);
  const next = updateSessionMapping(envelope, mapping);
  return mapping.identityConfirmed && !envelope.session.mapping.identityConfirmed ? recordConfirmedIdentity(next) : next;
}
