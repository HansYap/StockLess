
/** Public data contracts shared by the browser engine and frontend. */

export type CanonicalField =
  | "transaction_date"
  | "product_code"
  | "product_name"
  | "pack_variant"
  | "quantity_sold"
  | "current_stock"
  | "stock_as_of_date"
  | "planned_order_quantity"
  | "incoming_stock_quantity"
  | "incoming_stock_expected_date"
  | "expiry_date"
  | "expiry_quantity"
  | "supplier_id_or_name"
  | "supplier_lead_time_days"
  | "pack_size";

export type FieldStatus =
  | "core"
  | "conditional_core"
  | "feature_dependent"
  | "later_locked";

export type ValueKind = "date" | "decimal" | "non_negative_decimal" | "text" | "non_negative_integer";
export type AcquisitionSource = "file" | "aina" | "either";

export interface FieldDefinition {
  readonly field: CanonicalField;
  readonly label: string;
  readonly description: string;
  readonly status: FieldStatus;
  readonly valueKind: ValueKind;
  readonly grain: "transaction" | "product" | "order" | "inbound" | "lot" | "supplier";
  readonly unlocks: readonly string[];
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
  | "expiry_aware_note"
  | "supplier_scenario";

export type CapabilityState = "available" | "needs_information" | "limited" | "locked";

export interface CapabilityReason {
  readonly code: string;
  readonly message: string;
  readonly field?: CanonicalField;
  readonly acquisitionSource?: AcquisitionSource;
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

export interface NormalizationEvent {
  readonly sourceRow: number;
  readonly sourceColumn: string;
  readonly originalValue: string;
  readonly resultingValue: string;
  readonly normalizationType: "trim_whitespace" | "normalize_line_endings";
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
  readonly sourceSha256: string;
  readonly delimiter: "," | ";" | "\t";
  readonly columns: readonly SourceColumn[];
  readonly rows: readonly ParsedRow[];
  readonly normalizations: readonly NormalizationEvent[];
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

export interface CsvParseOptions {
  readonly sourceMode: SourceMode;
  readonly sourceName: string;
  readonly mimeType?: string;
  readonly maxBytes?: number;
  readonly maxRows?: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: CsvProgress) => void;
}

export interface CsvProgress {
  readonly phase: "decode" | "detect_delimiter" | "parse" | "complete";
  readonly processed: number;
  readonly total: number;
}

export interface FieldMapping {
  readonly targetField: CanonicalField;
  readonly sourceColumnId: string;
  readonly confirmed: boolean;
  readonly confirmationSource?: "retailer";
}

export interface MappingState {
  readonly mappings: Readonly<Partial<Record<CanonicalField, FieldMapping>>>;
  readonly identityMode?: "stable" | "composite";
  readonly identityConfirmed: boolean;
}

export interface CandidateScore {
  readonly targetField: CanonicalField;
  readonly sourceColumnId: string;
  readonly sourceHeader: string;
  readonly semanticScore: number;
  readonly lexicalScore: number;
  readonly typeScore: number;
  readonly combinedScore: number;
  readonly exactAlias: boolean;
}

export interface MappingProposal {
  readonly targetField: CanonicalField;
  readonly sourceColumnId?: string;
  readonly sourceHeader?: string;
  readonly previewValues: readonly string[];
  readonly score?: number;
  readonly scoreBand: "exact_alias" | "high" | "unconfirmed";
  readonly reason: string;
  readonly confirmed: false;
  readonly candidates: readonly CandidateScore[];
}

export interface MappingProposalResult {
  readonly proposals: readonly MappingProposal[];
  readonly usedSemanticModel: boolean;
  readonly fallbackNotice?: string;
}

export interface SemanticScoreRequest {
  readonly sourceHeader: string;
  readonly targetField: CanonicalField;
  readonly targetPrompts: readonly string[];
}

/** Scores normalized headers with a local browser model supplied by the frontend. */
export interface SemanticScorer {
  readonly kind: "local-browser-model";
  /** Returns one normalized semantic similarity score for each request. */
  score(requests: readonly SemanticScoreRequest[]): Promise<readonly number[]>;
}

export interface CapabilityEvidenceContext {
  readonly validFields?: ReadonlySet<CanonicalField>;
  readonly hasValidRows?: boolean;
  readonly observedWeekCount?: number;
  readonly recentAverageState?: "standard" | "limited" | "unavailable";
  readonly stockFreshnessState?: "current" | "limited" | "unusable";
  readonly weeksOfCoverEligible?: boolean;
}

export interface IdentityEvidenceEvent {
  readonly event: "identity_confirmed";
  readonly occurredAt: string;
  readonly mode: "stable" | "composite";
  readonly sourceColumns: readonly string[];
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
  readonly identityEvidence: readonly IdentityEvidenceEvent[];
  readonly createdAt: string;
  readonly clearedAt?: string;
}

export interface SessionPreferences {
  readonly locale?: string;
}

export interface SessionEnvelope {
  readonly session: StocklessSession;
  readonly preferences: SessionPreferences;
}
