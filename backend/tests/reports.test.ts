import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAnalysisReport, type AnalysisReport } from "../src/reports.ts";
import { parseCsvBytes } from "../src/csv.ts";
import { createMappingState, setMapping, confirmIdentityMode } from "../src/mapping.ts";
import { runReadinessCheck } from "../src/readiness.ts";
import { previousCompleteWeekStarts, buildDemandForecastReview } from "../src/forecast.ts";
import { buildPurchasePlanReview, createPurchaseQuantity, emptyProductPurchaseInputs } from "../src/purchase-plan.ts";
import { buildImpactReview } from "../src/impact.ts";
import { createPurchaseDecision, type DecisionRecommendationSnapshot } from "../src/decisions.ts";
import { createStockOutcome } from "../src/outcomes.ts";
import { estimateCarbonImpact } from "../src/carbon.ts";

const DATE = "2026-10-06", GENERATED = "2026-10-08T01:02:03.000Z";
const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
async function reportFixture() {
  const dates = previousCompleteWeekStarts(DATE);
  const rows = dates.flatMap((date, index) => [
    [date, "000101", "=HYPERLINK(\"https://example.invalid\")", "500g", 10, 0, DATE, 0],
    ...(index === 2 ? [] : [[date, "000102", "Roti <script>alert(1)</script>", "250g", 10, 0, DATE, 2.5]]),
  ]);
  rows.push([dates[4], "000102", "Roti <script>alert(1)</script>", "250g", -3, 0, DATE, 2.5]);
  const dataset = await parseCsvBytes(new TextEncoder().encode([["Date", "SKU", "Name", "Pack", "Quantity", "Stock", "Stock date", "Cost"], ...rows].map(row => row.map(quote).join(",")).join("\n")), { sourceMode: "sample", sourceName: "test-data.csv" });
  let mapping = createMappingState();
  for (const [index, field] of (["transaction_date", "product_code", "product_name", "pack_variant", "quantity_sold", "current_stock", "stock_as_of_date", "unit_cost"] as const).entries()) mapping = setMapping(mapping, field, `column-${index}`, true);
  mapping = confirmIdentityMode(mapping, "stable");
  const snapshot = await runReadinessCheck(dataset, mapping, { analysisDate: DATE });
  const forecast = buildDemandForecastReview(snapshot);
  const inputs = { "ID|000101": { ...emptyProductPurchaseInputs(), plannedOrder: createPurchaseQuantity(0, "input by you") } };
  const plans = buildPurchasePlanReview(snapshot, forecast, { inputsByProduct: inputs }).products;
  const impact = buildImpactReview(snapshot, forecast, inputs, plans);
  const recommendation: DecisionRecommendationSnapshot = { productKey: "ID|000101", productName: "Original bread", productCode: "000101", packSize: "500g", sourceName: "old-file.csv", sourceSha256: "old-hash", sourceMode: "sample", analysisDate: "2026-10-01", policyVersion: "original-policy", recommendedQuantity: 40, quantityUnit: "pieces", inputs: plans[0].inputs, plan: plans[0], unitCost: 1, currency: "MYR" };
  const decisions = [
    createPurchaseDecision({ id: "old-positive", datasetId: "D", response: "Changed", finalQuantity: 50, reason: "Need more", decisionDate: "2026-10-02", referenceDate: DATE, recordedAt: "2026-10-02T00:00:00Z", recommendation }),
    createPurchaseDecision({ id: "new-zero", datasetId: "D", response: "Ignored", finalQuantity: 0, decisionDate: DATE, referenceDate: DATE, recordedAt: "2026-10-06T00:00:00Z", recommendation }),
    createPurchaseDecision({ id: "bread-order", datasetId: "D", response: "Changed", finalQuantity: 10, reason: "A smaller trial", supplier: "Bakery", decisionDate: DATE, referenceDate: DATE, recordedAt: "2026-10-06T00:00:00Z", recommendation: { ...recommendation, productKey: "ID|000102", productName: "Original roti", productCode: "000102", packSize: "250g" } }),
    createPurchaseDecision({ id: "other-dataset", datasetId: "OTHER", response: "Followed", decisionDate: DATE, referenceDate: DATE, recordedAt: "2026-10-06T00:00:00Z", recommendation }),
  ];
  const outcomes = [createStockOutcome({ id: "recorded-zero", datasetId: "D", productKey: "ID|000102", kind: "discarded", date: DATE, quantity: 0, unit: "pieces", referenceDate: DATE, recordedAt: "2026-10-06T00:00:00Z" })];
  const carbonResults = [estimateCarbonImpact({ productKey: "ID|000102", kind: "recorded_waste", isFood: true, category: "bread", categoryConfirmed: true, measuredMassKg: 0 })];
  const report = buildAnalysisReport({ snapshot, forecast, plans, impact, datasetId: "D", shopName: "Local shop", datasetName: "October", generatedAt: GENERATED, decisions, outcomes, carbonResults,
    supplierScenariosByProduct: { "ID|000102": [{ id: "S", name: "Bakery", terms: { caseSize: 6, minimumOrder: 12, leadTimeDays: 1 } }] } });
  return { snapshot, forecast, plans, decisions, report };
}
function rowValue(report: AnalysisReport, tableId: string, column: string, row: number) {
  const table = report.tables.find(item => item.id === tableId)!;
  return table.rows[row][table.columns.indexOf(column)];
}

test("report preserves provenance, source labels, separate identity columns and 0 versus unentered", async () => {
  const { report } = await reportFixture();
  assert.equal(report.metadata.sourceLabel, "Sample data");
  assert.equal(report.metadata.generatedAt, GENERATED);
  assert.equal(report.metadata.shopName, "Local shop");
  assert.equal(report.metadata.datasetId, "D");
  assert.ok(report.metadata.sourceSha256.length > 0);
  assert.equal(rowValue(report, "results", "Product code", 0), "000101");
  assert.equal(rowValue(report, "results", "Pack size", 0), "500g");
  assert.equal(rowValue(report, "results", "Planned quantity", 0), 0);
  assert.equal(rowValue(report, "results", "Planned quantity", 1), "Not entered");
  assert.equal(rowValue(report, "results", "Planned spend (MYR)", 0), 0);
  assert.equal(rowValue(report, "outcomes", "Recorded quantity", 0), 0);
  assert.ok(report.limitations.some(text => text.includes("Sample data")));
});

test("final order export excludes old superseded positive, zero, unfinished and other dataset orders", async () => {
  const { report } = await reportFixture();
  const orders = report.tables.find(item => item.id === "finalorders")!;
  assert.equal(orders.rows.length, 1);
  assert.equal(rowValue(report, "finalorders", "Product code", 0), "000102");
  assert.equal(rowValue(report, "finalorders", "Final quantity", 0), 10);
  assert.equal(rowValue(report, "finalorders", "Supplier", 0), "Bakery");
  assert.equal(rowValue(report, "finalorders", "Export date", 0), GENERATED);
  assert.equal(rowValue(report, "finalorders", "Source", 0), "Sample data");
});

test("history, supplier comparison and carbon retain missing weeks, returns and recorded-zero evidence", async () => {
  const { report } = await reportFixture();
  const history = report.tables.find(item => item.id === "history")!;
  assert.ok(history.rows.some(row => row[6] === "Missing week"));
  assert.ok(history.rows.some(row => row[7] === -3));
  assert.equal(report.tables.find(item => item.id === "scenarios")!.rows.length, 1);
  assert.equal(rowValue(report, "carbon", "Measure", 0), "recorded_waste");
  assert.equal(rowValue(report, "carbon", "CO2e (kg)", 0), 0);
  assert.ok(String(rowValue(report, "carbon", "Source names", 0)).length > 0);
});

test("decision export retains frozen recommendation and full evidence independent of current plan", async () => {
  const { report, decisions } = await reportFixture();
  const evidence = report.tables.find(item => item.id === "evidence")!;
  const chunks = evidence.rows.filter(row => row[0] === "new-zero").sort((a, b) => Number(a[1]) - Number(b[1])).map(row => row[3]).join("");
  const original = JSON.parse(chunks);
  assert.deepEqual(original, JSON.parse(JSON.stringify(decisions.find(item => item.id === "new-zero")!.recommendation)));
  assert.equal(original.sourceSha256, "old-hash");
  assert.equal(original.recommendedQuantity, 40);
  assert.equal(original.unitCost, 1);
  assert.ok(Object.isFrozen(report.tables));
  assert.ok(Object.isFrozen(report.tables[0].rows[0]));
});

test("report rejects mixed stale snapshots and invalid metadata dates", async () => {
  const { snapshot, forecast } = await reportFixture();
  assert.throws(() => buildAnalysisReport({ snapshot, forecast: { ...forecast, snapshotId: "stale" }, datasetId: "D" }), /same current/);
  assert.throws(() => buildAnalysisReport({ snapshot, forecast, datasetId: "D", generatedAt: "invalid" }), /generation date/);
  assert.throws(() => buildAnalysisReport({ snapshot, forecast, datasetId: "D", period: { start: DATE, end: "2026-01-01" } }), /valid reporting period/);
});
