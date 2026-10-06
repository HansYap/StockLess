import type { CanonicalField, DataIssue, MappingState, ParsedDataset, ProductNumericEvidence, ReadinessSnapshot, ValidatedRow } from "./contracts.ts";

/** Strict decimal parsing: locale separators, currency symbols and inferred values are rejected. */
export function parseProductDecimal(value: string): number | undefined {
  if (!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function validateProductValues(
  dataset: ParsedDataset,
  mapping: MappingState,
  rows: readonly Pick<ValidatedRow, "productKey" | "sourceRow" | "originalProductHint" | "normalizedValues" | "originalValues">[],
  field: "unit_cost" | "unit_weight_kg",
): { readonly evidence: readonly ProductNumericEvidence[]; readonly issues: readonly DataIssue[] } {
  const selected = mapping.mappings[field];
  const column = selected?.confirmed ? dataset.columns.find(item => item.id === selected.sourceColumnId) : undefined;
  const groups = new Map<string, typeof rows[number][]>();
  for (const row of rows) if (row.productKey) {
    const group = groups.get(row.productKey) ?? []; group.push(row); groups.set(row.productKey, group);
  }
  const evidence: ProductNumericEvidence[] = [], issues: DataIssue[] = [];
  for (const [productKey, group] of [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const nonblank = column ? group.filter(row => row.normalizedValues[column.index] !== "") : [];
    const invalid = nonblank.filter(row => {
      const value = parseProductDecimal(row.normalizedValues[column!.index]);
      return value === undefined || (field === "unit_weight_kg" && value <= 0);
    });
    const values = [...new Set(nonblank.map(row => parseProductDecimal(row.normalizedValues[column!.index])).filter((value): value is number => value !== undefined))];
    const state = !column || nonblank.length === 0 ? "missing" : invalid.length ? "invalid" : values.length > 1 ? "conflicting" : "usable";
    const base = { productKey, field, sourceColumn: column?.header, sourceRows: Object.freeze((nonblank.length ? nonblank : group).map(row => row.sourceRow)) };
    if (state === "usable") { evidence.push(Object.freeze({ ...base, state, value: values[0] })); continue; }
    const label = field === "unit_cost" ? "Unit cost" : "Weight per unit in kilograms";
    const reason = !column ? `${label} is not mapped and confirmed.` : state === "missing" ? `${label} has no nonblank value for this product.`
      : state === "invalid" ? `${label} must be a finite ${field === "unit_cost" ? "non-negative" : "positive"} decimal number.`
      : `${label} has conflicting nonblank values for this product and pack size.`;
    const correctiveAction = !column ? `Map ${label} in Step 2, then rerun Step 3.`
      : `Correct ${label} in the source file using the same unit as sales and stock, then rerun Step 3.`;
    evidence.push(Object.freeze({ ...base, state, reason, correctiveAction }));
    // An unmapped optional field is a capability limitation, not a broken source row.
    if (!column || (field === "unit_weight_kg" && state === "missing")) continue;
    const affected = state === "invalid" ? invalid : state === "missing" ? [group[0]] : nonblank;
    for (const row of affected) {
      const issueCode = field === "unit_cost" ? state === "missing" ? "MISSING_UNIT_COST" : state === "invalid" ? "INVALID_UNIT_COST" : "CONFLICTING_UNIT_COST"
        : state === "invalid" ? "INVALID_UNIT_WEIGHT" : "CONFLICTING_UNIT_WEIGHT";
      issues.push(Object.freeze({ id: `${issueCode}:${row.sourceRow}:${field}`, sourceRow: row.sourceRow, productKey, originalProductHint: row.originalProductHint,
        issueCode, field, sourceColumn: column.header, observedValue: row.originalValues[column.index], reason, correctiveAction, resolutionState: "unresolved" }));
    }
  }
  return Object.freeze({ evidence: Object.freeze(evidence), issues: Object.freeze(issues) });
}

/** Stable cache provenance. Changing a mapping, source, date interpretation or date requires revalidation. */
export function readinessEvidenceKey(dataset: ParsedDataset, mapping: MappingState, options: { readonly analysisDate: string; readonly dateConfirmations?: readonly { readonly sourceColumnId: string; readonly format: string }[] }): string {
  return JSON.stringify([
    dataset.sourceSha256, dataset.worksheetName ?? null, dataset.headerRow ?? 1, options.analysisDate,
    mapping.identityMode, mapping.identityConfirmed,
    Object.keys(mapping.mappings).sort().map(field => {
      const item = mapping.mappings[field as CanonicalField]!;
      return [field, item.sourceColumnId, item.confirmed];
    }),
    [...(options.dateConfirmations ?? [])].sort((a, b) => a.sourceColumnId.localeCompare(b.sourceColumnId)).map(item => [item.sourceColumnId, item.format]),
  ]);
}

/** Shared monetary boundary for planning and impact; unavailable inputs never become zero. */
export function estimatePurchaseCost(snapshot: ReadinessSnapshot, productKey: string, quantity: number | undefined, currentEvidenceKey = snapshot.evidenceKey) {
  const unavailable = (state: "not_entered" | "unavailable", reason: string, correctiveAction: string) => Object.freeze({ state, reason, correctiveAction });
  if (quantity === undefined) return unavailable("not_entered", "No quantity entered.", "Enter a quantity in purchase planning.");
  if (!Number.isFinite(quantity) || quantity < 0) return unavailable("unavailable", "Quantity must be a finite non-negative number.", "Correct the quantity.");
  if (!snapshot.evidenceKey || currentEvidenceKey !== snapshot.evidenceKey) return unavailable("unavailable", "Unit cost is pending revalidation.", "Rerun Step 3 for the current data and mappings.");
  if (snapshot.productLimitations.some(item => item.productKey === productKey && item.code === "IDENTITY_CONFLICT")) return unavailable("unavailable", "Product identity is unresolved.", "Correct product names, codes and pack sizes, then rerun Step 3.");
  const cost = snapshot.productCosts?.find(item => item.productKey === productKey);
  if (!cost) return unavailable("unavailable", "No validated unit cost.", "Map Unit cost and rerun Step 3.");
  if (cost.state !== "usable") return unavailable("unavailable", cost.reason, cost.correctiveAction);
  const amount = quantity * cost.value;
  if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER / 100) return unavailable("unavailable", "The estimated amount is outside the supported numeric range.", "Check the quantity and unit cost.");
  return Object.freeze({ state: "estimated" as const, amount: Math.round((amount + Number.EPSILON) * 100) / 100, quantity, unitCost: cost.value,
    currency: "MYR" as const, snapshotId: snapshot.id, sourceRows: cost.sourceRows, evidenceKey: snapshot.evidenceKey });
}
