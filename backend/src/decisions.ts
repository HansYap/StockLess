import type { ProductPurchaseInputs, ProductPurchasePlan, SourceMode } from "./contracts.ts";
import { parseIsoDate } from "./dates.ts";

export type DecisionResponse = "Followed" | "Changed" | "Ignored";

/** Evidence is copied when a person saves a decision; a later import never rewrites it. */
export interface DecisionRecommendationSnapshot {
  readonly productKey: string;
  readonly productName: string;
  readonly productCode?: string;
  readonly packSize?: string;
  readonly sourceName: string;
  readonly sourceSha256: string;
  readonly sourceMode: SourceMode;
  readonly analysisDate: string;
  readonly policyVersion: string;
  readonly snapshotId?: string;
  readonly recommendedQuantity: number;
  readonly quantityUnit: string;
  readonly inputs?: ProductPurchaseInputs;
  readonly plan?: ProductPurchasePlan;
  readonly unitCost?: number;
  readonly currency?: "MYR";
}

export interface PurchaseDecision {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly datasetId: string;
  readonly productKey: string;
  readonly response: DecisionResponse;
  readonly finalQuantity: number;
  readonly decisionDate: string;
  readonly recordedAt: string;
  readonly updatedAt?: string;
  readonly restockDate?: string;
  readonly reason?: string;
  readonly supplier?: string;
  readonly recommendation: DecisionRecommendationSnapshot;
}

export class DecisionValidationError extends Error {
  readonly fields: Readonly<Record<string, string>>;
  constructor(fields: Record<string, string>) {
    super(Object.values(fields).join(" "));
    this.name = "DecisionValidationError";
    this.fields = Object.freeze({ ...fields });
  }
}

export interface PurchaseDecisionInput {
  readonly id?: string;
  readonly datasetId: string;
  readonly response: DecisionResponse;
  readonly finalQuantity?: number | string;
  readonly decisionDate?: string;
  /** The caller supplies today's date explicitly, independent of the analysis date. */
  readonly referenceDate: string;
  readonly recordedAt?: string;
  readonly restockDate?: string;
  readonly reason?: string;
  readonly supplier?: string;
  readonly recommendation: DecisionRecommendationSnapshot;
}

export type PurchaseDecisionEdit = Omit<PurchaseDecisionInput, "id" | "datasetId" | "recommendation">;

function text(value: string | undefined): string | undefined { return value?.trim() || undefined; }
function timestamp(value: string | undefined): string {
  const result = value ?? new Date().toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(result) || !Number.isFinite(Date.parse(result))) {
    throw new DecisionValidationError({ recordedAt: "Enter a valid recording date and time." });
  }
  return result;
}

/** A defensive copy prevents callers, browser storage clones and old drafts sharing evidence. */
function frozenCopy<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(item => frozenCopy(item))) as T;
  if (value && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, frozenCopy(item)]))) as T;
  return value;
}

function wholeQuantity(value: number | string | undefined): number | undefined {
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) return undefined;
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  return parsed !== undefined && Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 999_999 ? parsed : undefined;
}

export function createPurchaseDecision(input: PurchaseDecisionInput): PurchaseDecision {
  const fields: Record<string, string> = {};
  const evidence = input.recommendation;
  const recordedAt = timestamp(input.recordedAt);
  const date = input.decisionDate ?? recordedAt.slice(0, 10);
  if (!text(input.datasetId)) fields.datasetId = "Select a dataset before recording a decision.";
  if (input.id !== undefined && !text(input.id)) fields.id = "A decision identifier cannot be blank.";
  if (!text(evidence.productKey)) fields.productKey = "Select a product before recording a decision.";
  if (!parseIsoDate(input.referenceDate)) fields.referenceDate = "Enter a valid current date.";
  if (!parseIsoDate(date) || date > input.referenceDate) fields.decisionDate = "Enter a valid decision date that is not in the future.";
  if (!parseIsoDate(evidence.analysisDate) || !text(evidence.sourceSha256) || !text(evidence.sourceName) || !text(evidence.policyVersion) || !text(evidence.quantityUnit)) {
    fields.recommendation = "A dated recommendation with source and policy evidence is required.";
  }
  if (evidence.sourceMode !== "user" && evidence.sourceMode !== "sample") fields.sourceMode = "Identify whether the recommendation uses sample data.";
  const recommended = wholeQuantity(evidence.recommendedQuantity);
  if (recommended === undefined) fields.recommendation = "A usable whole-number recommendation is required.";
  if (evidence.unitCost !== undefined && (!Number.isFinite(evidence.unitCost) || evidence.unitCost < 0 || evidence.currency !== "MYR")) {
    fields.unitCost = "Frozen cost evidence must contain a finite non-negative validated Unit Cost in MYR.";
  }
  if (!["Followed", "Changed", "Ignored"].includes(input.response)) fields.response = "Choose Followed, Changed or Ignored.";
  const finalQuantity = input.response === "Followed" && input.finalQuantity === undefined
    ? recommended : wholeQuantity(input.finalQuantity);
  if (finalQuantity === undefined) fields.finalQuantity = "Enter a whole final quantity from 0 to 999999. Zero means you decided not to order.";
  if (input.response === "Followed" && finalQuantity !== undefined && finalQuantity !== recommended) fields.finalQuantity = "A Followed decision must use the original recommended quantity. Choose Changed to use another quantity.";
  const reason = text(input.reason);
  if (input.response === "Changed" && !reason) fields.reason = "Enter a reason for changing the recommendation.";
  const restockDate = text(input.restockDate);
  if (restockDate && !parseIsoDate(restockDate)) fields.restockDate = "Enter a real restock date using YYYY-MM-DD.";
  if (Object.keys(fields).length) throw new DecisionValidationError(fields);
  return frozenCopy({ schemaVersion: 1 as const, id: input.id ?? globalThis.crypto.randomUUID(), datasetId: input.datasetId,
    productKey: evidence.productKey, response: input.response, finalQuantity: finalQuantity!, decisionDate: date, recordedAt,
    restockDate, reason, supplier: text(input.supplier), recommendation: evidence });
}

/** Only the response is editable. Original recommendation, source, date and inputs stay unchanged. */
export function updatePurchaseDecision(existing: PurchaseDecision, edit: PurchaseDecisionEdit): PurchaseDecision {
  const updated = createPurchaseDecision({ ...edit, id: existing.id, datasetId: existing.datasetId, recommendation: existing.recommendation,
    decisionDate: edit.decisionDate ?? existing.decisionDate, recordedAt: existing.recordedAt });
  return frozenCopy({ ...updated, updatedAt: timestamp(edit.recordedAt) });
}

export function filterPurchaseDecisions(decisions: readonly PurchaseDecision[], filter: {
  readonly datasetId: string; readonly productKey?: string; readonly from?: string; readonly to?: string; readonly search?: string;
}): readonly PurchaseDecision[] {
  if (filter.from && !parseIsoDate(filter.from) || filter.to && !parseIsoDate(filter.to) || filter.from && filter.to && filter.from > filter.to) {
    throw new DecisionValidationError({ period: "Enter a valid decision-history period." });
  }
  const term = filter.search?.trim().toLocaleLowerCase() ?? "";
  return decisions.filter(item => item.datasetId === filter.datasetId && (!filter.productKey || item.productKey === filter.productKey)
    && (!filter.from || item.decisionDate >= filter.from) && (!filter.to || item.decisionDate <= filter.to)
    && (!term || [item.recommendation.productName, item.recommendation.productCode, item.recommendation.packSize, item.reason].join(" ").toLocaleLowerCase().includes(term)))
    .sort((a, b) => b.decisionDate.localeCompare(a.decisionDate) || b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id));
}

export interface FinalisedOrderRow {
  readonly decisionId: string;
  readonly datasetId: string;
  readonly productKey: string;
  readonly productName: string;
  readonly productCode: string;
  readonly packSize: string;
  readonly finalQuantity: number;
  readonly quantityUnit: string;
  readonly supplier: string;
  readonly decisionDate: string;
  readonly restockDate: string;
  readonly sourceMode: SourceMode;
}

/** A newer zero decision supersedes an old positive order; previews are never passed here. */
export function finalisedOrderRows(decisions: readonly PurchaseDecision[], datasetId: string): readonly FinalisedOrderRow[] {
  const latest = new Map<string, PurchaseDecision>();
  for (const decision of filterPurchaseDecisions(decisions, { datasetId })) if (!latest.has(decision.productKey)) latest.set(decision.productKey, decision);
  return Object.freeze([...latest.values()].filter(item => item.finalQuantity > 0).map(item => Object.freeze({
    decisionId: item.id, datasetId: item.datasetId, productKey: item.productKey, productName: item.recommendation.productName,
    productCode: item.recommendation.productCode ?? "", packSize: item.recommendation.packSize ?? "", finalQuantity: item.finalQuantity,
    quantityUnit: item.recommendation.quantityUnit, supplier: item.supplier ?? "", decisionDate: item.decisionDate,
    restockDate: item.restockDate ?? "", sourceMode: item.recommendation.sourceMode,
  })));
}
