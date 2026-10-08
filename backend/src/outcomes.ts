import { calendarDaysBetween, parseIsoDate } from "./dates.ts";
import type { PurchaseDecision } from "./decisions.ts";
import type { ReadinessSnapshot } from "./contracts.ts";

export type OutcomeUnit = "pieces" | "kg" | "litres";
export type StockOutcomeKind = "sales" | "stock" | "discarded" | "expired";
export interface ReportingPeriod { readonly start: string; readonly end: string }
export interface OutcomeMassConversion {
  /** kg per recorded piece or litre, never inferred from category or an arbitrary default. */
  readonly kilogramsPerUnit: number;
  readonly source: string;
  readonly estimated?: boolean;
}
export interface RecordedStockOutcome {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly datasetId: string;
  readonly productKey: string;
  readonly kind: StockOutcomeKind;
  readonly date: string;
  readonly quantity: number;
  readonly unit: OutcomeUnit;
  readonly recordedAt: string;
  readonly updatedAt?: string;
  readonly decisionId?: string;
  readonly description?: string;
  readonly conversion?: OutcomeMassConversion;
  readonly origin?: "imported" | "manual";
  readonly provenance?: ImportedOutcomeProvenance;
}
export interface ImportedOutcomeProvenance {
  readonly sourceName: string;
  readonly sourceSha256: string;
  readonly snapshotId: string;
  readonly analysisDate: string;
  readonly worksheetName?: string;
  readonly sourceRows: readonly number[];
}
export interface StockOutcomeInput {
  readonly id?: string;
  readonly datasetId: string;
  readonly productKey: string;
  readonly kind: StockOutcomeKind;
  readonly date: string;
  readonly quantity: number | string;
  readonly unit: OutcomeUnit;
  readonly referenceDate: string;
  readonly recordedAt?: string;
  readonly decisionId?: string;
  readonly description?: string;
  readonly conversion?: OutcomeMassConversion;
}
export class OutcomeValidationError extends Error {
  readonly fields: Readonly<Record<string, string>>;
  constructor(fields: Record<string, string>) {
    super(Object.values(fields).join(" ")); this.name = "OutcomeValidationError"; this.fields = Object.freeze({ ...fields });
  }
}

function validQuantity(raw: number | string): number | undefined {
  if (typeof raw === "string" && !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim())) return undefined;
  const value = typeof raw === "string" ? Number(raw.trim()) : raw;
  return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : undefined;
}
export function createStockOutcome(input: StockOutcomeInput): RecordedStockOutcome {
  const fields: Record<string, string> = {};
  if (!input.datasetId.trim()) fields.datasetId = "Select a dataset.";
  if (input.id !== undefined && !input.id.trim()) fields.id = "An outcome identifier cannot be blank.";
  if (!input.productKey.trim()) fields.productKey = "Select a product.";
  if (!parseIsoDate(input.referenceDate)) fields.referenceDate = "Enter a valid current date.";
  if (!parseIsoDate(input.date) || input.date > input.referenceDate) fields.date = "Enter a valid outcome date that is not in the future.";
  if (!["sales", "stock", "discarded", "expired"].includes(input.kind)) fields.kind = "Choose sales, stock, discarded or expired stock.";
  if (!["pieces", "kg", "litres"].includes(input.unit)) fields.unit = "Choose pieces, kg or litres.";
  const quantity = validQuantity(input.quantity);
  if (quantity === undefined) fields.quantity = "Enter a finite non-negative quantity. Zero is a recorded outcome.";
  if (input.unit === "pieces" && quantity !== undefined && !Number.isSafeInteger(quantity)) fields.quantity = "Record pieces as whole numbers, or choose kg or litres for a measured quantity.";
  const recordedAt = input.recordedAt ?? new Date().toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(recordedAt) || !Number.isFinite(Date.parse(recordedAt))) fields.recordedAt = "Enter a valid recording date and time.";
  if (input.conversion && (!Number.isFinite(input.conversion.kilogramsPerUnit) || input.conversion.kilogramsPerUnit <= 0 || !input.conversion.source.trim())) {
    fields.conversion = "A mass conversion needs a positive kg-per-unit value and its source.";
  }
  if (Object.keys(fields).length) throw new OutcomeValidationError(fields);
  return Object.freeze({ schemaVersion: 1 as const, id: input.id ?? globalThis.crypto.randomUUID(), datasetId: input.datasetId,
    productKey: input.productKey, kind: input.kind, date: input.date, quantity: quantity!, unit: input.unit, recordedAt,
    decisionId: input.decisionId?.trim() || undefined, description: input.description?.trim() || undefined,
    conversion: input.conversion && Object.freeze({ ...input.conversion, source: input.conversion.source.trim() }), origin: "manual" as const,
  });
}

export interface ImportedReturnEvidence {
  readonly productKey: string;
  readonly date: string;
  readonly returnedQuantity: number;
  readonly originalSignedQuantity: number;
  readonly unit: "pieces";
  readonly provenance: ImportedOutcomeProvenance;
}
export interface ImportedOutcomeExclusion {
  readonly productKey?: string;
  readonly sourceRows: readonly number[];
  readonly reason: string;
}
export interface ImportedOutcomeEvidence {
  readonly state: "available" | "unavailable";
  readonly provenance: Omit<ImportedOutcomeProvenance, "sourceRows">;
  readonly outcomes: readonly RecordedStockOutcome[];
  readonly returns: readonly ImportedReturnEvidence[];
  readonly excluded: readonly ImportedOutcomeExclusion[];
  readonly reason?: string;
}

/** Read observed records from the checked source, without inferring discarded stock or causation. */
export function buildImportedOutcomeEvidence(snapshot: ReadinessSnapshot, datasetId: string, options: {
  readonly expectedSourceSha256?: string; readonly expectedSnapshotId?: string; readonly extractedAt?: string;
} = {}): ImportedOutcomeEvidence {
  const source = Object.freeze({ sourceName: snapshot.sourceName, sourceSha256: snapshot.sourceSha256, snapshotId: snapshot.id,
    analysisDate: snapshot.analysisDate, worksheetName: snapshot.worksheetName });
  const unavailable = (reason: string): ImportedOutcomeEvidence => Object.freeze({ state: "unavailable", provenance: source,
    outcomes: Object.freeze([]), returns: Object.freeze([]), excluded: Object.freeze([]), reason });
  if (!datasetId.trim()) return unavailable("Select the dataset associated with these imported records.");
  if (!snapshot.sourceName || !snapshot.sourceSha256 || !snapshot.id || !parseIsoDate(snapshot.analysisDate)) return unavailable("Checked source provenance is incomplete.");
  if (snapshot.sourceMode !== "user") return unavailable("Sample records are excluded from business outcome history.");
  if (options.expectedSourceSha256 !== undefined && options.expectedSourceSha256 !== snapshot.sourceSha256
    || options.expectedSnapshotId !== undefined && options.expectedSnapshotId !== snapshot.id) return unavailable("Imported records do not match the selected checked source.");
  const recordedAt = options.extractedAt ?? new Date().toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(recordedAt) || !Number.isFinite(Date.parse(recordedAt))) return unavailable("The import evidence extraction date is invalid.");
  const blocked = new Set(snapshot.productLimitations.filter(item => item.code === "IDENTITY_CONFLICT").map(item => item.productKey));
  for (const issue of snapshot.issues) if (issue.productKey && issue.issueCode === "PRODUCT_IDENTITY_CONFLICT" && issue.resolutionState === "unresolved") blocked.add(issue.productKey);
  const outcomes: RecordedStockOutcome[] = [], returns: ImportedReturnEvidence[] = [], excluded: ImportedOutcomeExclusion[] = [];
  const provenance = (rows: readonly number[]): ImportedOutcomeProvenance => Object.freeze({ ...source, sourceRows: Object.freeze([...rows]) });
  const conversion = (productKey: string) => {
    const weight = snapshot.productWeights?.find(item => item.productKey === productKey);
    return weight?.state === "usable" && Number.isFinite(weight.value) && weight.value > 0
      ? Object.freeze({ kilogramsPerUnit: weight.value, source: `Validated file weight: ${weight.sourceColumn ?? "Weight per unit"}; source rows ${weight.sourceRows.join(", ")}` }) : undefined;
  };
  for (const row of snapshot.rows) {
    const values = row.interpretedValues;
    let reason: string | undefined;
    if (row.useState !== "used") reason = "The source row was excluded by readiness; it cannot become a recorded outcome.";
    else if (!row.productKey || blocked.has(row.productKey)) reason = "Product identity is missing or unresolved.";
    else if (!values.transactionDate || !parseIsoDate(values.transactionDate) || values.transactionDate > snapshot.analysisDate) reason = "The observed sale date is invalid or later than the analysis date.";
    else if (values.quantitySold === undefined || !Number.isFinite(values.quantitySold)) reason = "The observed quantity is unavailable.";
    if (reason) { excluded.push(Object.freeze({ productKey: row.productKey, sourceRows: Object.freeze([row.sourceRow]), reason })); continue; }
    const productKey = row.productKey!, quantity = values.quantitySold!, date = values.transactionDate!, evidence = provenance([row.sourceRow]);
    if (quantity < 0) {
      returns.push(Object.freeze({ productKey, date, returnedQuantity: -quantity, originalSignedQuantity: quantity, unit: "pieces", provenance: evidence }));
      continue;
    }
    outcomes.push(Object.freeze({ schemaVersion: 1, id: `imported:${snapshot.sourceSha256}:sales:${row.sourceRow}`, datasetId, productKey,
      kind: "sales", date, quantity, unit: "pieces", recordedAt, origin: "imported", provenance: evidence, conversion: conversion(productKey) }));
  }
  for (const stock of snapshot.productStock) {
    const rows = snapshot.rows.filter(row => row.useState === "used" && row.productKey === stock.productKey && row.interpretedValues.stockAsOfDate === stock.stockAsOfDate
      && row.interpretedValues.currentStock === stock.currentStock).map(row => row.sourceRow);
    const date = stock.stockAsOfDate, quantity = stock.currentStock;
    if (blocked.has(stock.productKey) || !date || !parseIsoDate(date) || date > snapshot.analysisDate || quantity === undefined || !Number.isFinite(quantity) || quantity < 0
      || !rows.length || stock.reasonCodes.some(code => /CONFLICTING|INVALID|MISSING|FUTURE/.test(code))) {
      excluded.push(Object.freeze({ productKey: stock.productKey, sourceRows: Object.freeze(rows), reason: "No unambiguous dated stock count is linked to usable source rows." })); continue;
    }
    // Repeated sales rows may carry the same latest count. It is a single inventory observation.
    outcomes.push(Object.freeze({ schemaVersion: 1, id: `imported:${snapshot.sourceSha256}:stock:${stock.productKey}:${date}`, datasetId, productKey: stock.productKey,
      kind: "stock", date, quantity, unit: "pieces", recordedAt, origin: "imported", provenance: provenance(rows), conversion: conversion(stock.productKey) }));
  }
  return Object.freeze({ state: "available", provenance: source, outcomes: Object.freeze(outcomes), returns: Object.freeze(returns), excluded: Object.freeze(excluded) });
}

export function updateStockOutcome(existing: RecordedStockOutcome, input: Omit<StockOutcomeInput, "id" | "datasetId" | "productKey">): RecordedStockOutcome {
  const updated = createStockOutcome({ ...input, id: existing.id, datasetId: existing.datasetId, productKey: existing.productKey });
  return Object.freeze({ ...updated, recordedAt: existing.recordedAt, updatedAt: updated.recordedAt });
}

export function validateReportingPeriod(period: ReportingPeriod): void {
  if (!parseIsoDate(period.start) || !parseIsoDate(period.end) || period.start > period.end) {
    throw new OutcomeValidationError({ period: "Choose a valid reporting period with the start no later than the end." });
  }
}

export type RecordedOutcomeSummary =
  | { readonly state: "no_record" | "unavailable"; readonly reason: string; readonly correctiveAction: string; readonly recordCount: number; readonly productCount: number }
  | { readonly state: "recorded"; readonly quantity: number; readonly unit: OutcomeUnit; readonly recordCount: number; readonly productCount: number; readonly label: "Recorded zero" | "Recorded outcome" };
export interface OutcomeSummaryOptions {
  readonly datasetId: string;
  readonly period: ReportingPeriod;
  readonly kinds?: readonly StockOutcomeKind[];
  readonly productKey?: string;
  readonly unit?: OutcomeUnit;
}

/** Only observed records are summed. Stock snapshots use the latest count per product. */
export function summarizeRecordedOutcomes(outcomes: readonly RecordedStockOutcome[], options: OutcomeSummaryOptions): RecordedOutcomeSummary {
  validateReportingPeriod(options.period);
  const selected = outcomes.filter(item => item.datasetId === options.datasetId && (!options.productKey || item.productKey === options.productKey)
    && (!options.kinds || options.kinds.includes(item.kind)) && item.date >= options.period.start && item.date <= options.period.end);
  if (!selected.length) return Object.freeze({ state: "no_record", reason: "No outcome recorded for this period.", correctiveAction: "Record an observed outcome for the selected product and period.", recordCount: 0, productCount: 0 });
  const kinds = new Set(selected.map(item => item.kind));
  if (kinds.has("stock") && kinds.size > 1) return Object.freeze({ state: "unavailable", reason: "Stock snapshots cannot be added to sales or waste flows.", correctiveAction: "Review stock, sales and waste as separate measures.", recordCount: selected.length, productCount: new Set(selected.map(item => item.productKey)).size });
  let records = selected;
  if (kinds.size === 1 && kinds.has("stock")) {
    const latest = new Map<string, RecordedStockOutcome>();
    for (const record of [...selected].sort((a, b) => b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id))) if (!latest.has(record.productKey)) latest.set(record.productKey, record);
    records = [...latest.values()];
  }
  const units = new Set(records.map(item => item.unit));
  const unit = options.unit ?? (units.size === 1 ? records[0].unit : "kg");
  const converted = records.map(item => item.unit === unit ? item.quantity
    : unit === "kg" && item.conversion ? item.quantity * item.conversion.kilogramsPerUnit : undefined);
  const counts = { recordCount: records.length, productCount: new Set(records.map(item => item.productKey)).size };
  if (converted.some(value => value === undefined || !Number.isFinite(value))) return Object.freeze({ state: "unavailable", reason: "Recorded units are incompatible or a known mass conversion is missing.", correctiveAction: "Review each recorded unit and provide its measured kg-per-unit conversion, or compare one unit at a time.", ...counts });
  const quantity = converted.reduce<number>((sum, value) => sum + value!, 0);
  if (!Number.isFinite(quantity) || quantity > Number.MAX_SAFE_INTEGER) return Object.freeze({ state: "unavailable", reason: "The outcome total is outside the supported numeric range.", correctiveAction: "Check the recorded quantities and conversions.", ...counts });
  return Object.freeze({ state: "recorded", quantity, unit, ...counts, label: quantity === 0 ? "Recorded zero" : "Recorded outcome" });
}

export function compareOutcomePeriods(outcomes: readonly RecordedStockOutcome[], options: Omit<OutcomeSummaryOptions, "period"> & { readonly first: ReportingPeriod; readonly second: ReportingPeriod }) {
  validateReportingPeriod(options.first); validateReportingPeriod(options.second);
  const first = summarizeRecordedOutcomes(outcomes, { ...options, period: options.first });
  const second = summarizeRecordedOutcomes(outcomes, { ...options, period: options.second });
  if (calendarDaysBetween(options.first.start, options.first.end) !== calendarDaysBetween(options.second.start, options.second.end)) {
    return Object.freeze({ state: "unavailable" as const, first, second, reason: "Reporting periods must have the same inclusive number of days.", correctiveAction: "Choose two equal-length periods." });
  }
  if (first.state !== "recorded" || second.state !== "recorded") return Object.freeze({ state: "unavailable" as const, first, second, reason: "Both periods need compatible recorded outcomes.", correctiveAction: "Record the missing outcomes or review their units." });
  if (first.unit !== second.unit) return Object.freeze({ state: "unavailable" as const, first, second, reason: "The periods use different quantity units.", correctiveAction: "Compare the same units or supply known mass conversions and choose kg." });
  return Object.freeze({ state: "compared" as const, first, second, change: second.quantity - first.quantity, unit: first.unit,
    percentageChange: first.quantity === 0 ? null : (second.quantity - first.quantity) / first.quantity * 100 });
}

export function reviewDecisionOutcomes(decision: PurchaseDecision, outcomes: readonly RecordedStockOutcome[], period: ReportingPeriod) {
  validateReportingPeriod(period);
  const records = outcomes.filter(item => item.datasetId === decision.datasetId && item.productKey === decision.productKey
    && (!item.decisionId || item.decisionId === decision.id)
    && (item.date > decision.decisionDate || item.date === decision.decisionDate && item.decisionId === decision.id)
    && item.date >= period.start && item.date <= period.end);
  return Object.freeze({ state: records.length ? "recorded" as const : "no_record" as const,
    label: records.length ? "Recorded outcomes" : "No outcome recorded", recommendation: decision.recommendation,
    finalQuantity: decision.finalQuantity, decisionDate: decision.decisionDate, records: Object.freeze(records),
    limitation: "Recorded outcomes and the original planning estimate are separate; this review does not establish causation." });
}

export type HistoricalFinancialSummary =
  | { readonly state: "unavailable"; readonly reason: string; readonly correctiveAction: string; readonly includedCount: number; readonly excludedCount: number }
  | { readonly state: "estimated"; readonly amount: number; readonly currency: "MYR"; readonly includedCount: number; readonly excludedCount: number;
    readonly lines: readonly { readonly decisionId: string; readonly productKey: string; readonly date: string; readonly quantity: number; readonly unitCost: number; readonly amount: number }[];
    readonly excluded: readonly { readonly decisionId: string; readonly reason: string }[]; readonly label: "Historical estimated purchase commitments" };

/** Frozen decision-time prices stay historical estimates even after current costs change. */
export function summarizeDecisionFinancialHistory(decisions: readonly PurchaseDecision[], options: { readonly datasetId: string; readonly period: ReportingPeriod }): HistoricalFinancialSummary {
  validateReportingPeriod(options.period);
  const selected = decisions.filter(item => item.datasetId === options.datasetId && item.recommendation.sourceMode === "user"
    && item.decisionDate >= options.period.start && item.decisionDate <= options.period.end);
  const lines: { decisionId: string; productKey: string; date: string; quantity: number; unitCost: number; amount: number }[] = [];
  const excluded: { decisionId: string; reason: string }[] = [];
  for (const decision of selected) {
    const cost = decision.recommendation.unitCost;
    if (cost === undefined || decision.recommendation.currency !== "MYR" || !Number.isFinite(cost) || cost < 0) {
      excluded.push({ decisionId: decision.id, reason: "No validated Unit Cost was preserved with this decision." }); continue;
    }
    const amount = Math.round((decision.finalQuantity * cost + Number.EPSILON) * 100) / 100;
    if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER / 100) {
      excluded.push({ decisionId: decision.id, reason: "The historical estimated amount is outside the supported numeric range." }); continue;
    }
    lines.push({ decisionId: decision.id, productKey: decision.productKey, date: decision.decisionDate, quantity: decision.finalQuantity, unitCost: cost, amount });
  }
  if (!lines.length) return Object.freeze({ state: "unavailable", reason: selected.length ? "No historical decision has usable frozen cost evidence." : "No financial estimate recorded for this period.",
    correctiveAction: "Record purchase decisions with validated Unit Cost. Historical prices are not replaced by current prices.", includedCount: 0, excludedCount: excluded.length });
  const amount = Math.round((lines.reduce((sum, item) => sum + item.amount, 0) + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER / 100) return Object.freeze({ state: "unavailable", reason: "The historical financial total is outside the supported numeric range.", correctiveAction: "Review the recorded quantities and costs.", includedCount: 0, excludedCount: selected.length });
  return Object.freeze({ state: "estimated", amount, currency: "MYR", includedCount: lines.length, excludedCount: excluded.length,
    lines: Object.freeze(lines.map(item => Object.freeze(item))), excluded: Object.freeze(excluded.map(item => Object.freeze(item))), label: "Historical estimated purchase commitments" });
}

export function compareFinancialHistoryPeriods(decisions: readonly PurchaseDecision[], options: { readonly datasetId: string; readonly first: ReportingPeriod; readonly second: ReportingPeriod }) {
  validateReportingPeriod(options.first); validateReportingPeriod(options.second);
  const first = summarizeDecisionFinancialHistory(decisions, { datasetId: options.datasetId, period: options.first });
  const second = summarizeDecisionFinancialHistory(decisions, { datasetId: options.datasetId, period: options.second });
  if (calendarDaysBetween(options.first.start, options.first.end) !== calendarDaysBetween(options.second.start, options.second.end)) {
    return Object.freeze({ state: "unavailable" as const, first, second, reason: "Reporting periods must have the same inclusive number of days.", correctiveAction: "Choose two equal-length periods." });
  }
  if (first.state !== "estimated" || second.state !== "estimated") return Object.freeze({ state: "unavailable" as const, first, second, reason: "Both periods need recorded financial estimates with validated costs.", correctiveAction: "Review missing historical cost evidence; do not fill it with today's prices." });
  return Object.freeze({ state: "compared" as const, first, second, change: Math.round((second.amount - first.amount + Number.EPSILON) * 100) / 100,
    currency: "MYR" as const, label: "Estimated purchase-commitment difference", percentageChange: first.amount === 0 ? null : (second.amount - first.amount) / first.amount * 100 });
}
