import assert from "node:assert/strict";
import { test } from "node:test";
import type { CanonicalField, DemandForecastReview, ProductDemandEstimate, ProductPurchaseInputs, ProductStockEvidence, ReadinessSnapshot } from "../src/contracts.ts";
import { addCalendarDays } from "../src/dates.ts";
import { estimateExpiryRisk, fefoRemaining, type ExpiryBatch } from "../src/expiry-risk.ts";
import { createPurchaseQuantity, evaluateProductPurchasePlan, buildPurchasePlanReview } from "../src/purchase-plan.ts";
import { suggestSupplierOrder } from "../src/supplier-order.ts";
import { buildImpactReview, estimatePurchaseCommitments, sortFinancialRisk } from "../src/impact.ts";
import { activePlanningContext, applyPlanningContexts, planningMass, planningStorageWindow } from "../src/planning-context.ts";
import { resolveStorageWindow, restockElapsedDays } from "../src/storage-window.ts";
import { estimatePurchaseCost } from "../src/product-values.ts";
import { parseCsvBytes } from "../src/csv.ts";
import { confirmIdentityMode, createMappingState, setMapping } from "../src/mapping.ts";
import { runReadinessCheck } from "../src/readiness.ts";

const DATE = "2026-10-06", KEY = "ID|A";
function demand(low = 20, high = 30, key = KEY): ProductDemandEstimate {
  return { productKey: key, label: "Ready", recordedWeeksInLast8: 8, pattern: "Steady seller", policyVersion: "test",
    range: { low, high, unroundedCentral: (low + high) / 2, unroundedLow: low, unroundedHigh: high, horizonWeeks: 4,
      basedOnWeekCount: 8, firstWeekUsed: "2026-08-10", lastWeekUsed: "2026-09-28", method: "recent_mean_8", intervalMethod: "recent_variability_fallback", historicalErrorCount: 0 } };
}
function stock(quantity = 30, date = DATE): ProductStockEvidence {
  return { productKey: KEY, currentStock: quantity, stockAsOfDate: date,
    freshness: { snapshotDate: date, analysisDate: DATE, state: "current", ageDays: 0 }, usableForCover: true, reasonCodes: [] };
}
function inputs(planned?: number, incoming?: number): ProductPurchaseInputs {
  return { plannedOrder: planned === undefined ? { state: "empty" } : createPurchaseQuantity(planned, "input by you"),
    incomingStock: incoming === undefined ? { state: "empty" } : createPurchaseQuantity(incoming, "input by you") };
}
const batch = (offset: number, quantity: number, countDate = DATE): ExpiryBatch => ({ date: addCalendarDays(DATE, offset), quantity, stockAsOfDate: countDate });
const fields: readonly CanonicalField[] = ["transaction_date", "product_code", "product_name", "pack_variant", "quantity_sold", "current_stock", "stock_as_of_date", "planned_order_quantity", "incoming_stock_quantity", "unit_cost", "unit_weight_kg", "expiry_date", "expiry_quantity"];
const row = (date: string, expiry: string, expiryQuantity: string, countDate = DATE, quantity = "30", cost = "2.50") => [date, "A", "Bread", "500 g", "10", quantity, countDate, "12", "0", cost, "0.5", expiry, expiryQuantity];
async function readiness(rows: readonly string[][] = [row("2026-08-10", "2026-10-11", "10"), row("2026-08-17", "2026-11-15", "20")]) {
  const dataset = await parseCsvBytes(new TextEncoder().encode([fields.join(","), ...rows.map(values => values.join(","))].join("\n")), { sourceMode: "user", sourceName: "cp3.csv" });
  let mapping = createMappingState();
  for (const [index, field] of fields.entries()) mapping = setMapping(mapping, field, `column-${index}`, true);
  mapping = confirmIdentityMode(mapping, "stable");
  return runReadinessCheck(dataset, mapping, { analysisDate: DATE });
}
const forecast = (snapshot: ReadinessSnapshot, estimate = demand()): DemandForecastReview => ({ snapshotId: snapshot.id, analysisDate: snapshot.analysisDate, policyVersion: "test", products: [estimate] });

test("FEFO respects multiple expiry batches, past dates and monotonic demand bounds", () => {
  const batches = [batch(40, 20), batch(5, 10)];
  assert.equal(fefoRemaining(batches, 1, DATE), 5);
  assert.equal(fefoRemaining([batch(-2, 4), batch(30, 6)], 1, DATE), 4);
  const result = estimateExpiryRisk({ analysisDate: DATE, stock: 30, stockAsOfDate: DATE, low: 28, high: 56, batches });
  assert.equal(result.state, "estimated");
  if (result.state === "estimated") { assert.equal(result.quantity, 3); assert.equal(result.low, 0); assert.equal(result.high, 5); assert.equal(result.checkedQuantity, 30); }
  assert.throws(() => fefoRemaining([batch(5, -1)], 1, DATE), /Invalid expiry batch/);
});

test("zero lowest demand, incomplete batches and unmatched stock anchors produce explicit refusals", () => {
  const base = { analysisDate: DATE, stock: 30, stockAsOfDate: DATE, low: 20, high: 30 };
  assert.equal(estimateExpiryRisk({ ...base, low: 0, batches: [batch(5, 30)] }).state, "cannot_tell");
  for (const result of [estimateExpiryRisk(base), estimateExpiryRisk({ ...base, batches: [batch(5, 20)] }),
    estimateExpiryRisk({ ...base, batches: [batch(5, 30, "2026-10-05")] }), estimateExpiryRisk({ ...base, stockAsOfDate: undefined, batches: [batch(5, 30)] }),
    estimateExpiryRisk({ ...base, batches: [batch(5, 30)], reason: "Conflicting batch quantities" })]) assert.equal(result.state, "not_checked");
});

test("US5.5/5.6 changes usable stock and restock while preserving the user's planned order", () => {
  const originalInputs = inputs(12, 3);
  const result = evaluateProductPurchasePlan(demand(20, 30), { analysisDate: DATE, stock: stock(12), inputs: originalInputs,
    expiry: { columnConfirmed: true, dates: ["2026-10-06", "2026-11-15"], batches: [batch(0, 5), batch(40, 7)] } });
  assert.equal(result.expiryRisk?.state, "estimated"); assert.equal(result.estimatedRestock.state, "available");
  if (result.estimatedRestock.state === "available") { assert.equal(result.estimatedRestock.beforeQuantity?.value, 10); assert.equal(result.estimatedRestock.afterQuantity?.value, 15); }
  assert.equal(result.inputs, originalInputs); assert.equal(result.inputs.plannedOrder.state === "value" && result.inputs.plannedOrder.value, 12);
  assert.equal(result.audit.state, "verdict"); if (result.audit.state === "verdict") { assert.equal(result.audit.figures.expiryAtRisk?.value, 5); assert.equal(result.audit.figures.availableAfterOrder.value, 22); }
  const storage = resolveStorageWindow({ confirmed: true, storage: "refrigerate", categoryId: 7 }, [], [{ categoryId: 7, storage: "refrigerate", p25MinimumDays: 14, productCount: 10 }]);
  const capped = evaluateProductPurchasePlan(demand(20, 30), { analysisDate: DATE, stock: stock(12), inputs: originalInputs,
    expiry: { columnConfirmed: true, dates: [], batches: [batch(0, 5), batch(40, 7)] }, storageWindow: storage });
  assert.equal(capped.estimatedRestock.state, "available"); if (capped.estimatedRestock.state === "available") { assert.equal(capped.estimatedRestock.afterQuantity?.value, 10); assert.equal(capped.estimatedRestock.shelfLifeCap, 10); }
  const zero = evaluateProductPurchasePlan(demand(0, 30), { analysisDate: DATE, stock: stock(12), inputs: originalInputs, expiry: { columnConfirmed: true, dates: [], batches: [batch(0, 12)] }, storageWindow: storage });
  assert.equal(zero.estimatedRestock.state, "available"); if (zero.estimatedRestock.state === "available") { assert.equal(zero.estimatedRestock.afterQuantity, undefined); assert.match(zero.estimatedRestock.afterUnavailableReason ?? "", /demand could be zero/); }
});

test("storage requires confirmed conditions; pantry needs a product while restock age stays separate from expiry", () => {
  assert.equal(resolveStorageWindow(undefined).state, "unavailable");
  assert.equal(resolveStorageWindow({ confirmed: false, storage: "refrigerate", categoryId: 7 }).state, "unavailable");
  assert.equal(resolveStorageWindow({ confirmed: true, declined: true, storage: "refrigerate", categoryId: 7 }).state, "unavailable");
  assert.equal(resolveStorageWindow({ confirmed: true, storage: "pantry", categoryId: 7 }, [], [{ categoryId: 7, storage: "pantry", p25MinimumDays: 10, productCount: 20 }]).state, "unavailable");
  const product = resolveStorageWindow({ confirmed: true, storage: "pantry", productId: "rice" }, [{ id: "rice", name: "Rice", categoryId: 7, version: "128", windows: { pantry: { minDays: 30, maxDays: 60 } } }]);
  assert.equal(product.state, "estimated"); if (product.state === "estimated") { assert.equal(product.days, 30); assert.equal(product.maxDays, 60); assert.equal(product.method, "product_pick"); assert.match(product.limitation, /not Malaysian/); }
  assert.deepEqual(restockElapsedDays("2026-10-01", DATE), { state: "entered", date: "2026-10-01", elapsedDays: 5, source: "Your date" });
  assert.equal(restockElapsedDays("2026-10-07", DATE).state, "unavailable"); assert.equal(restockElapsedDays("2026-02-30", DATE).state, "unavailable");
});

test("mapped expiry quantities deduplicate repeated snapshots and flow through readiness to the shipped purchase calculation", async () => {
  const snapshot = await readiness([row("2026-08-10", "2026-10-11", "10"), row("2026-08-17", "2026-11-15", "20"), row("2026-08-24", "2026-10-11", "10")]);
  const evidence = snapshot.purchaseFileEvidence?.products[0];
  assert.equal(evidence?.expiryBatches?.length, 2); assert.deepEqual(evidence?.expiryBatches?.map(value => value.quantity), [10, 20]);
  assert.deepEqual(evidence?.expiryBatches?.[0].sourceRows, [2, 4]);
  const result = buildPurchasePlanReview(snapshot, forecast(snapshot, demand(28, 56))).products[0];
  assert.equal(result.expiryRisk?.state, "estimated"); if (result.expiryRisk?.state === "estimated") assert.equal(result.expiryRisk.quantity, 3);
});

test("readiness carries invalid/conflicting batch reasons and partial/missing anchors cannot change restock", async () => {
  const cases = [
    [row("2026-08-10", "2026-10-11", "10"), row("2026-08-17", "2026-10-11", "20")],
    [row("2026-08-10", "2026-10-11", "-1"), row("2026-08-17", "2026-11-15", "30")],
    [row("2026-08-10", "2026-10-11", "10")],
    [row("2026-08-10", "2026-10-11", "30", "")],
  ];
  for (const rows of cases) {
    const snapshot = await readiness(rows), plan = buildPurchasePlanReview(snapshot, forecast(snapshot)).products[0];
    assert.equal(plan.expiryRisk?.state, "not_checked");
    if (plan.estimatedRestock.state === "available") assert.equal(plan.estimatedRestock.beforeQuantity?.value, plan.estimatedRestock.afterQuantity?.value);
  }
  const invalid = await readiness(cases[1]); assert.ok(invalid.issues.some(issue => issue.issueCode === "INVALID_EXPIRY_QUANTITY"));
});

test("planning contexts apply only to the current evidence and preserve source values until an explicit valid override", async () => {
  const snapshot = await readiness(), key = snapshot.evidenceKey!;
  const stale = { evidenceKey: "older-source-and-mapping", unitCost: 99, kgPerUnit: 8, categoryConfirmed: true, category: "bread" };
  assert.equal(activePlanningContext(snapshot, stale), undefined);
  const unchanged = applyPlanningContexts(snapshot, { [KEY]: stale });
  assert.equal(estimatePurchaseCost(unchanged, KEY, 4).state, "estimated");
  assert.equal(unchanged.productCosts?.[0].state === "usable" && unchanged.productCosts?.[0].value, 2.5);
  const current = applyPlanningContexts(snapshot, { [KEY]: { evidenceKey: key, unitCost: 3, kgPerUnit: 0.7 } });
  const amount = estimatePurchaseCost(current, KEY, 4); assert.equal(amount.state, "estimated"); if (amount.state === "estimated") assert.equal(amount.amount, 12);
  const mass = planningMass(current, KEY); assert.equal(mass.state, "available"); if (mass.state === "available") assert.equal(mass.kgPerUnit, 0.7);
  assert.equal(snapshot.productCosts?.[0].state === "usable" && snapshot.productCosts?.[0].value, 2.5);
  assert.throws(() => applyPlanningContexts(snapshot, { [KEY]: { evidenceKey: key, unitCost: -1 } }), /finite seller cost/);
  assert.equal(planningStorageWindow(snapshot, { evidenceKey: "stale", storageSelection: { confirmed: true, storage: "refrigerate", categoryId: 7 } }).state, "unavailable");
});

test("Step 4 and Step 5 use the same validated cost even when no demand verdict is possible", async () => {
  const snapshot = await readiness(), edited = inputs(12, 3);
  const limited: ProductDemandEstimate = { productKey: KEY, label: "Cannot assess", recordedWeeksInLast8: 2, policyVersion: "test" };
  const commitments = estimatePurchaseCommitments(snapshot, KEY, edited), impact = buildImpactReview(snapshot, forecast(snapshot, limited), { [KEY]: edited });
  assert.equal(impact.products[0].plan.audit.state, "cannot_judge");
  assert.deepEqual(impact.products[0].plannedSpend, commitments.planned); assert.deepEqual(impact.products[0].incomingSpend, commitments.incoming); assert.deepEqual(impact.products[0].combinedCommitment, commitments.combined);
  assert.equal(impact.totals.plannedSpend.state, "estimated"); if (impact.totals.plannedSpend.state === "estimated") assert.equal(impact.totals.plannedSpend.amount, 30);
  assert.equal(impact.totals.excessCost.state, "unavailable");
  const zero = buildImpactReview(snapshot, forecast(snapshot), { [KEY]: inputs(0, 0) });
  assert.equal(zero.totals.plannedSpend.state, "estimated"); if (zero.totals.plannedSpend.state === "estimated") assert.equal(zero.totals.plannedSpend.amount, 0);
  const empty = buildImpactReview(snapshot, forecast(snapshot), { [KEY]: inputs() });
  assert.equal(empty.totals.plannedSpend.state, "unavailable"); assert.equal(empty.excludedCount, 1);
  assert.equal(estimatePurchaseCommitments(snapshot, KEY, inputs(12)).combined.state, "not_entered");
  const manual = applyPlanningContexts(snapshot, { [KEY]: { evidenceKey: snapshot.evidenceKey!, unitCost: 4 } });
  const updated = buildImpactReview(manual, forecast(manual), { [KEY]: edited });
  assert.equal(updated.products[0].plannedSpend.state, "estimated"); if (updated.products[0].plannedSpend.state === "estimated") assert.equal(updated.products[0].plannedSpend.amount, 48);
  assert.equal(estimatePurchaseCost(snapshot, KEY, 12, "stale-validation-key").state, "unavailable");
});

test("financial totals equal eligible product amounts and financial risk sorts usable costs before unavailable products", async () => {
  const a = row("2026-08-10", "2026-11-15", "30"), b = row("2026-08-17", "2026-11-15", "30", DATE, "30", "1.00"), c = row("2026-08-24", "2026-11-15", "30", DATE, "30", "");
  b[1] = "B"; b[2] = "Bread B"; c[1] = "C"; c[2] = "Bread C";
  const snapshot = await readiness([a, b, c]);
  const review: DemandForecastReview = { ...forecast(snapshot), products: [demand(20, 30, KEY), demand(20, 30, "ID|B"), demand(20, 30, "ID|C")] };
  const result = buildImpactReview(snapshot, review, { [KEY]: inputs(20, 0), "ID|B": inputs(80, 0), "ID|C": inputs(20, 0) });
  assert.deepEqual(sortFinancialRisk(result.products).map(product => product.productKey), ["ID|B", KEY, "ID|C"]);
  assert.equal(result.totals.plannedSpend.state, "estimated");
  if (result.totals.plannedSpend.state === "estimated") { assert.equal(result.totals.plannedSpend.amount, 130); assert.equal(result.totals.plannedSpend.includedCount, 2); assert.equal(result.totals.plannedSpend.excludedCount, 1); }
  const missing = result.products.find(product => product.productKey === "ID|C")!;
  assert.equal(missing.plannedSpend.state, "unavailable"); assert.equal(missing.excessCost.state, "unavailable");
  const partial = buildImpactReview(snapshot, { ...review, products: [review.products[0], { ...review.products[1], label: 'Cannot assess', range: undefined }, review.products[2]] }, { [KEY]: inputs(20, 0), "ID|B": inputs(80, 0) });
  assert.equal(partial.totals.plannedSpend.state === 'estimated' && partial.totals.plannedSpend.amount, 130);
  assert.equal(partial.totals.comparisonPlannedSpend.state === 'estimated' && partial.totals.comparisonPlannedSpend.amount, 50);
  assert.equal(partial.totals.comparisonPlannedSpend.includedCount, partial.totals.scenarioSpend.includedCount);
  assert.equal(partial.totals.spendDifference.state === 'estimated' && partial.totals.spendDifference.amount, 50);
});

test("supplied impact plans reject stale quantities, dates and purchase policies", async () => {
  const snapshot = await readiness(), review = forecast(snapshot), draft = { [KEY]: inputs(12, 0) };
  const plans = buildPurchasePlanReview(snapshot, review, { inputsByProduct: draft }).products;
  assert.doesNotThrow(() => buildImpactReview(snapshot, review, draft, plans));
  assert.throws(() => buildImpactReview(snapshot, review, { [KEY]: inputs(20, 0) }, plans), /matching|current/);
  assert.throws(() => buildImpactReview(snapshot, review, draft, plans.map(plan => ({ ...plan, analysisDate: "2026-10-05" }))), /matching|current/);
  assert.throws(() => buildImpactReview(snapshot, review, draft, plans.map(plan => ({ ...plan, purchasePolicyVersion: "old" }))), /matching|current/);
  const changedStock: ReadinessSnapshot = { ...snapshot, productStock: snapshot.productStock.map(value => ({ ...value, currentStock: 60 })) };
  assert.throws(() => buildImpactReview(changedStock, forecast(changedStock), draft, plans), /matching|current/);
  assert.equal(sortFinancialRisk(buildImpactReview(snapshot, review, draft).products)[0].productKey, KEY);
});

test("fractional stock's whole-unit expiry upper bound is rounded up while usable stock never becomes negative", () => {
  const plan = evaluateProductPurchasePlan(demand(1, 1), { analysisDate: DATE, stock: stock(0.5), inputs: inputs(0, 0),
    expiry: { columnConfirmed: true, dates: ["2026-10-05"], batches: [batch(-1, 0.5)] } });
  assert.equal(plan.expiryRisk?.state, "estimated");
  if (plan.expiryRisk?.state === "estimated") { assert.equal(plan.expiryRisk.checkedQuantity, 0.5); assert.equal(plan.expiryRisk.quantity, 1); }
  assert.equal(plan.audit.state, "verdict"); if (plan.audit.state === "verdict") assert.equal(plan.audit.figures.availableAfterOrder.value, 0);
});

test("100000 seeded cases verify shipped FEFO, restock, shelf caps and supplier invariants", () => {
  let seed = 20261004;
  const random = (limit: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % limit; };
  let zeroTargets = 0, zeroDemand = 0, capped = 0;
  for (let index = 0; index < 100_000; index += 1) {
    const low = random(101), high = low + random(101), quantity = random(201) + (random(5) === 0 ? 0.5 : 0), incoming = random(31);
    const firstQuantity = Math.floor(quantity / 2), batches = [batch(random(68) - 7, firstQuantity), batch(random(68) - 7, quantity - firstQuantity)];
    const shelfDays = random(120) + 1, useCap = random(2) === 0;
    const risk = estimateExpiryRisk({ analysisDate: DATE, stock: quantity, stockAsOfDate: DATE, low, high, batches });
    if (low === 0) { zeroDemand += 1; assert.equal(risk.state, "cannot_tell"); }
    else { assert.equal(risk.state, "estimated"); if (risk.state === "estimated") { assert.ok(risk.low <= risk.quantity && risk.quantity <= risk.high); assert.ok(risk.low >= 0 && risk.high <= Math.ceil(quantity)); } }
    const plan = evaluateProductPurchasePlan(demand(low, high), { analysisDate: DATE, stock: stock(quantity), inputs: inputs(random(61), incoming), expiry: { columnConfirmed: true, dates: [], batches },
      ...(useCap ? { storageWindow: { state: "estimated" as const, days: shelfDays, method: "category_p25" as const, source: "Property fixture", limitation: "Synthetic fixture" } } : {}) });
    assert.equal(plan.estimatedRestock.state, "available"); if (plan.estimatedRestock.state !== "available") continue;
    const target = plan.estimatedRestock.quantity.value;
    assert.ok(Number.isSafeInteger(target) && target >= 0);
    if (useCap && low > 0) { capped += 1; assert.ok(target <= Math.floor(low / 28 * shelfDays)); }
    const caseSize = random(25) + 1, minimumOrder = random(61);
    const supplier = suggestSupplierOrder(plan.estimatedRestock, { caseSize, minimumOrder, leadTimeDays: random(29) }, DATE);
    if (low === 0) { assert.equal(supplier.state, "unavailable"); continue; }
    assert.equal(supplier.state, "available"); if (supplier.state !== "available") continue;
    assert.ok(Number.isSafeInteger(supplier.quantity) && supplier.quantity >= 0 && supplier.quantity % caseSize === 0);
    if (target === 0) { zeroTargets += 1; assert.equal(supplier.quantity, 0); }
    else assert.ok(supplier.quantity >= target && supplier.quantity >= minimumOrder);
  }
  assert.ok(zeroTargets > 0 && zeroDemand > 0 && capped > 0);
});
