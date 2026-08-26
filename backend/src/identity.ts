import type {
  IdentityConflict,
  IdentityEvidenceEvent,
  MappingState,
  ParsedDataset,
} from "./contracts.ts";

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
  return productName && packVariant ? `COMPOSITE|${productName}|${packVariant}` : undefined;
}

/** Finds conflicting code and composite identities with their original row numbers. */
export function detectIdentityConflicts(
  dataset: ParsedDataset,
  mapping: MappingState,
): readonly IdentityConflict[] {
  const codeIndex = columnIndex(dataset, mapping.mappings.product_code?.sourceColumnId);
  const nameIndex = columnIndex(dataset, mapping.mappings.product_name?.sourceColumnId);
  const variantIndex = columnIndex(dataset, mapping.mappings.pack_variant?.sourceColumnId);
  const codeToVariants = new Map<string, Map<string, number[]>>();
  const compositeToCodes = new Map<string, Map<string, number[]>>();

  for (const row of dataset.rows) {
    const code = rowValue(row.normalizedValues, codeIndex);
    const name = rowValue(row.normalizedValues, nameIndex);
    const variant = rowValue(row.normalizedValues, variantIndex);
    const composite = name && variant ? `${name}|${variant}` : "";

    if (code && composite) {
      const variants = codeToVariants.get(code) ?? new Map<string, number[]>();
      variants.set(composite, [...(variants.get(composite) ?? []), row.sourceRow]);
      codeToVariants.set(code, variants);

      const codes = compositeToCodes.get(composite) ?? new Map<string, number[]>();
      codes.set(code, [...(codes.get(code) ?? []), row.sourceRow]);
      compositeToCodes.set(composite, codes);
    }
  }

  const conflicts: IdentityConflict[] = [];
  for (const [code, variants] of codeToVariants) {
    if (variants.size > 1) {
      conflicts.push(Object.freeze({
        code: "CODE_TO_MULTIPLE_VARIANTS",
        productHint: code,
        sourceRows: Object.freeze([...variants.values()].flat().sort((a, b) => a - b)),
        values: Object.freeze([...variants.keys()].sort()),
      }));
    }
  }
  for (const [composite, codes] of compositeToCodes) {
    if (codes.size > 1) {
      conflicts.push(Object.freeze({
        code: "COMPOSITE_TO_MULTIPLE_CODES",
        productHint: composite,
        sourceRows: Object.freeze([...codes.values()].flat().sort((a, b) => a - b)),
        values: Object.freeze([...codes.keys()].sort()),
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
