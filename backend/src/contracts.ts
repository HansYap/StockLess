
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
  readonly normalizationType:
    | "trim_whitespace"
    | "normalize_line_endings"
    | "confirmed_date_format";
  readonly confirmationId?: string;
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
  | "ROW_LIMIT_EXCEEDED";

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

export type ConfirmedDateFormat =
  | "DD/MM/YYYY"
  | "MM/DD/YYYY"
  | "DD.MM.YYYY"
  | "MM.DD.YYYY"
  | "DD-MM-YYYY"
  | "MM-DD-YYYY";

export interface DateFormatConfirmation {
  readonly sourceColumnId: string;
  readonly format: ConfirmedDateFormat;
  readonly confirmationId: string;
}

export interface DateFormatDetection {
  readonly sourceColumnId: string;
  readonly state: "empty" | "iso" | "candidate" | "ambiguous" | "unsupported";
  readonly candidates: readonly ConfirmedDateFormat[];
}

export type RowUseState = "used" | "excluded";

export type DataIssueCode =
  | "INVALID_DATE"
  | "DATE_FORMAT_CONFIRMATION_REQUIRED"
  | "INVALID_QUANTITY"
  | "MISSING_IDENTITY"
  | "INVALID_CURRENT_STOCK"
  | "MISSING_CURRENT_STOCK"
  | "INVALID_STOCK_DATE"
  | "MISSING_STOCK_DATE"
  | "FUTURE_STOCK_DATE"
  | "CONFLICTING_CURRENT_STOCK"
  | "CONFLICTING_STOCK_DATE"
  | "DUPLICATE_CANDIDATE"
  | "DUPLICATE_CONFIRMED";

export interface DataIssue {
  readonly id: string;
  readonly sourceRow: number;
  readonly productKey?: string;
  readonly originalProductHint?: string;
  readonly issueCode: DataIssueCode;
  readonly field?: CanonicalField;
  readonly sourceColumn?: string;
  readonly observedValue: string;
  readonly reason: string;
  readonly correctiveAction: string;
  readonly resolutionState: "unresolved" | "resolved" | "not_applicable";
}

export interface InterpretedRowValues {
  readonly transactionDate?: string;
  readonly quantitySold?: number;
  readonly productCode?: string;
  readonly productName?: string;
  readonly packVariant?: string;
  readonly currentStock?: number;
  readonly stockAsOfDate?: string;
}

export interface ValidatedRow {
  readonly sourceRow: number;
  readonly productKey?: string;
  readonly originalProductHint?: string;
  readonly originalValues: readonly string[];
  readonly normalizedValues: readonly string[];
  readonly interpretedValues: InterpretedRowValues;
  readonly duplicateFingerprint: string;
  readonly useState: RowUseState;
  readonly issueIds: readonly string[];
}

export type DuplicateDecision = "keep_both" | "treat_as_duplicate";

export interface DuplicateGroup {
  readonly fingerprint: string;
  readonly sourceRows: readonly number[];
  readonly productKeys: readonly string[];
  readonly decision: DuplicateDecision | "unresolved";
}

export interface ReconciliationSummary {
  readonly rowsIn: number;
  readonly rowsUsed: number;
  readonly rowsExcluded: number;
  readonly rowsSafelyNormalized: number;
}

export type StockFreshnessState = "current" | "limited" | "unusable";

export interface StockFreshness {
  readonly snapshotDate?: string;
  readonly analysisDate: string;
  readonly ageDays?: number;
  readonly state: StockFreshnessState;
  readonly reasonCode?: "MISSING_STOCK_DATE" | "INVALID_STOCK_DATE" | "FUTURE_STOCK_DATE" | "STALE_STOCK";
}

export interface ProductStockEvidence {
  readonly productKey: string;
  readonly currentStock?: number;
  readonly stockAsOfDate?: string;
  readonly freshness: StockFreshness;
  readonly usableForCover: boolean;
  readonly reasonCodes: readonly string[];
}

export interface ProductLimitation {
  readonly productKey: string;
  readonly code: "DUPLICATE_UNRESOLVED";
  readonly message: string;
}

export interface ReadinessOptions {
  readonly analysisDate: string;
  readonly dateConfirmations?: readonly DateFormatConfirmation[];
  readonly duplicateDecisions?: Readonly<Record<string, DuplicateDecision>>;
}

export interface ReadinessSnapshot {
  readonly id: string;
  readonly sourceMode: SourceMode;
  readonly sourceName: string;
  readonly sourceSha256: string;
  readonly analysisDate: string;
  readonly rows: readonly ValidatedRow[];
  readonly issues: readonly DataIssue[];
  readonly normalizations: readonly NormalizationEvent[];
  readonly duplicateGroups: readonly DuplicateGroup[];
  readonly reconciliation: ReconciliationSummary;
  readonly productStock: readonly ProductStockEvidence[];
  readonly productLimitations: readonly ProductLimitation[];
}

export type WeekState =
  | "missing"
  | "confirmed_zero_sales"
  | "net_zero_with_activity"
  | "observed_demand";

export interface WeeklyEvidence {
  readonly productKey: string;
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly positiveQuantity: number | null;
  readonly negativeQuantity: number | null;
  readonly netQuantity: number | null;
  readonly recordCount: number;
  readonly state: WeekState;
  readonly sourceRows: readonly number[];
}

export interface RecentWindowEvidence {
  readonly selectedWeekStarts: readonly string[];
  readonly windowStart?: string;
  readonly windowEnd?: string;
  readonly observedWeekCount: number;
  readonly state: "standard" | "limited" | "unavailable";
  readonly reasonCodes: readonly ("FEWER_THAN_8_COMPLETED_WEEKS" | "MISSING_WEEK_IN_RECENT_SPAN" | "NO_COMPLETED_OBSERVED_WEEK")[];
}

export interface ProductTimelineSummary {
  readonly productKey: string;
  readonly firstWeek: string;
  readonly lastWeek: string;
  readonly dateRangeStart: string;
  readonly dateRangeEnd: string;
  readonly observedWeekCount: number;
  readonly weeksInSpan: number;
  readonly missingWeekCount: number;
}

export interface ProductTimeline {
  readonly productKey: string;
  readonly weeks: readonly WeeklyEvidence[];
  readonly summary: ProductTimelineSummary;
  readonly recentWindow: RecentWindowEvidence;
}

export type RecentAverageReasonCode = RecentWindowEvidence["reasonCodes"][number];

export interface RecentAverageEvidence {
  readonly value?: number;
  readonly state: "standard" | "limited" | "cannot_calculate";
  readonly selectedWeekStarts: readonly string[];
  readonly windowStart?: string;
  readonly windowEnd?: string;
  readonly observedWeekCount: number;
  readonly reasonCodes: readonly RecentAverageReasonCode[];
}

export type CoverReasonCode =
  | "MISSING_CURRENT_STOCK"
  | "INVALID_CURRENT_STOCK"
  | "CONFLICTING_CURRENT_STOCK"
  | "MISSING_STOCK_DATE"
  | "INVALID_STOCK_DATE"
  | "CONFLICTING_STOCK_DATE"
  | "FUTURE_STOCK_DATE"
  | "STALE_STOCK"
  | "NO_COMPLETED_OBSERVED_WEEK"
  | "ZERO_AVERAGE"
  | "NEGATIVE_AVERAGE"
  | "FEWER_THAN_8_COMPLETED_WEEKS"
  | "MISSING_WEEK_IN_RECENT_SPAN"
  | "AGED_STOCK"
  | "DUPLICATE_UNRESOLVED";

export interface WeeksOfCoverEvidence {
  readonly value?: number;
  readonly state: "standard" | "limited" | "cannot_calculate";
  readonly currentStock?: number;
  readonly recentAverage?: number;
  readonly stockAsOfDate?: string;
  readonly stockAgeDays?: number;
  readonly freshnessState?: StockFreshnessState;
  readonly reasonCodes: readonly CoverReasonCode[];
}

export interface DemandProductEvidence {
  readonly productKey: string;
  readonly displayName: string;
  readonly timeline: ProductTimeline;
  readonly recentAverage: RecentAverageEvidence;
  readonly cover: WeeksOfCoverEvidence;
  readonly state: "standard" | "limited";
  readonly stateReasons: readonly (RecentAverageReasonCode | "DUPLICATE_UNRESOLVED")[];
  /** Iteration 1 is intentionally descriptive and never forecast-ready. */
  readonly forecastReady: false;
}

export interface DemandReview {
  readonly snapshotId: string;
  readonly analysisDate: string;
  readonly products: readonly DemandProductEvidence[];
}

export interface CorrectionReportMetadata {
  readonly snapshotId: string;
  readonly issueTotal: number;
  readonly rowsIn: number;
  readonly rowsUsed: number;
  readonly rowsExcluded: number;
  readonly rowsSafelyNormalized: number;
}

export interface CorrectionReport {
  readonly metadata: CorrectionReportMetadata;
  readonly csvText: string;
  readonly utf8Bytes: Uint8Array;
}
