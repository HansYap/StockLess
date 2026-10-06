import type {
  IdentityConflict,
  IdentityEvidenceEvent,
  MappingState,
  ParsedDataset,
  ReadinessSnapshot,
} from "./contracts.ts";

export interface ProductLabels {
  readonly names: readonly string[];
  readonly codes: readonly string[];
  readonly packs: readonly string[];
}

/** Keeps all source labels, including excluded/conflicting rows, without changing identity. */
export function collectProductLabels(snapshot: Pick<ReadinessSnapshot, "rows">): ReadonlyMap<string, ProductLabels> {
  const groups = new Map<string, { names: Set<string>; codes: Set<string>; packs: Set<string> }>();
  for (const row of snapshot.rows) {
    if (!row.productKey) continue;
    const labels = groups.get(row.productKey) ?? { names: new Set<string>(), codes: new Set<string>(), packs: new Set<string>() };
    const values = row.interpretedValues;
    for (const [kind, value] of [["names", values.productName], ["codes", values.productCode], ["packs", values.packVariant]] as const) {
      if (value?.trim()) labels[kind].add(value.trim());
    }
    groups.set(row.productKey, labels);
  }
  return new Map([...groups].map(([key, labels]) => [key, Object.freeze({ names: Object.freeze([...labels.names]), codes: Object.freeze([...labels.codes]), packs: Object.freeze([...labels.packs]) })]));
}

/** Resolves a source-column identifier to its position in parsed rows. */
function columnIndex(dataset: ParsedDataset, sourceColumnId: string | undefined): number | undefined {
  if (!sourceColumnId) return undefined;
  return dataset.columns.find((column) => column.id === sourceColumnId)?.index;
}

/** Reads and trims a row value, returning an empty string for an absent column. */
function rowValue(row: readonly string[], index: number | undefined): string {
  return index === undefined ? "" : (row[index] ?? "").trim();
}

/** Builds a stable-code or confirmed composite product key without case folding. */
export function buildProductKey(
  values: Readonly<{ productCode?: string; productName?: string; packVariant?: string }>,
  identityMode: "stable" | "composite",
): string | undefined {
  if (identityMode === "stable") {
    const code = values.productCode?.trim();
    return code ? `ID|${code}` : undefined;
  }

  const productName = values.productName?.trim();
  const packVariant = values.packVariant?.trim();
  return productName && packVariant ? `COMPOSITE|${encodeURIComponent(productName)}|${encodeURIComponent(packVariant)}` : undefined;
}

/** Finds conflicting code and composite identities with their original row numbers. */
export function detectIdentityConflicts(
  dataset: ParsedDataset,
  mapping: MappingState,
): readonly IdentityConflict[] {
  const codeIndex = columnIndex(dataset, mapping.mappings.product_code?.sourceColumnId);
  const nameIndex = columnIndex(dataset, mapping.mappings.product_name?.sourceColumnId);
  const variantIndex = columnIndex(dataset, mapping.mappings.pack_variant?.sourceColumnId);
  const codeToNames = new Map<string, Map<string, number[]>>();
  const codeToPacks = new Map<string, Map<string, number[]>>();
  const compositeToCodes = new Map<string, Map<string, number[]>>();
  function add(groups: Map<string, Map<string, number[]>>, key: string, value: string, sourceRow: number) {
    const variants = groups.get(key) ?? new Map<string, number[]>();
    const rows = variants.get(value) ?? [];
    rows.push(sourceRow); variants.set(value, rows); groups.set(key, variants);
  }
  for (const row of dataset.rows) {
    const code = rowValue(row.normalizedValues, codeIndex);
    const name = rowValue(row.normalizedValues, nameIndex);
    const variant = rowValue(row.normalizedValues, variantIndex);
    if (code && name) add(codeToNames, code, name, row.sourceRow);
    if (code && variant) add(codeToPacks, code, variant, row.sourceRow);
    if (code && name && variant) add(compositeToCodes, JSON.stringify([name, variant]), code, row.sourceRow);
  }
  const conflicts: IdentityConflict[] = [];
  for (const [groups, conflictCode] of [
    [codeToNames, "CODE_TO_MULTIPLE_NAMES"],
    [codeToPacks, "CODE_TO_MULTIPLE_PACKS"],
    [compositeToCodes, "COMPOSITE_TO_MULTIPLE_CODES"],
  ] as const) {
    for (const [key, variants] of groups) {
      if (variants.size > 1) conflicts.push(Object.freeze({
        code: conflictCode,
        productHint: key,
        sourceRows: Object.freeze([...variants.values()].flat().sort((a, b) => a - b)),
        values: Object.freeze([...variants.keys()].sort()),
      }));
    }
  }
  return Object.freeze(conflicts);
}

/** Records the source columns used for a retailer-confirmed identity choice. */
export function createIdentityEvidence(
  mapping: MappingState,
  occurredAt: string,
): IdentityEvidenceEvent {
  if (!mapping.identityMode || !mapping.identityConfirmed) {
    throw new Error("Identity mode must be retailer-confirmed before evidence is recorded.");
  }
  const sourceColumns = mapping.identityMode === "stable"
    ? [mapping.mappings.product_code?.sourceColumnId]
    : [mapping.mappings.product_name?.sourceColumnId, mapping.mappings.pack_variant?.sourceColumnId];
  if (sourceColumns.some((value) => !value)) {
    throw new Error("Confirmed identity is missing one or more source columns.");
  }
  return Object.freeze({
    event: "identity_confirmed",
    occurredAt,
    mode: mapping.identityMode,
    sourceColumns: Object.freeze(sourceColumns as string[]),
  });
}

/** Renames display identifiers only and refuses mappings that would merge products. */
export function applyBijectiveDisplayRename<T extends { readonly productKey: string; readonly displayName: string }>(
  records: readonly T[],
  renameMap: Readonly<Record<string, string>>,
): readonly T[] {
  const targetNames = Object.values(renameMap);
  if (new Set(targetNames).size !== targetNames.length) {
    throw new Error("Display rename map must be bijective; duplicate target identifiers are not allowed.");
  }
  return Object.freeze(records.map((record) => Object.freeze({
    ...record,
    displayName: renameMap[record.productKey] ?? record.displayName,
  })));
}
