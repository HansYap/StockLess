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

export interface SavedMatchingDifferences {
  readonly missingColumns: readonly string[];
  readonly newColumns: readonly string[];
}

export interface SavedMatchingLoadResult {
  readonly envelope: SessionEnvelope;
  readonly offered: boolean;
  readonly differences?: SavedMatchingDifferences;
}

/** Creates an order-independent identity for the complete set of file headings. */
export function headersKeyFor(envelope: SessionEnvelope): string | null {
  const dataset = envelope.session.dataset;
  if (!dataset) return null;
  return JSON.stringify(dataset.columns.map((column) => column.normalizedHeader).sort());
}

function headersFromKey(headersKey: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(headersKey);
    return Array.isArray(parsed) && parsed.every((header) => typeof header === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function differencesBetween(
  savedHeaders: readonly string[],
  currentHeaders: readonly string[],
): SavedMatchingDifferences {
  const saved = new Set(savedHeaders);
  const current = new Set(currentHeaders);
  return Object.freeze({
    missingColumns: Object.freeze(savedHeaders.filter((header) => !current.has(header))),
    newColumns: Object.freeze(currentHeaders.filter((header) => !saved.has(header))),
  });
}

function differenceCount(differences: SavedMatchingDifferences): number {
  return differences.missingColumns.length + differences.newColumns.length;
}

/** Saves the confirmed matches for this file shape, replacing an earlier save for the same headings. */
export async function saveMatching(envelope: SessionEnvelope): Promise<boolean> {
  const { dataset, mapping } = envelope.session;
  if (!dataset || dataset.sourceMode === "sample") return false;

  const headersKey = headersKeyFor(envelope);
  if (!headersKey) return false;

  const rules: Record<string, CanonicalField> = {};
  for (const match of Object.values(mapping.mappings)) {
    const column = dataset.columns.find((candidate) => candidate.id === match?.sourceColumnId);
    if (match?.confirmed && column) rules[column.normalizedHeader] = match.targetField;
  }
  const template: MappingTemplate = {
    headersKey,
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
 * When matchings are saved but none exactly fits, every mapping stays blank and the
 * closest saved shape is used only to name the differing columns.
 */
export async function loadSavedMatching(
  envelope: SessionEnvelope,
): Promise<SavedMatchingLoadResult | null> {
  const dataset = envelope.session.dataset;
  if (!dataset || dataset.sourceMode === "sample") return null;

  const templates = await withStore<MappingTemplate[]>("mapping_templates", "readonly", (store) => store.getAll())
    .catch((): MappingTemplate[] => []);
  if (templates.length === 0) return null;

  const headersKey = headersKeyFor(envelope)!;
  const currentHeaders = headersFromKey(headersKey);
  const columnIdByHeader = new Map(dataset.columns.map((column) => [column.normalizedHeader, column.id] as const));
  const template = templates.find((candidate) => candidate.headersKey === headersKey);
  if (!template) {
    const closest = templates
      .map((candidate) => ({
        candidate,
        differences: differencesBetween(headersFromKey(candidate.headersKey), currentHeaders),
      }))
      .sort((left, right) =>
        differenceCount(left.differences) - differenceCount(right.differences)
        || right.candidate.savedAt.localeCompare(left.candidate.savedAt)
      )[0];
    return { envelope, offered: false, differences: closest?.differences };
  }

  let mapping: MappingState = Object.freeze({ ...envelope.session.mapping, identityMode: template.identityMode });
  for (const [header, field] of Object.entries(template.rules)) {
    mapping = setMapping(mapping, field, columnIdByHeader.get(header)!, false);
  }
  return { envelope: updateSessionMapping(envelope, mapping), offered: true };
}

/** Deletes every saved column matching while leaving the active dataset untouched. */
export async function deleteAllSavedMatchings(): Promise<boolean> {
  return withStore("mapping_templates", "readwrite", (store) => store.clear()).then(() => true, () => false);
}

/** Counts saved file shapes for the returning-use control. */
export async function countSavedMatchings(): Promise<number> {
  return withStore<number>("mapping_templates", "readonly", (store) => store.count()).catch(() => 0);
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
