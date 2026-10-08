import assert from "node:assert/strict";
import { test } from "node:test";
import { createPurchaseDecision, updatePurchaseDecision, filterPurchaseDecisions, finalisedOrderRows, DecisionValidationError, type DecisionRecommendationSnapshot } from "../src/decisions.ts";
import { createStockOutcome, updateStockOutcome, summarizeRecordedOutcomes, compareOutcomePeriods, reviewDecisionOutcomes,
  summarizeDecisionFinancialHistory, compareFinancialHistoryPeriods, OutcomeValidationError, buildImportedOutcomeEvidence } from "../src/outcomes.ts";
import { parseCsvBytes, createMappingState, setMapping, confirmIdentityMode, runReadinessCheck } from "../src/index.ts";

const REF = "2026-10-08";
const NOW = "2026-10-08T10:00:00Z";
function recommendation(productKey = "A"): DecisionRecommendationSnapshot {
  return { productKey, productName: "Tea", productCode: "0001", packSize: "250 g", sourceName: "sales.csv", sourceSha256: "source-1", sourceMode: "user",
    analysisDate: "2026-10-01", policyVersion: "cp3-v2", snapshotId: "snapshot-1", recommendedQuantity: 12, quantityUnit: "pieces", unitCost: 2.5, currency: "MYR",
    inputs: { plannedOrder: { state: "value", value: 18, source: "input by you" }, incomingStock: { state: "empty" } } };
}
function decision(id = "decision-1", quantity = 12, date = REF) {
  return createPurchaseDecision({ id, datasetId: "dataset-1", response: quantity === 12 ? "Followed" : "Changed", finalQuantity: quantity,
    reason: quantity === 12 ? undefined : "Limited shelf space", referenceDate: REF, decisionDate: date, recordedAt: NOW, recommendation: recommendation() });
}
function outcome(id: string, quantity: number | string, date = REF, unit: "pieces" | "kg" | "litres" = "pieces", extra = {}) {
  return createStockOutcome({ id, datasetId: "dataset-1", productKey: "A", kind: "discarded", date, quantity, unit, referenceDate: REF, recordedAt: NOW, ...extra });
}

test("explicit decisions validate response and final whole quantity, keep the reason optional and permit zero", () => {
  assert.equal(createPurchaseDecision({ datasetId: "dataset-1", response: "Followed", referenceDate: REF, recordedAt: NOW, recommendation: recommendation() }).finalQuantity, 12);
  for (const finalQuantity of ["", " ", -1, "no", 1.5, Infinity, "1e2", 1_000_000]) {
    assert.throws(() => createPurchaseDecision({ datasetId: "dataset-1", response: "Ignored", finalQuantity, referenceDate: REF, recordedAt: NOW, recommendation: recommendation() }), DecisionValidationError);
  }
  assert.equal(createPurchaseDecision({ datasetId: "dataset-1", response: "Changed", finalQuantity: 6, referenceDate: REF, recordedAt: NOW, recommendation: recommendation() }).reason, undefined);
  assert.throws(() => createPurchaseDecision({ datasetId: "dataset-1", response: "Followed", finalQuantity: 6, referenceDate: REF, recordedAt: NOW, recommendation: recommendation() }), /Followed/);
  assert.equal(createPurchaseDecision({ datasetId: "dataset-1", response: "Ignored", finalQuantity: "0", referenceDate: REF, recordedAt: NOW, recommendation: recommendation() }).finalQuantity, 0);
  assert.throws(() => createPurchaseDecision({ datasetId: "dataset-1", response: "Ignored", finalQuantity: 0, decisionDate: "2026-10-09", referenceDate: REF, recordedAt: NOW, recommendation: recommendation() }), /future/);
});

test("decision captures immutable copied recommendation and editing preserves all original evidence", () => {
  const evidence = recommendation();
  const item = createPurchaseDecision({ id: "frozen", datasetId: "dataset-1", response: "Changed", finalQuantity: 8, reason: "Budget", referenceDate: REF, recordedAt: NOW, recommendation: evidence });
  (evidence as { recommendedQuantity: number }).recommendedQuantity = 99;
  assert.equal(item.recommendation.recommendedQuantity, 12);
  assert.equal(Object.isFrozen(item.recommendation.inputs?.plannedOrder), true);
  const edited = updatePurchaseDecision(item, { response: "Changed", finalQuantity: 4, reason: "Corrected count", restockDate: "2026-10-10", referenceDate: REF, recordedAt: "2026-10-08T11:00:00Z" });
  assert.equal(edited.recordedAt, NOW); assert.equal(edited.updatedAt, "2026-10-08T11:00:00Z");
  assert.deepEqual(edited.recommendation, item.recommendation);
  assert.equal(item.finalQuantity, 8); assert.equal(edited.finalQuantity, 4);
});

test("decision history filters dataset/product/date and final order list uses latest explicit choice", () => {
  const early = decision("early", 8, "2026-10-01"), latest = decision("latest", 0, "2026-10-08");
  const other = createPurchaseDecision({ id: "B", datasetId: "dataset-1", response: "Followed", referenceDate: REF, recordedAt: NOW, recommendation: recommendation("B") });
  const foreign = createPurchaseDecision({ id: "foreign", datasetId: "dataset-2", response: "Followed", referenceDate: REF, recordedAt: NOW, recommendation: recommendation() });
  assert.deepEqual(filterPurchaseDecisions([early, latest, other, foreign], { datasetId: "dataset-1", productKey: "A", from: "2026-10-05", search: "0001" }).map(item => item.id), ["latest"]);
  const rows = finalisedOrderRows([early, latest, other, foreign], "dataset-1");
  assert.equal(rows.length, 1); assert.equal(rows[0].productKey, "B"); assert.equal(rows[0].productCode, "0001");
  assert.equal(rows[0].packSize, "250 g"); assert.equal(rows[0].finalQuantity, 12);
  assert.deepEqual(finalisedOrderRows([early, latest], "dataset-1"), []);
});

test("actual waste validates date, units, quantities and conversion without using inferred defaults", () => {
  for (const quantity of ["", " ", "-1", -1, "no", NaN, Infinity, "1e3", 0.5]) assert.throws(() => outcome("bad", quantity), OutcomeValidationError);
  assert.throws(() => outcome("bad", 1, "2026-02-30"), /date/);
  assert.throws(() => outcome("bad", 1, "2026-10-09"), /future/);
  assert.throws(() => outcome("bad", 1, REF, "litres", { conversion: { kilogramsPerUnit: 1, source: "" } }), /conversion/);
  assert.equal(outcome("kg", "0.5", REF, "kg").quantity, 0.5);
  const before = outcome("zero", 0);
  const corrected = updateStockOutcome(before, { kind: "expired", date: REF, quantity: 2, unit: "pieces", referenceDate: REF, recordedAt: "2026-10-08T11:00:00Z" });
  assert.equal(before.quantity, 0); assert.equal(corrected.quantity, 2); assert.equal(corrected.recordedAt, NOW);
});

test("period summaries distinguish no record from recorded zero and prevent incompatible unit addition", () => {
  const options = { datasetId: "dataset-1", period: { start: "2026-10-01", end: REF }, kinds: ["discarded", "expired"] as const };
  assert.equal(summarizeRecordedOutcomes([], options).state, "no_record");
  const zero = summarizeRecordedOutcomes([outcome("zero", 0)], options);
  assert.equal(zero.state, "recorded"); if (zero.state === "recorded") assert.equal(zero.label, "Recorded zero");
  assert.equal(summarizeRecordedOutcomes([outcome("a", 2), outcome("b", 1, REF, "kg")], options).state, "unavailable");
  const mixed = summarizeRecordedOutcomes([outcome("a", 2, REF, "pieces", { conversion: { kilogramsPerUnit: 0.25, source: "Pack label" } }), outcome("b", 1, REF, "kg")], options);
  assert.equal(mixed.state, "recorded"); if (mixed.state === "recorded") { assert.equal(mixed.quantity, 1.5); assert.equal(mixed.unit, "kg"); }
});

test("stock summaries use latest counts rather than adding inventory snapshots or mixing sales", () => {
  const records = [outcome("a", 3, "2026-10-01", "pieces", { kind: "stock" }), outcome("b", 5, REF, "pieces", { kind: "stock" })];
  const options = { datasetId: "dataset-1", period: { start: "2026-10-01", end: REF } };
  const summary = summarizeRecordedOutcomes(records, options);
  assert.equal(summary.state, "recorded"); if (summary.state === "recorded") assert.equal(summary.quantity, 5);
  assert.equal(summarizeRecordedOutcomes([...records, outcome("sale", 2, REF, "pieces", { kind: "sales" })], options).state, "unavailable");
});

test("outcome period comparisons require equal inclusive length, observed values and compatible units", () => {
  const records = [outcome("a", 0, "2026-10-01"), outcome("b", 2, "2026-10-08")];
  const options = { datasetId: "dataset-1", first: { start: "2026-10-01", end: "2026-10-01" }, second: { start: REF, end: REF } };
  const compared = compareOutcomePeriods(records, options);
  assert.equal(compared.state, "compared"); if (compared.state === "compared") { assert.equal(compared.change, 2); assert.equal(compared.percentageChange, null); }
  assert.equal(compareOutcomePeriods(records, { ...options, second: { start: "2026-10-07", end: REF } }).state, "unavailable");
  assert.equal(compareOutcomePeriods([records[0]], options).state, "unavailable");
  assert.equal(compareOutcomePeriods([records[0], outcome("kg", 2, REF, "kg")], options).state, "unavailable");
});

test("decision outcome review isolates dataset/product/period and preserves original estimate", () => {
  const item = decision();
  assert.equal(reviewDecisionOutcomes(item, [], { start: "2026-10-01", end: REF }).label, "No outcome recorded");
  const records = [outcome("zero", 0, REF, "pieces", { decisionId: item.id }), outcome("early", 8, "2026-10-01"),
    outcome("foreign", 8, REF, "pieces", { datasetId: "dataset-2" }), outcome("wrong-choice", 8, REF, "pieces", { decisionId: "another" })];
  const review = reviewDecisionOutcomes(item, records, { start: "2026-10-01", end: REF });
  assert.equal(review.state, "recorded"); assert.deepEqual(review.records.map(record => record.id), ["zero"]);
  assert.deepEqual(review.recommendation, item.recommendation); assert.equal(review.finalQuantity, 12);
});

test("financial history uses frozen decision-time costs and leaves missing prices unavailable", () => {
  const old = decision("old", 8, "2026-10-01"), current = decision("new", 12);
  const period = { start: "2026-10-01", end: "2026-10-01" };
  const summary = summarizeDecisionFinancialHistory([old, current], { datasetId: "dataset-1", period });
  assert.equal(summary.state, "estimated"); if (summary.state === "estimated") assert.equal(summary.amount, 20);
  const noCost = createPurchaseDecision({ datasetId: "dataset-1", response: "Followed", referenceDate: REF, recordedAt: NOW, recommendation: { ...recommendation(), unitCost: undefined } });
  assert.equal(summarizeDecisionFinancialHistory([noCost], { datasetId: "dataset-1", period: { start: REF, end: REF } }).state, "unavailable");
  const compared = compareFinancialHistoryPeriods([old, current], { datasetId: "dataset-1", first: period, second: { start: REF, end: REF } });
  assert.equal(compared.state, "compared"); if (compared.state === "compared") assert.equal(compared.change, 10);
});

async function importedSnapshot(rows: readonly string[]) {
  const data = await parseCsvBytes(new TextEncoder().encode(["Date,SKU,Quantity,Name,Pack,Stock,Stock date,Weight", ...rows].join("\n")), { sourceMode: "user", sourceName: "follow-up.csv" });
  let mapping = createMappingState();
  for (const [index, field] of (["transaction_date", "product_code", "quantity_sold", "product_name", "pack_variant", "current_stock", "stock_as_of_date", "unit_weight_kg"] as const).entries()) mapping = setMapping(mapping, field, `column-${index}`, true);
  mapping = confirmIdentityMode(mapping, "stable");
  return runReadinessCheck(data, mapping, { analysisDate: REF });
}
test("imported follow-up keeps observed sales and latest stock once, with source provenance and returns separate", async () => {
  const snapshot = await importedSnapshot([
    "2026-10-01,A,4,Tea,250 g,20,2026-10-01,0.25",
    "2026-10-07,A,2,Tea,250 g,12,2026-10-07,0.25",
    "2026-10-08,A,-1,Tea,250 g,12,2026-10-07,0.25",
    "2026-10-07,A,2,Tea,250 g,12,2026-10-07,0.25",
  ]);
  const evidence = buildImportedOutcomeEvidence(snapshot, "dataset-1", { expectedSourceSha256: snapshot.sourceSha256, expectedSnapshotId: snapshot.id, extractedAt: NOW });
  assert.equal(evidence.state, "available");
  assert.equal(evidence.outcomes.filter(item => item.kind === "sales").reduce((sum, item) => sum + item.quantity, 0), 6);
  const stocks = evidence.outcomes.filter(item => item.kind === "stock");
  assert.equal(stocks.length, 1); assert.equal(stocks[0].quantity, 12); assert.equal(stocks[0].date, "2026-10-07");
  assert.deepEqual(stocks[0].provenance?.sourceRows, [4, 5]);
  assert.equal(stocks[0].provenance?.sourceName, "follow-up.csv"); assert.equal(stocks[0].provenance?.sourceSha256, snapshot.sourceSha256);
  assert.equal(stocks[0].provenance?.snapshotId, snapshot.id);
  assert.equal(evidence.returns.length, 1); assert.equal(evidence.returns[0].originalSignedQuantity, -1);
  assert.equal(evidence.outcomes.some(item => item.kind === "discarded" || item.kind === "expired"), false);
  assert.equal(evidence.excluded.some(item => item.sourceRows.includes(3)), true);
  const prior = decision("before", 12, "2026-10-01");
  const review = reviewDecisionOutcomes({ ...prior, productKey: "ID|A", recommendation: { ...prior.recommendation, productKey: "ID|A" } }, evidence.outcomes, { start: "2026-10-01", end: REF });
  assert.deepEqual(review.records.map(item => item.kind).sort(), ["sales", "stock"]);
});

test("imported follow-up refuses wrong source and unresolved product identity without inventing outcomes", async () => {
  const snapshot = await importedSnapshot(["2026-10-01,A,4,Tea,250 g,20,2026-10-01,0.25", "2026-10-07,A,2,Other Tea,250 g,12,2026-10-07,0.25"]);
  const wrong = buildImportedOutcomeEvidence(snapshot, "dataset-1", { expectedSourceSha256: "another-source" });
  assert.equal(wrong.state, "unavailable"); assert.deepEqual(wrong.outcomes, []);
  const blocked = buildImportedOutcomeEvidence(snapshot, "dataset-1");
  assert.deepEqual(blocked.outcomes, []); assert.equal(blocked.excluded.length > 0, true);
  assert.equal(buildImportedOutcomeEvidence({ ...snapshot, sourceMode: "sample" }, "dataset-1").state, "unavailable");
});
