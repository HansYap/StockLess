import assert from "node:assert/strict";
import { test } from "node:test";
import { applyPlanningContexts, buildDemandForecastReview, buildEnvironmentalImpact, buildImpactReview, buildPurchasePlanReview,
  confirmIdentityMode, createMappingState, createPurchaseQuantity, createStockOutcome, emptyProductPurchaseInputs, estimatePurchaseCost,
  parseCsvBytes, previousCompleteWeekStarts, resolveCarbonFactor, runReadinessCheck, setMapping,
  type PlanningContexts } from "../src/index.ts";

const DATE = "2026-10-06", KEY = "ID|000101";
async function fixture(options: { pack?: string; stock?: number; cost?: string; planned?: number; name?: string } = {}) {
  const headers = ["Date", "SKU", "Name", "Pack", "Quantity", "Stock", "Stock date", "Cost"];
  const rows = previousCompleteWeekStarts(DATE).map(date => [date, "000101", options.name ?? "Beras", options.pack ?? "500g", "10", options.stock ?? 0, DATE, options.cost ?? "2.5"]);
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const dataset = await parseCsvBytes(new TextEncoder().encode([headers, ...rows].map(row => row.map(quote).join(",")).join("\n")), { sourceMode: "user", sourceName: "merchant-fixture.csv" });
  let mapping = createMappingState();
  for (const [index, field] of (["transaction_date", "product_code", "product_name", "pack_variant", "quantity_sold", "current_stock", "stock_as_of_date", "unit_cost"] as const).entries()) mapping = setMapping(mapping, field, `column-${index}`, true);
  const snapshot = await runReadinessCheck(dataset, confirmIdentityMode(mapping, "stable"), { analysisDate: DATE });
  const forecast = buildDemandForecastReview(snapshot);
  const drafts = { [KEY]: { ...emptyProductPurchaseInputs(), plannedOrder: createPurchaseQuantity(options.planned ?? 100, "input by you") } };
  const contexts: PlanningContexts = { [KEY]: { evidenceKey: snapshot.evidenceKey!, category: "rice", categoryConfirmed: true, isFood: true } };
  const impact = buildImpactReview(snapshot, forecast, drafts, undefined, contexts);
  return { snapshot, forecast, drafts, contexts, impact };
}
const outcome = (quantity: number, unit: "pieces" | "kg" | "litres", context: { datasetId?: string; date?: string } = {}) => createStockOutcome({
  id: `waste-${quantity}-${unit}`, datasetId: context.datasetId ?? "D", productKey: KEY, kind: "discarded", date: context.date ?? DATE,
  quantity, unit, referenceDate: DATE, recordedAt: "2026-10-06T00:00:00Z",
});

test("environmental integration holds category gate, then uses user-confirmed bounded v2 with same financial plan", async () => {
  const { snapshot, forecast, drafts, contexts, impact } = await fixture();
  const before = buildEnvironmentalImpact(snapshot, impact);
  assert.equal(before.potentialResults[0].state, "unavailable");
  assert.equal(before.potentialResults[0].code, "CATEGORY_NOT_CONFIRMED");
  const after = buildEnvironmentalImpact(snapshot, impact, contexts);
  const potential = after.potentialResults[0];
  assert.equal(potential.state, "estimated");
  if (potential.state === "estimated") {
    assert.equal(potential.factor.policy, "bounded_cp3");
    assert.equal(potential.factor.label, "estimate");
    assert.equal(potential.massKg, impact.products[0].excessUnits! * .5);
  }
  const plan = buildPurchasePlanReview(snapshot, forecast, { inputsByProduct: drafts }).products[0];
  assert.deepEqual(impact.products[0].plan.inputs, plan.inputs);
  assert.deepEqual(impact.products[0].plan.audit, plan.audit);
  assert.deepEqual(impact.products[0].plannedSpend, estimatePurchaseCost(snapshot, KEY, 100));
  assert.deepEqual(impact.products[0].scenarioSpend, estimatePurchaseCost(snapshot, KEY, plan.estimatedRestock.state === "available" ? plan.estimatedRestock.quantity.value : undefined));
});

test("missing actual waste differs from recorded zero and never absorbs potential or scenario estimates", async () => {
  const { snapshot, impact, contexts } = await fixture();
  const missing = buildEnvironmentalImpact(snapshot, impact, contexts, [], { datasetId: "D" });
  assert.equal(missing.recorded.state, "no_records");
  assert.equal(missing.recorded.kgCO2e, undefined);
  assert.ok(missing.potential.kgCO2e! > 0);
  const recorded = buildEnvironmentalImpact(snapshot, impact, contexts, [outcome(0, "pieces")], { datasetId: "D" });
  assert.equal(recorded.recorded.state, "estimated");
  assert.equal(recorded.recorded.kgCO2e, 0);
  assert.equal(recorded.actualResults[0].quantity, 0);
  assert.deepEqual(recorded.potential, missing.potential);
  assert.deepEqual(recorded.scenario, missing.scenario);
});

test('recorded conversion keeps its estimated label when current product weight later changes',async()=>{
  const {snapshot,impact,contexts}=await fixture();
  const record={...outcome(2,'pieces'),conversion:{kilogramsPerUnit:.5,source:'Frozen estimated conversion',estimated:true}};
  const later={...contexts,[KEY]:{...contexts[KEY]!,kgPerUnit:2}};
  const result=buildEnvironmentalImpact(snapshot,impact,later,[record],{datasetId:'D'}).actualResults[0];
  assert.equal(result.state,'estimated');if(result.state==='estimated'){assert.equal(result.massKg,1);assert.equal(result.massBasis,'estimated');assert.equal(result.conversionSource,'Frozen estimated conversion');}
});

test("recorded kilograms bypass missing unit mass; litres never reuse a mass-pack weight as kg per litre", async () => {
  const count = await fixture({ pack: "30 biji" });
  const measured = buildEnvironmentalImpact(count.snapshot, count.impact, count.contexts, [outcome(2, "kg")], { datasetId: "D" });
  assert.equal(measured.potential.state, "unavailable");
  assert.equal(measured.actualResults[0].state, "estimated");
  if (measured.actualResults[0].state === "estimated") { assert.equal(measured.actualResults[0].massKg, 2); assert.equal(measured.actualResults[0].massBasis, "measured"); }
  const grams = await fixture({ pack: "500g" });
  const litres = buildEnvironmentalImpact(grams.snapshot, grams.impact, grams.contexts, [outcome(2, "litres")], { datasetId: "D" });
  assert.equal(litres.actualResults[0].state, "unavailable");
  assert.equal(litres.actualResults[0].code, "NO_WEIGHT");
  const oil = await fixture({ pack: "500ml", name: "Palm oil" });
  const oilContexts = { [KEY]: { ...oil.contexts[KEY]!, category: "cooking_oil" } };
  const oilResult = buildEnvironmentalImpact(oil.snapshot, oil.impact, oilContexts, [outcome(2, "litres")], { datasetId: "D" }).actualResults[0];
  assert.equal(oilResult.state, "estimated");
  if (oilResult.state === "estimated") assert.equal(oilResult.massKg, 1.78); // 2L × .89 kg/L, never 2 × .445kg/pack.
});

test("a signed scenario uses its named baseline and keeps negative fractional-stock differences", async () => {
  const { snapshot, impact, contexts } = await fixture({ stock: .5, planned: 0 });
  const scenario = buildEnvironmentalImpact(snapshot, impact, contexts).scenarioResults[0];
  assert.equal(scenario.state, "estimated");
  if (scenario.state === "estimated") {
    assert.equal(scenario.quantity, -.5);
    assert.equal(scenario.massKg, -.25);
    assert.ok(scenario.kgCO2e < 0);
    assert.ok(scenario.kgCO2eRange.low <= scenario.kgCO2eRange.high);
    assert.match(scenario.baseline!, /Current planned order minus restock recommendation/);
    assert.match(scenario.limitation, /does not change recorded waste/);
  }
});

test("manual evidence is applied for current source only, and actual records obey dataset and period", async () => {
  const { snapshot, forecast, drafts, contexts } = await fixture({ cost: "" });
  const entered = { [KEY]: { ...contexts[KEY]!, unitCost: 4, kgPerUnit: .2 } };
  const effective = applyPlanningContexts(snapshot, entered), impact = buildImpactReview(effective, forecast, drafts, undefined, entered);
  assert.equal(impact.products[0].plannedSpend.state, "estimated");
  if (impact.products[0].plannedSpend.state === "estimated") assert.equal(impact.products[0].plannedSpend.amount, 400);
  const current = buildEnvironmentalImpact(effective, impact, entered, [outcome(2, "pieces"), outcome(8, "kg", { datasetId: "OTHER" }), outcome(9, "kg", { date: "2026-09-01" })], { datasetId: "D", period: { start: "2026-10-01", end: DATE } });
  assert.equal(current.actualResults.length, 1);
  if (current.actualResults[0].state === "estimated") assert.equal(current.actualResults[0].massKg, .4);
  const replaced = { ...snapshot, id: "replacement", evidenceKey: "replacement-evidence", sourceSha256: "replacement-source" };
  const staleEffective = applyPlanningContexts(replaced, entered);
  const freshForecast = { ...forecast, snapshotId: replaced.id };
  const staleImpact = buildImpactReview(staleEffective, freshForecast, drafts, undefined, entered);
  assert.equal(staleImpact.products[0].plannedSpend.state, "unavailable");
  const staleEnvironment = buildEnvironmentalImpact(staleEffective, staleImpact, entered);
  assert.equal(staleEnvironment.potentialResults[0].state, "unavailable");
  assert.equal(staleEnvironment.potentialResults[0].code, "CATEGORY_NOT_CONFIRMED");
  assert.throws(() => buildEnvironmentalImpact(snapshot, { ...impact, sourceSha256: "stale" }, entered), /current analysis evidence/);
  const factor = resolveCarbonFactor("chicken"); assert.equal(factor.state, "unavailable");
});
