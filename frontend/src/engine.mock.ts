/**
 * Mock domain engine.
 *
 * Mirrors the shape of @stockless/backend so the interface can be built and
 * tested without wiring the real engine. Swap it out by editing engine.ts only.
 */

/* ── types ──────────────────────────────────────────────────────────────── */

export type CanonicalField =
  | "transaction_date"
  | "product_code"
  | "product_name"
  | "pack_variant"
  | "quantity_sold"
  | "current_stock"
  | "stock_as_of_date"
  | "planned_order_quantity"
  | "supplier_lead_time_days";

export type FieldStatus = "core" | "conditional_core" | "feature_dependent" | "later_locked";
export type ValueKind = "date" | "decimal" | "non_negative_decimal" | "text" | "non_negative_integer";
export type AcquisitionSource = "file" | "aina" | "either";

export interface FieldDefinition {
  readonly field: CanonicalField;
  readonly label: string;
  readonly description: string;
  readonly status: FieldStatus;
  readonly valueKind: ValueKind;
  readonly aliases: readonly string[];
  readonly acquisitionSource: AcquisitionSource;
}

export type CapabilityId =
  | "weekly_history"
  | "timeline_gap_evidence"
  | "recent_weekly_average"
  | "stock_freshness"
  | "weeks_of_cover"
  | "purchase_audit"
  | "supplier_scenario";

export type CapabilityState = "available" | "needs_information" | "limited" | "locked";

export interface CapabilityReason {
  readonly code: string;
  readonly message: string;
  readonly field?: CanonicalField;
}

export interface CapabilityResult {
  readonly capability: CapabilityId;
  readonly label: string;
  readonly state: CapabilityState;
  readonly reasons: readonly CapabilityReason[];
  readonly iterationEnabled: boolean;
}

export type SourceMode = "user" | "sample";

export interface SourceColumn {
  readonly id: string;
  readonly index: number;
  readonly header: string;
  readonly normalizedHeader: string;
  readonly previewValues: readonly string[];
}

export interface ParsedRow {
  readonly sourceRow: number;
  readonly originalValues: readonly string[];
  readonly normalizedValues: readonly string[];
}

export interface ParsedDataset {
  readonly sourceMode: SourceMode;
  readonly sourceName: string;
  readonly sourceByteLength: number;
  readonly delimiter: "," | ";" | "\t";
  readonly columns: readonly SourceColumn[];
  readonly rows: readonly ParsedRow[];
}

export type CsvErrorCode =
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "INVALID_UTF8"
  | "UNSUPPORTED_DELIMITER"
  | "MALFORMED_CSV"
  | "MISSING_HEADER"
  | "ROW_LIMIT_EXCEEDED"
  | "EMPTY_FILE";

export interface CsvProgress {
  readonly phase: "decode" | "detect_delimiter" | "parse" | "complete";
  readonly processed: number;
  readonly total: number;
}

export interface CsvParseOptions {
  readonly sourceMode: SourceMode;
  readonly sourceName: string;
  readonly mimeType?: string;
  readonly onProgress?: (progress: CsvProgress) => void;
}

export interface FieldMapping {
  readonly targetField: CanonicalField;
  readonly sourceColumnId: string;
  readonly confirmed: boolean;
}

export interface MappingState {
  readonly mappings: Readonly<Partial<Record<CanonicalField, FieldMapping>>>;
  readonly identityMode?: "stable" | "composite";
  readonly identityConfirmed: boolean;
}

export interface MappingProposal {
  readonly targetField: CanonicalField;
  readonly sourceColumnId?: string;
  readonly sourceHeader?: string;
  readonly previewValues: readonly string[];
  readonly scoreBand: "exact_alias" | "high" | "unconfirmed";
  readonly reason: string;
  readonly confirmed: false;
}

export interface MappingProposalResult {
  readonly proposals: readonly MappingProposal[];
  readonly usedSemanticModel: boolean;
  readonly fallbackNotice?: string;
}

export interface IdentityConflict {
  readonly code: "CODE_TO_MULTIPLE_VARIANTS" | "COMPOSITE_TO_MULTIPLE_CODES";
  readonly productHint: string;
  readonly sourceRows: readonly number[];
  readonly values: readonly string[];
}

export interface StocklessSession {
  readonly id: string;
  readonly sourceMode?: SourceMode;
  readonly dataset?: ParsedDataset;
  readonly mapping: MappingState;
  readonly createdAt: string;
}

export interface SessionEnvelope {
  readonly session: StocklessSession;
  readonly preferences: { readonly locale?: string };
}

/* ── constants ──────────────────────────────────────────────────────────── */

export const UPLOAD_REQUIREMENTS = {
  maxBytes: 10 * 1024 * 1024,
  maxRows: 100_000,
  supportedExtension: ".csv",
  coreDescription:
    "StockLess needs a transaction date, quantity sold, and either a stable product code or a confirmed product name plus pack variant.",
} as const;

export const PRIVACY_NOTICE = {
  beforeUpload:
    "Your raw CSV rows are processed in this browser and no account is required. Your headings, preview values, rows and product identifiers are not uploaded to any service.",
} as const;

export const FIELD_REGISTRY: Record<CanonicalField, FieldDefinition> = {
  transaction_date: {
    field: "transaction_date", label: "Transaction date",
    description: "The calendar date on which the sale was recorded.",
    status: "core", valueKind: "date", acquisitionSource: "file",
    aliases: ["transaction date", "sale date", "sales date", "order date", "sold at"],
  },
  product_code: {
    field: "product_code", label: "Product code, SKU or barcode",
    description: "A stable identifier that keeps each product separate.",
    status: "conditional_core", valueKind: "text", acquisitionSource: "file",
    aliases: ["product code", "sku", "barcode", "item code", "product id"],
  },
  product_name: {
    field: "product_name", label: "Product name",
    description: "A readable product label and one part of composite identity.",
    status: "conditional_core", valueKind: "text", acquisitionSource: "file",
    aliases: ["product name", "item name", "product", "item", "description"],
  },
  pack_variant: {
    field: "pack_variant", label: "Pack variant or unit",
    description: "The pack size needed to prevent unlike products being merged.",
    status: "conditional_core", valueKind: "text", acquisitionSource: "file",
    aliases: ["pack variant", "variant", "unit", "uom", "size", "pack"],
  },
  quantity_sold: {
    field: "quantity_sold", label: "Quantity sold",
    description: "The sale or return quantity recorded for the transaction.",
    status: "core", valueKind: "decimal", acquisitionSource: "file",
    aliases: ["quantity sold", "qty sold", "units sold", "quantity", "qty"],
  },
  current_stock: {
    field: "current_stock", label: "Current stock",
    description: "The current product-level stock snapshot.",
    status: "feature_dependent", valueKind: "non_negative_decimal", acquisitionSource: "either",
    aliases: ["current stock", "stock on hand", "soh", "closing stock", "inventory qty"],
  },
  stock_as_of_date: {
    field: "stock_as_of_date", label: "Stock as-of date",
    description: "The date on which the stock snapshot was measured.",
    status: "feature_dependent", valueKind: "date", acquisitionSource: "either",
    aliases: ["stock as of date", "stock date", "snapshot date", "inventory date"],
  },
  planned_order_quantity: {
    field: "planned_order_quantity", label: "Planned order quantity",
    description: "A planned purchase quantity for a later purchase audit.",
    status: "later_locked", valueKind: "non_negative_decimal", acquisitionSource: "either",
    aliases: ["planned order quantity", "order qty"],
  },
  supplier_lead_time_days: {
    field: "supplier_lead_time_days", label: "Supplier lead time in days",
    description: "The number of days a supplier usually needs to deliver.",
    status: "later_locked", valueKind: "non_negative_integer", acquisitionSource: "either",
    aliases: ["lead time days", "lead time"],
  },
};

export const CANONICAL_FIELDS = Object.keys(FIELD_REGISTRY) as CanonicalField[];

export const CORE_COLUMN_PATHS = [
  {
    id: "stable" as const,
    label: "Stable product identifier",
    requiredFields: ["transaction_date", "product_code", "quantity_sold"] as CanonicalField[],
  },
  {
    id: "composite" as const,
    label: "Confirmed product name and pack variant",
    requiredFields: ["transaction_date", "product_name", "pack_variant", "quantity_sold"] as CanonicalField[],
  },
];

/* ── csv ────────────────────────────────────────────────────────────────── */

export class CsvImportError extends Error {
  readonly code: CsvErrorCode;
  readonly recovery: string;
  constructor(code: CsvErrorCode, message: string, recovery: string) {
    super(message);
    this.name = "CsvImportError";
    this.code = code;
    this.recovery = recovery;
  }
}

/** Splits one CSV line, honouring double-quoted fields. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { out.push(field); field = ""; }
    else field += ch;
  }
  out.push(field);
  return out;
}

/** Picks the delimiter that yields the most consistent column count. */
function detectDelimiter(lines: string[]): "," | ";" | "\t" {
  const candidates: ("," | ";" | "\t")[] = [",", ";", "\t"];
  let best: "," | ";" | "\t" | null = null;
  let bestScore = 0;
  for (const d of candidates) {
    const counts = lines.slice(0, 20).map((l) => splitLine(l, d).length);
    const first = counts[0] ?? 0;
    if (first < 2) continue;
    const consistent = counts.filter((c) => c === first).length / counts.length;
    const score = consistent * 1000 + first;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  if (!best) {
    throw new CsvImportError(
      "UNSUPPORTED_DELIMITER",
      "StockLess could not identify a supported CSV delimiter.",
      "Export the CSV using a comma, semicolon, or tab delimiter.",
    );
  }
  return best;
}

export async function parseCsvBytes(
  bytes: Uint8Array,
  options: CsvParseOptions,
): Promise<ParsedDataset> {
  const total = bytes.byteLength;
  options.onProgress?.({ phase: "decode", processed: 0, total });

  if (!options.sourceName.toLowerCase().endsWith(".csv")) {
    throw new CsvImportError(
      "UNSUPPORTED_FILE_TYPE",
      `Unsupported file type for ${options.sourceName}.`,
      "Export the source as a .csv file and try again.",
    );
  }
  if (total === 0) {
    throw new CsvImportError("EMPTY_FILE", "The selected CSV is empty.", "Choose a CSV containing a header row and at least one data row.");
  }
  if (total > UPLOAD_REQUIREMENTS.maxBytes) {
    throw new CsvImportError("FILE_TOO_LARGE", "The CSV is above the size limit.", "Reduce the CSV below 10 MB or split it into separate files.");
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CsvImportError("INVALID_UTF8", "The CSV is not valid UTF-8.", "Export the CSV using UTF-8 encoding and try again.");
  }
  options.onProgress?.({ phase: "decode", processed: total, total });

  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) {
    throw new CsvImportError("EMPTY_FILE", "The selected CSV is empty.", "Choose a CSV containing a header row and at least one data row.");
  }

  options.onProgress?.({ phase: "detect_delimiter", processed: 0, total });
  const delimiter = detectDelimiter(lines);
  options.onProgress?.({ phase: "detect_delimiter", processed: total, total });

  const header = splitLine(lines[0]!, delimiter).map((h) => h.trim());
  if (header.every((h) => h === "")) {
    throw new CsvImportError("MISSING_HEADER", "The CSV has no usable header row.", "Add a non-empty header row to the CSV and try again.");
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = splitLine(lines[i]!, delimiter);
    if (values.length !== header.length) {
      throw new CsvImportError(
        "MALFORMED_CSV",
        `CSV record ${i + 1} has ${values.length} columns; expected ${header.length}.`,
        "Repair inconsistent columns or unmatched quotes in the CSV and try again.",
      );
    }
    rows.push({
      sourceRow: i + 1,
      originalValues: values,
      normalizedValues: values.map((v) => v.trim()),
    });
    if (i % 500 === 0) options.onProgress?.({ phase: "parse", processed: i, total: lines.length });
  }

  const columns: SourceColumn[] = header.map((h, index) => ({
    id: `column-${index}`,
    index,
    header: h,
    normalizedHeader: normalizeHeader(h),
    previewValues: [...new Set(rows.map((r) => r.normalizedValues[index] ?? "").filter(Boolean))].slice(0, 5),
  }));

  options.onProgress?.({ phase: "complete", processed: total, total });

  return {
    sourceMode: options.sourceMode,
    sourceName: options.sourceName,
    sourceByteLength: total,
    delimiter,
    columns,
    rows,
  };
}

export function canProceedToMapping(dataset: ParsedDataset): boolean {
  return dataset.columns.length > 0;
}

/* ── mapping ────────────────────────────────────────────────────────────── */

export class MappingConflictError extends Error {
  readonly sourceColumnId: string;
  readonly existingTarget: CanonicalField;
  constructor(sourceColumnId: string, existingTarget: CanonicalField) {
    super(`Source column ${sourceColumnId} is already mapped to ${existingTarget}.`);
    this.name = "MappingConflictError";
    this.sourceColumnId = sourceColumnId;
    this.existingTarget = existingTarget;
  }
}

export function normalizeHeader(header: string): string {
  return header
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase()
    .replace(/[_\-./\\]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Word-overlap similarity between two normalized strings. */
function similarity(a: string, b: string): number {
  const left = new Set(normalizeHeader(a).split(" ").filter(Boolean));
  const right = new Set(normalizeHeader(b).split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  left.forEach((token) => { if (right.has(token)) shared += 1; });
  return shared / new Set([...left, ...right]).size;
}

export async function proposeMappings(dataset: ParsedDataset): Promise<MappingProposalResult> {
  const claimed = new Set<string>();
  const proposals: MappingProposal[] = [];

  for (const field of CANONICAL_FIELDS) {
    const definition = FIELD_REGISTRY[field];
    let best: { column: SourceColumn; score: number; exact: boolean } | null = null;

    for (const column of dataset.columns) {
      if (claimed.has(column.id)) continue;
      const normalized = normalizeHeader(column.header);
      const exact = definition.aliases.map(normalizeHeader).includes(normalized);
      const score = exact
        ? 1
        : Math.max(...[definition.label, ...definition.aliases].map((p) => similarity(column.header, p)));
      if (!best || score > best.score) best = { column, score, exact };
    }

    if (best && (best.exact || best.score >= 0.5)) {
      claimed.add(best.column.id);
      proposals.push({
        targetField: field,
        sourceColumnId: best.column.id,
        sourceHeader: best.column.header,
        previewValues: best.column.previewValues,
        scoreBand: best.exact ? "exact_alias" : "high",
        reason: best.exact
          ? "Header matches an approved alias. Confirmation is still required."
          : "Header is a likely match. Confirmation is still required.",
        confirmed: false,
      });
    } else {
      proposals.push({
        targetField: field,
        previewValues: [],
        scoreBand: "unconfirmed",
        reason: "No candidate passed the safety gates. Choose a source column manually.",
        confirmed: false,
      });
    }
  }

  return {
    proposals,
    usedSemanticModel: false,
    fallbackNotice:
      "Local semantic model is not connected yet. Alias matching, lexical matching and manual mapping remain available.",
  };
}

export function createMappingState(): MappingState {
  return { mappings: {}, identityConfirmed: false };
}

export function setMapping(
  state: MappingState,
  targetField: CanonicalField,
  sourceColumnId: string,
  confirmed = false,
): MappingState {
  for (const [existing, mapping] of Object.entries(state.mappings) as [CanonicalField, FieldMapping][]) {
    if (existing !== targetField && mapping.sourceColumnId === sourceColumnId) {
      throw new MappingConflictError(sourceColumnId, existing);
    }
  }
  return {
    ...state,
    mappings: { ...state.mappings, [targetField]: { targetField, sourceColumnId, confirmed } },
  };
}

export function removeMapping(state: MappingState, targetField: CanonicalField): MappingState {
  const mappings = { ...state.mappings };
  delete mappings[targetField];
  return { ...state, mappings };
}

export function confirmMapping(state: MappingState, targetField: CanonicalField): MappingState {
  const mapping = state.mappings[targetField];
  if (!mapping) throw new Error(`Cannot confirm ${targetField}: no source column is selected.`);
  return setMapping(state, targetField, mapping.sourceColumnId, true);
}

export function confirmIdentityMode(state: MappingState, mode: "stable" | "composite"): MappingState {
  const required: CanonicalField[] = mode === "stable" ? ["product_code"] : ["product_name", "pack_variant"];
  const missing = required.filter((f) => !state.mappings[f]?.confirmed);
  if (missing.length > 0) {
    throw new Error(`Cannot confirm ${mode} identity until these mappings are confirmed: ${missing.join(", ")}.`);
  }
  return { ...state, identityMode: mode, identityConfirmed: true };
}

export function getReadinessBlockers(state: MappingState): readonly string[] {
  const blockers: string[] = [];
  if (!state.mappings.transaction_date?.confirmed) blockers.push(FIELD_REGISTRY.transaction_date.label);
  if (!state.mappings.quantity_sold?.confirmed) blockers.push(FIELD_REGISTRY.quantity_sold.label);

  const stableReady = state.identityMode === "stable" && state.identityConfirmed && state.mappings.product_code?.confirmed;
  const compositeReady = state.identityMode === "composite" && state.identityConfirmed
    && state.mappings.product_name?.confirmed && state.mappings.pack_variant?.confirmed;
  if (!stableReady && !compositeReady) {
    blockers.push("Product identity (stable code or confirmed name plus pack variant)");
  }
  return blockers;
}

/* ── capabilities ───────────────────────────────────────────────────────── */

const CAPABILITY_REGISTRY: readonly {
  id: CapabilityId; label: string; iterationEnabled: boolean; requiredFields: CanonicalField[];
}[] = [
  { id: "weekly_history", label: "Weekly product history", iterationEnabled: true, requiredFields: ["transaction_date", "quantity_sold"] },
  { id: "timeline_gap_evidence", label: "Timeline-gap evidence", iterationEnabled: true, requiredFields: ["transaction_date", "quantity_sold"] },
  { id: "recent_weekly_average", label: "Recent weekly average", iterationEnabled: true, requiredFields: ["transaction_date", "quantity_sold"] },
  { id: "stock_freshness", label: "Stock freshness", iterationEnabled: true, requiredFields: ["current_stock", "stock_as_of_date"] },
  { id: "weeks_of_cover", label: "Descriptive weeks of cover", iterationEnabled: true, requiredFields: ["transaction_date", "quantity_sold", "current_stock", "stock_as_of_date"] },
  { id: "purchase_audit", label: "Purchase audit", iterationEnabled: false, requiredFields: ["planned_order_quantity"] },
  { id: "supplier_scenario", label: "Supplier scenario", iterationEnabled: false, requiredFields: ["supplier_lead_time_days"] },
];

const IDENTITY_DEPENDENT: CapabilityId[] = [
  "weekly_history", "timeline_gap_evidence", "recent_weekly_average", "weeks_of_cover",
];

function identityReady(state: MappingState): boolean {
  if (!state.identityConfirmed) return false;
  if (state.identityMode === "stable") return Boolean(state.mappings.product_code?.confirmed);
  if (state.identityMode === "composite") {
    return Boolean(state.mappings.product_name?.confirmed && state.mappings.pack_variant?.confirmed);
  }
  return false;
}

export function evaluateCapabilities(state: MappingState): readonly CapabilityResult[] {
  return CAPABILITY_REGISTRY.map((definition): CapabilityResult => {
    const reasons: CapabilityReason[] = [];
    for (const field of definition.requiredFields) {
      if (!state.mappings[field]?.confirmed) {
        reasons.push({
          code: "FIELD_NOT_CONFIRMED",
          message: `${FIELD_REGISTRY[field].label} must be mapped and confirmed.`,
          field,
        });
      }
    }
    if (IDENTITY_DEPENDENT.includes(definition.id) && !identityReady(state)) {
      reasons.push({
        code: "PRODUCT_IDENTITY_NOT_CONFIRMED",
        message: "Confirm either a stable product code or product name plus pack variant.",
      });
    }

    if (!definition.iterationEnabled) {
      return {
        capability: definition.id,
        label: definition.label,
        state: "locked",
        reasons: [{ code: "LATER_ITERATION", message: `${definition.label} is visible but locked until iteration 2.` }],
        iterationEnabled: false,
      };
    }

    return {
      capability: definition.id,
      label: definition.label,
      state: reasons.length > 0 ? "needs_information" : "available",
      reasons,
      iterationEnabled: true,
    };
  });
}

export function partitionCapabilities(results: readonly CapabilityResult[]) {
  return {
    availableNow: results.filter((r) => r.state === "available" || r.state === "limited"),
    needsMoreInformation: results.filter((r) => r.state === "needs_information"),
    locked: results.filter((r) => r.state === "locked"),
  };
}

/* ── identity ───────────────────────────────────────────────────────────── */

function columnIndex(dataset: ParsedDataset, id: string | undefined): number | undefined {
  if (!id) return undefined;
  return dataset.columns.find((c) => c.id === id)?.index;
}

export function detectIdentityConflicts(
  dataset: ParsedDataset,
  mapping: MappingState,
): readonly IdentityConflict[] {
  const codeIndex = columnIndex(dataset, mapping.mappings.product_code?.sourceColumnId);
  const nameIndex = columnIndex(dataset, mapping.mappings.product_name?.sourceColumnId);
  const variantIndex = columnIndex(dataset, mapping.mappings.pack_variant?.sourceColumnId);
  if (codeIndex === undefined || nameIndex === undefined || variantIndex === undefined) return [];

  const codeToVariants = new Map<string, Map<string, number[]>>();
  const compositeToCodes = new Map<string, Map<string, number[]>>();

  for (const row of dataset.rows) {
    const code = (row.normalizedValues[codeIndex] ?? "").trim();
    const name = (row.normalizedValues[nameIndex] ?? "").trim();
    const variant = (row.normalizedValues[variantIndex] ?? "").trim();
    const composite = name && variant ? `${name}|${variant}` : "";
    if (!code || !composite) continue;

    const variants = codeToVariants.get(code) ?? new Map<string, number[]>();
    variants.set(composite, [...(variants.get(composite) ?? []), row.sourceRow]);
    codeToVariants.set(code, variants);

    const codes = compositeToCodes.get(composite) ?? new Map<string, number[]>();
    codes.set(code, [...(codes.get(code) ?? []), row.sourceRow]);
    compositeToCodes.set(composite, codes);
  }

  const conflicts: IdentityConflict[] = [];
  codeToVariants.forEach((variants, code) => {
    if (variants.size > 1) {
      conflicts.push({
        code: "CODE_TO_MULTIPLE_VARIANTS",
        productHint: code,
        sourceRows: [...variants.values()].flat().sort((a, b) => a - b),
        values: [...variants.keys()].sort(),
      });
    }
  });
  compositeToCodes.forEach((codes, composite) => {
    if (codes.size > 1) {
      conflicts.push({
        code: "COMPOSITE_TO_MULTIPLE_CODES",
        productHint: composite,
        sourceRows: [...codes.values()].flat().sort((a, b) => a - b),
        values: [...codes.keys()].sort(),
      });
    }
  });
  return conflicts;
}

/* ── session ────────────────────────────────────────────────────────────── */

function newId(): string {
  return `session-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptySession(preferences: { locale?: string } = {}): SessionEnvelope {
  return {
    preferences,
    session: { id: newId(), mapping: createMappingState(), createdAt: new Date().toISOString() },
  };
}

export async function replaceSessionSource(
  envelope: SessionEnvelope,
  bytes: Uint8Array,
  options: CsvParseOptions,
): Promise<SessionEnvelope> {
  const dataset = await parseCsvBytes(bytes, options);
  return {
    preferences: envelope.preferences,
    session: {
      id: newId(),
      sourceMode: options.sourceMode,
      dataset,
      mapping: createMappingState(),
      createdAt: new Date().toISOString(),
    },
  };
}

export function updateSessionMapping(envelope: SessionEnvelope, mapping: MappingState): SessionEnvelope {
  return { preferences: envelope.preferences, session: { ...envelope.session, mapping } };
}

export function recordConfirmedIdentity(envelope: SessionEnvelope): SessionEnvelope {
  if (!envelope.session.mapping.identityConfirmed) {
    throw new Error("Identity mode must be confirmed before evidence is recorded.");
  }
  return envelope;
}

export function clearActiveSession(envelope: SessionEnvelope) {
  return {
    envelope: createEmptySession(envelope.preferences),
    cleared: true as const,
    message: "The active in-memory dataset, mappings and identity evidence were cleared.",
  };
}
