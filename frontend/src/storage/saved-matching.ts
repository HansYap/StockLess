import {
  confirmMapping,
  setMapping,
  updateSessionMapping,
  type CanonicalField,
  type SessionEnvelope,
} from "../engine.ts";
import { withStore } from "./browser-db.ts";

/** US7.1: one saved column matching per file shape. Only column headings are kept. */
export interface MappingTemplate {
  /** Every column heading of the file, trimmed and sorted, as a JSON array. */
  readonly headersKey: string;
  readonly savedAt: string;
  /** Column heading → StockLess attribute, for every match that was confirmed. */
  readonly rules: Readonly<Record<string, CanonicalField>>;
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
  };
  return withStore("mapping_templates", "readwrite", (store) => store.put(template)).then(() => true, () => false);
}

/**
 * Fills in, unconfirmed, the most recently saved matching whose every column is in this file.
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

  let mapping = envelope.session.mapping;
  for (const [header, field] of Object.entries(template.rules)) {
    mapping = setMapping(mapping, field, columnIdByHeader.get(header)!, false);
  }
  return { envelope: updateSessionMapping(envelope, mapping), offered: true };
}

/** Confirms every filled-in match in one action. */
export function confirmAllMatches(envelope: SessionEnvelope): SessionEnvelope {
  let mapping = envelope.session.mapping;
  for (const field of Object.keys(mapping.mappings) as CanonicalField[]) {
    if (mapping.mappings[field]?.confirmed === false) mapping = confirmMapping(mapping, field);
  }
  return updateSessionMapping(envelope, mapping);
}
