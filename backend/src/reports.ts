import type { DemandForecastReview, ProductPurchasePlan, ReadinessSnapshot } from "./contracts.ts";
import type { ImpactReview, MonetaryFigure } from "./impact.ts";
import { summarizeCarbonImpact, type CarbonImpactResult, type CarbonImpactKind } from "./carbon.ts";
import type { PurchaseDecision } from "./decisions.ts";
import { validateReportingPeriod, type RecordedStockOutcome, type ReportingPeriod } from "./outcomes.ts";
import { buildProductTimelines } from "./timeline.ts";
import { buildPurchasePlanReview } from "./purchase-plan.ts";
import { compareSupplierOrders, type SupplierScenario } from "./supplier-order.ts";

export type AnalysisReportCell = string | number | boolean;
export interface AnalysisReportTable {
  readonly id: string;
  readonly title: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly AnalysisReportCell[])[];
}
export interface AnalysisReport {
  readonly schemaVersion: 1;
  readonly metadata: {
    readonly shopName: string;
    readonly datasetId: string;
    readonly datasetName: string;
    readonly sourceName: string;
    readonly sourceSha256: string;
    readonly sourceMode: "user" | "sample";
    readonly sourceLabel: "Sample data" | "Retailer file";
    readonly analysisDate: string;
    readonly period: ReportingPeriod;
    readonly generatedAt: string;
    readonly snapshotId: string;
    readonly currency: "MYR";
  };
  readonly tables: readonly AnalysisReportTable[];
  readonly limitations: readonly string[];
}
export interface AnalysisReportInput {
  readonly snapshot: ReadinessSnapshot;
  readonly forecast: DemandForecastReview;
  readonly plans?: readonly ProductPurchasePlan[];
  readonly impact?: ImpactReview;
  readonly datasetId: string;
  readonly shopName?: string;
  readonly datasetName?: string;
  readonly generatedAt?: string;
  readonly period?: ReportingPeriod;
  /** Legacy records remain in storage; current orders never depend on them. */
  readonly decisions?: readonly PurchaseDecision[];
  readonly outcomes?: readonly RecordedStockOutcome[];
  readonly carbonResults?: readonly CarbonImpactResult[];
  readonly supplierScenariosByProduct?: Readonly<Record<string, readonly SupplierScenario[] | undefined>>;
}

function table(id: string, title: string, columns: readonly string[], rows: readonly (readonly AnalysisReportCell[])[]): AnalysisReportTable {
  if (rows.some(row => row.length !== columns.length)) throw new Error(`Report table ${id} has an inconsistent column count.`);
  return Object.freeze({ id, title, columns: Object.freeze([...columns]), rows: Object.freeze(rows.map(row => Object.freeze([...row]))) });
}
const present = (value: string | number | undefined | null, missing = "Unavailable"): AnalysisReportCell => value === undefined || value === null || value === "" ? missing : value;
const money = (figure: MonetaryFigure | undefined): AnalysisReportCell => figure?.state === "estimated" ? figure.amount : figure?.state === "not_entered" ? "Not entered" : "Unavailable";
const moneyReason = (figure: MonetaryFigure | undefined): string => figure && figure.state !== "estimated" ? figure.reason : "";
const numberInput = (value: ProductPurchasePlan["inputs"]["plannedOrder"] | undefined): AnalysisReportCell => value?.state === "value" ? value.value : "Not entered";
function copyObject<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(copyObject)) as T;
  if (value && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyObject(item)]))) as T;
  return value;
}

/** Snapshot-based, deterministic export data; no displayed estimates are recomputed with a second formula. */
export function buildAnalysisReport(input: AnalysisReportInput): AnalysisReport {
  const { snapshot, forecast } = input;
  if (!input.datasetId.trim()) throw new Error("A dataset identifier is required for a report.");
  if (forecast.snapshotId !== snapshot.id || forecast.analysisDate !== snapshot.analysisDate || input.impact && input.impact.snapshotId !== snapshot.id)
    throw new Error("Report evidence must come from the same current readiness snapshot.");
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(generatedAt) || !Number.isFinite(Date.parse(generatedAt))) throw new Error("A valid report generation date and time is required.");
  const dates = snapshot.rows.flatMap(row => row.interpretedValues.transactionDate && row.interpretedValues.transactionDate <= snapshot.analysisDate ? [row.interpretedValues.transactionDate] : []).sort();
  const recorded = (input.outcomes ?? []).filter(item=>item.datasetId===input.datasetId).map(item => item.date);
  const period = input.period ?? { start: dates[0] ?? snapshot.analysisDate, end: [snapshot.analysisDate, ...recorded].sort().pop()! };
  validateReportingPeriod(period);
  const metadata = Object.freeze({ shopName: input.shopName?.trim() || "Not supplied", datasetId: input.datasetId,
    datasetName: input.datasetName?.trim() || snapshot.sourceName, sourceName: snapshot.sourceName, sourceSha256: snapshot.sourceSha256,
    sourceMode: snapshot.sourceMode, sourceLabel: snapshot.sourceMode === "sample" ? "Sample data" as const : "Retailer file" as const,
    analysisDate: snapshot.analysisDate, period: Object.freeze({ ...period }), generatedAt, snapshotId: snapshot.id, currency: "MYR" as const });
  const plans = new Map((input.plans ?? buildPurchasePlanReview(snapshot, forecast).products).map(item => [item.productKey, item]));
  const forecasts = new Map(forecast.products.map(item => [item.productKey, item]));
  const impact = new Map(input.impact?.products.map(item => [item.productKey, item]) ?? []);
  const keys = new Set([...forecasts.keys(), ...plans.keys(), ...snapshot.rows.flatMap(row => row.productKey ? [row.productKey] : [])]);
  const identities = new Map<string, readonly [string, string, string]>();
  const labelSets = new Map<string, readonly [Set<string>, Set<string>, Set<string>]>();
  for (const row of snapshot.rows) if (row.productKey) {
    const labels = labelSets.get(row.productKey) ?? [new Set<string>(), new Set<string>(), new Set<string>()];
    const values = row.interpretedValues;
    if (values.productName) labels[0].add(values.productName);
    if (values.productCode) labels[1].add(values.productCode);
    if (values.packVariant) labels[2].add(values.packVariant);
    labelSets.set(row.productKey, labels);
  }
  for (const [key, labels] of labelSets) identities.set(key, [[...labels[0]].join(" | ") || "Not supplied", [...labels[1]].join(" | "), [...labels[2]].join(" | ")]);
  const identity = (key: string): readonly AnalysisReportCell[] => identities.get(key) ?? ["Not supplied", "", ""];
  const outcomes = (input.outcomes ?? []).filter(item => item.datasetId === input.datasetId && item.date >= period.start && item.date <= period.end);
  const limitations = Object.freeze([
    "Forecasts, purchase commitments, potential excess and CO2e are estimates; recorded sales and waste are reported separately.",
    "Missing values and unentered quantities are not replaced by zero. Returns remain separate from positive sales demand.",
    "The order list uses current Purchase plan quantities. Editing the plan changes the next export; it does not establish an actual purchase or stock outcome.",
    "Supplier comparisons are quantities and arrival dates; no supplier price or achieved savings is assumed.",
    "Current product and scenario results describe the analysis date and the next four-week demand horizon. The reporting period filters recorded outcomes, not the current forecast or order list.",
    "Only positive current planned quantities appear in the order list. Zero orders and unentered quantities remain distinct in Product Results.",
    "CO2e source agreement is not ground-truth validation or evidence of achieved emissions reductions.",
    "Automatic planned quantities are labelled worked out by StockLess. AI-assigned categories retain model and source provenance and are not manual confirmations.",
    ...(snapshot.sourceMode === "sample" ? ["Sample data: these results are illustrative and are not this retailer's recorded outcomes."] : []),
  ]);
  const tables: AnalysisReportTable[] = [];
  tables.push(table("metadata", "Metadata", ["Field", "Value"], [
    ["Shop", metadata.shopName], ["Dataset", metadata.datasetName], ["Dataset ID", metadata.datasetId], ["Data source", metadata.sourceLabel],
    ["Source file", metadata.sourceName], ["Source SHA-256", metadata.sourceSha256], ["Worksheet", snapshot.worksheetName ?? "Not applicable"],
    ["Analysis date", metadata.analysisDate], ["Reporting period start", period.start], ["Reporting period end", period.end], ["Generated at", generatedAt],
    ["Snapshot ID", snapshot.id], ["Forecast policy", forecast.policyVersion], ["Currency", "MYR"],
    ["Rows in", snapshot.reconciliation.rowsIn], ["Rows used", snapshot.reconciliation.rowsUsed], ["Rows left out", snapshot.reconciliation.rowsExcluded],
  ]));
  tables.push(table("results", "Product Results", ["Product name", "Product code", "Pack size", "Product key", "Readiness", "Reason", "Recorded weeks in last 8", "Demand pattern", "Demand low (4 weeks)", "Demand high (4 weeks)", "Central demand (unrounded)", "Current stock", "Stock count date", "Incoming quantity", "Planned quantity", "Purchase check", "Purchase explanation", "Restock recommendation", "Before expiry adjustment", "After expiry adjustment", "Restock limitation", "Shelf-life cap", "Planned spend (MYR)", "Excess-stock cost (MYR)", "Cost limitation", "Source"],
    [...keys].sort().map(key => {
      const demand = forecasts.get(key), plan = plans.get(key), stock = snapshot.productStock.find(item => item.productKey === key), finance = impact.get(key);
      return [...identity(key), key, demand?.label ?? "Cannot assess", demand?.labelReason?.message ?? "", present(demand?.recordedWeeksInLast8),
        demand?.pattern ?? "Unavailable", present(demand?.range?.low), present(demand?.range?.high), present(demand?.range?.unroundedCentral), present(stock?.currentStock), present(stock?.stockAsOfDate),
        numberInput(plan?.inputs.incomingStock), numberInput(plan?.inputs.plannedOrder), plan?.audit.state === "verdict" ? plan.audit.verdict : plan?.audit.state === "not_planned" ? "Not planned" : "Cannot judge",
        plan?.audit.state === "verdict" ? plan.audit.reasonSentence : plan?.audit.state === "cannot_judge" ? plan.audit.reason : "No planned quantity entered.",
        plan?.estimatedRestock.state === "available" ? plan.estimatedRestock.quantity.value : "Unavailable",
        plan?.estimatedRestock.state === "available" ? present(plan.estimatedRestock.beforeQuantity?.value) : "Unavailable",
        plan?.estimatedRestock.state === "available" ? present(plan.estimatedRestock.afterQuantity?.value) : "Unavailable",
        plan?.estimatedRestock.state === "available" ? plan.estimatedRestock.afterUnavailableReason ?? "" : plan?.estimatedRestock.reason ?? "No restock evidence.",
        plan?.estimatedRestock.state === "available" ? present(plan.estimatedRestock.shelfLifeCap, "Not applied") : "Not applied",
        money(finance?.plannedSpend), money(finance?.excessCost), moneyReason(finance?.plannedSpend), metadata.sourceLabel];
    })));
  tables.push(table("sales", "Sales Records", ["Product name", "Product code", "Pack size", "Product key", "Source row", "Date", "Recorded quantity", "Positive sales", "Returns", "Use state", "Issue IDs", "Source"],
    snapshot.rows.map(row => { const quantity = row.interpretedValues.quantitySold; return [...identity(row.productKey ?? ""), row.productKey ?? "Not supplied", row.sourceRow,
      present(row.interpretedValues.transactionDate), present(quantity), quantity === undefined ? "Unavailable" : Math.max(0, quantity), quantity === undefined ? "Unavailable" : Math.min(0, quantity),
      row.useState === "used" ? "Used" : "Left out", row.issueIds.join("; "), metadata.sourceLabel]; })));
  tables.push(table("history", "Weekly Demand History", ["Product name", "Product code", "Pack size", "Product key", "Week start", "Week end", "Positive sales", "Returns", "Net quantity", "Week state", "Record count", "Source rows"],
    buildProductTimelines(snapshot).flatMap(product => product.weeks.map(week => [...identity(product.productKey), product.productKey, week.weekStart, week.weekEnd,
      present(week.positiveQuantity, "Missing week"), present(week.negativeQuantity, "Missing week"), present(week.netQuantity, "Missing week"), week.state, week.recordCount, week.sourceRows.join("; ")]))));
  tables.push(table("scenarios", "Supplier Scenarios", ["Product name", "Product code", "Pack size", "Product key", "Supplier", "Supplier ID", "Case size", "Minimum order", "Lead time (days)", "Scenario quantity", "Cases", "Arrival date", "Beyond 4 weeks", "Extra units", "Status", "Reason"],
    [...keys].sort().flatMap(key => compareSupplierOrders(plans.get(key)?.estimatedRestock, input.supplierScenariosByProduct?.[key] ?? [], snapshot.analysisDate).map(scenario => [
      ...identity(key), key, scenario.name, scenario.id, present(scenario.terms.caseSize, "Not entered"), present(scenario.terms.minimumOrder, "Not entered"), present(scenario.terms.leadTimeDays, "Not entered"),
      scenario.result.state === "available" ? scenario.result.quantity : "Unavailable", scenario.result.state === "available" ? present(scenario.result.cases) : "Unavailable",
      scenario.result.state === "available" ? present(scenario.result.arrivalDate) : "Unavailable", scenario.result.state === "available" ? scenario.result.beyondPlanningWindow : "Unavailable",
      present(scenario.extraUnits), scenario.result.state, scenario.result.state === "unavailable" ? scenario.result.reason : "",
    ]))));
  tables.push(table("impact", "Financial Impact", ["Product name", "Product code", "Pack size", "Product key", "Planned quantity", "Scenario quantity", "Potential excess units", "Potential shortfall units", "Planned spend (MYR)", "Incoming spend (MYR)", "Combined commitment (MYR)", "Excess-stock cost (MYR)", "Scenario spend (MYR)", "Estimated purchase-spend difference (MYR)", "Exclusion or limitation", "Source"],
    (input.impact?.products ?? []).map(item => [...identity(item.productKey), item.productKey, present(item.plannedQuantity, "Not entered"), present(item.scenarioQuantity), present(item.excessUnits), present(item.shortfallUnits),
      money(item.plannedSpend), money(item.incomingSpend), money(item.combinedCommitment), money(item.excessCost), money(item.scenarioSpend), money(item.spendDifference), item.exclusionReason ?? moneyReason(item.excessCost), metadata.sourceLabel])));
  tables.push(table("financialtotals", "Financial Totals", ["Measure", "State", "Estimated amount (MYR)", "Included products", "Excluded products", "Limitation", "Source"],
    Object.values(input.impact?.totals ?? {}).map(total => [total.label, total.state, total.state === "estimated" ? total.amount : "Unavailable", total.includedCount, total.excludedCount,
      total.state === "unavailable" ? total.reason : total.excludedCount ? "Partial total: excluded products are not treated as zero." : "Estimated from seller unit costs.", metadata.sourceLabel])));
  tables.push(table("carbon", "CO2e Estimates", ["Product name", "Product code", "Pack size", "Product key", "Measure", "Status", "Category", "Quantity", "Unit", "Mass (kg)", "Mass basis", "CO2e (kg)", "CO2e low (kg)", "CO2e high (kg)", "Factor (kg CO2e/kg)", "Factor label", "Source names", "Source values", "Source boundary", "Conversion source", "Calculation", "Baseline", "Limitation", "Source"],
    (input.carbonResults ?? []).map(item => [...identity(item.productKey), item.productKey, item.kind, item.state, item.category ?? "Unconfirmed", present(item.quantity, item.state === "no_record" ? "No waste record" : "Not entered"), item.quantityUnit ?? "Not supplied",
      item.state === "estimated" ? item.massKg : "Unavailable", item.state === "estimated" ? item.massBasis : "Unavailable", item.state === "estimated" ? item.kgCO2e : "Unavailable",
      item.state === "estimated" ? item.kgCO2eRange.low : "Unavailable", item.state === "estimated" ? item.kgCO2eRange.high : "Unavailable",
      item.state === "estimated" ? item.factor.factorKgCO2ePerKg : "Unavailable", item.state === "estimated" ? item.factor.label : "Unavailable",
      item.factor?.sources.map(source => source.name).join("; ") ?? "", item.factor?.sources.map(source => `${source.name}: ${source.value}`).join("; ") ?? "",
      item.factor?.sources.map(source => `${source.name}: ${source.boundary}`).join("; ") ?? "", item.state === "estimated" ? item.conversionSource : "Unavailable",
      item.state === "estimated" ? item.calculation : "Unavailable", item.baseline ?? "Not applicable", item.state === "estimated" ? item.limitation : item.reason, metadata.sourceLabel])));
  tables.push(table("carbontotals", "CO2e Totals", ["Measure", "State", "Estimated CO2e (kg)", "CO2e low (kg)", "CO2e high (kg)", "Included products", "Excluded products", "Mass from sources-agree factors (kg)", "Mass from estimated factors (kg)", "Limitation", "Source"],
    (["recorded_waste", "potential_excess", "scenario_difference"] as readonly CarbonImpactKind[]).map(kind => {
      const total = summarizeCarbonImpact((input.carbonResults ?? []).filter(item => item.kind === kind));
      return [kind, total.state, present(total.kgCO2e), present(total.kgCO2eRange?.low), present(total.kgCO2eRange?.high), total.includedProductCount, total.excludedProductCount,
        total.massKgSourcesAgree, total.massKgEstimate, total.reason ?? (total.excludedProductCount ? "Partial estimate: excluded products are not zero." : "Estimate; separate from achieved environmental outcomes."), metadata.sourceLabel];
    })));
  tables.push(table("outcomes", "Recorded Outcomes", ["Product name", "Product code", "Pack size", "Product key", "Record ID", "Kind", "Date", "Recorded quantity", "Unit", "kg per unit", "Conversion source", "Description", "Recorded at", "Updated at"],
    outcomes.map(item => [...identity(item.productKey), item.productKey, item.id, item.kind, item.date, item.quantity, item.unit,
      present(item.conversion?.kilogramsPerUnit, "Not supplied"), item.conversion?.source ?? "Not supplied", item.description ?? "", item.recordedAt, item.updatedAt ?? ""] )));
  tables.push(table("problems", "Problems to Fix", ["Product name", "Product code", "Pack size", "Product key", "Source row", "Issue", "Field", "Source column", "Observed value", "Reason", "Corrective action", "State"],
    snapshot.issues.map(item => [...identity(item.productKey ?? ""), item.productKey ?? "Not supplied", item.sourceRow, item.issueCode, item.field ?? "", item.sourceColumn ?? "", item.observedValue, item.reason, item.correctiveAction, item.resolutionState])));
  tables.splice(1,0,table("orders", "Purchase Orders", ["Product name", "Product code", "Pack size", "Product key", "Planned quantity", "Quantity unit", "Quantity source", "Planned spend (MYR)", "Purchase check", "Analysis date", "Dataset ID", "Dataset", "Export date", "Source"],
    [...keys].sort().flatMap(key=>{
      const plan=plans.get(key),quantity=plan?.inputs.plannedOrder;
      if(!plan || quantity?.state!=="value" || quantity.value<=0)return [];
      return [[...identity(key),key,quantity.value,"pieces",quantity.source,money(impact.get(key)?.plannedSpend),
        plan.audit.state==="verdict"?plan.audit.verdict:plan.audit.state==="cannot_judge"?"Cannot judge":"Not assessed",
        metadata.analysisDate,metadata.datasetId,metadata.datasetName,generatedAt,metadata.sourceLabel]];
    })));
  tables.push(table("limitations", "Explanations and Limits", ["Explanation"], limitations.map(item => [item])));
  return copyObject({ schemaVersion: 1 as const, metadata, tables, limitations });
}
