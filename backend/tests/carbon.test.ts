import assert from "node:assert/strict";
import { test } from "node:test";
import { CARBON_REFERENCE_ROWS, CARBON_SOURCE_METADATA } from "../src/reference-carbon-data.ts";
import { CARBON_MALAYSIA_ILLUSTRATION, combineCarbonSources, estimateCarbonImpact, resolveCarbonFactor, summarizeCarbonImpact, type CarbonImpactInput } from "../src/carbon.ts";

const food = (overrides: Partial<CarbonImpactInput> = {}): CarbonImpactInput => ({
  productKey: "rice", productName: "Rice", kind: "potential_excess", isFood: true, category: "rice", categoryConfirmed: true,
  quantity: 10, quantityUnit: "packs", massKgPerUnit: 0.5, conversionSource: "Confirmed source-file unit weight", ...overrides,
});
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("all 90 cleaned CP3 category outcomes and numeric ranges reproduce the supplied reference table", () => {
  const rows = CARBON_REFERENCE_ROWS;
  assert.equal(rows.length, 90);
  let agreed = 0, estimated = 0, excluded = 0;
  for (const row of rows) {
    const actual = resolveCarbonFactor(row.category, "bounded_cp3");
    if (row.bounded.value === null) { assert.equal(actual.state, "unavailable", row.category); excluded += 1; continue; }
    assert.equal(actual.state, "available", row.category);
    if (actual.state !== "available") continue;
    close(actual.factorKgCO2ePerKg, row.bounded.value);
    close(actual.sourceRange!.low, row.bounded.low!); close(actual.sourceRange!.high, row.bounded.high!);
    assert.equal(actual.label === "sources_agree", row.bounded.status === "sources agree");
    if (actual.label === "sources_agree") agreed += 1; else estimated += 1;
  }
  assert.deepEqual({ agreed, estimated, excluded }, { agreed: 47, estimated: 15, excluded: 28 });
});

test("largest-group union refuses competing clusters and does not depend on source object order", () => {
  const a = combineCarbonSources("fixture", { SEL: 1, AGB: 1.1, Poore: 4, BCD: 4.1 }, "bounded_cp3");
  const b = combineCarbonSources("fixture", { BCD: 4.1, Poore: 4, AGB: 1.1, SEL: 1 }, "bounded_cp3");
  assert.deepEqual(a, b); assert.equal(a.state, "unavailable");
  const majority = combineCarbonSources("fixture", { SEL: 1, AGB: 1.1, Poore: 1.2, BCD: 9 });
  assert.equal(majority.state, "available");
  if (majority.state === "available") {
    assert.equal(majority.label, "sources_agree"); close(majority.factorKgCO2ePerKg, 1.1);
    assert.deepEqual(majority.selectedSources, ["SEL", "AGB", "Poore"]);
    assert.deepEqual(majority.sourceRange, { low: 1, high: 9 }); assert.deepEqual(majority.groupRange, { low: 1, high: 1.2 });
  }
});

test("rice is a bounded median; chicken, eggs and sugar require an explicitly selected estimate alternative", () => {
  const rice = resolveCarbonFactor("rice", "bounded_cp3");
  assert.equal(rice.state, "available");
  if (rice.state === "available") { close(rice.factorKgCO2ePerKg, 3.216890243902439); assert.equal(rice.label, "estimate"); assert.equal(rice.method, "bounded_median"); }
  for (const category of ["chicken", "eggs", "sugar"]) {
    assert.equal(resolveCarbonFactor(category, "bounded_cp3").state, "unavailable");
    const median = resolveCarbonFactor(category, "median_estimate"), poore = resolveCarbonFactor(category, "poore_estimate");
    assert.equal(median.state, "available"); assert.equal(poore.state, "available");
    if (median.state === "available") { assert.equal(median.label, "estimate"); assert.equal(median.method, "all_source_median"); }
    if (poore.state === "available") { assert.equal(poore.label, "estimate"); assert.equal(poore.factorKgCO2ePerKg, category === "chicken" ? 9.87 : category === "eggs" ? 4.67 : 3.2); }
  }
});

test("the user-confirmed v2 default refuses unbounded and single-source factors", () => {
  for (const category of ["chicken", "eggs", "sugar", "buffalo"]) assert.equal(resolveCarbonFactor(category).state, "unavailable");
  const rice = resolveCarbonFactor("rice");
  assert.equal(rice.state, "available");
  if (rice.state === "available") { assert.equal(rice.policy, "bounded_cp3"); assert.equal(rice.label, "estimate"); assert.equal(rice.method, "bounded_median"); }
});

test("single-source estimates stay labelled and buffalo never borrows beef's factor", () => {
  const buffalo = resolveCarbonFactor("buffalo", "median_estimate"), beef = resolveCarbonFactor("beef", "median_estimate");
  assert.equal(resolveCarbonFactor("buffalo", "bounded_cp3").state, "unavailable");
  assert.equal(buffalo.state, "available"); assert.equal(beef.state, "available");
  if (buffalo.state === "available" && beef.state === "available") {
    assert.equal(buffalo.factorKgCO2ePerKg, 78.8); assert.equal(buffalo.label, "estimate"); assert.equal(buffalo.method, "single_source");
    assert.notEqual(buffalo.factorKgCO2ePerKg, beef.factorKgCO2ePerKg);
  }
  const milk = resolveCarbonFactor("milk_powder", "median_estimate");
  assert.equal(milk.state, "available"); if (milk.state === "available") close(milk.factorKgCO2ePerKg, 12.440999999999999);
  const coffee = resolveCarbonFactor("coffee_mix", "median_estimate");
  assert.equal(coffee.state, "unavailable"); // Cleaned data withdrew the experimental proxy.
});

test("no-source categories stay unavailable because the supplied bundle contains no verified food-group fallback", () => {
  for (const category of ["kaya", "malted_drink", "imaginary_category"]) {
    for (const policy of ["bounded_cp3", "median_estimate", "poore_estimate"] as const) {
      const result = resolveCarbonFactor(category, policy);
      assert.equal(result.state, "unavailable"); if (result.state === "unavailable") assert.equal(result.code, "NO_EMISSION_FACTOR");
    }
  }
  assert.throws(() => combineCarbonSources("x", { SEL: 0 }));
  assert.throws(() => combineCarbonSources("x", { AGB: Infinity }));
  assert.match(CARBON_SOURCE_METADATA.AGB.boundary, /consumer stage excluded/);
});

test("directly recorded kilograms require no unit weight, but still require food and category confirmation", () => {
  const measured = estimateCarbonImpact(food({ kind: "recorded_waste", quantity: undefined, measuredMassKg: 38, massKgPerUnit: undefined }));
  assert.equal(measured.state, "estimated");
  if (measured.state === "estimated") { assert.equal(measured.massKg, 38); assert.equal(measured.massBasis, "measured"); close(measured.kgCO2e, 38 * 3.216890243902439); }
  const kg = estimateCarbonImpact(food({ kind: "recorded_waste", quantity: 38, quantityUnit: "kg", massKgPerUnit: undefined }));
  assert.equal(kg.state, "estimated"); if (kg.state === "estimated") assert.equal(kg.massBasis, "measured");
  const unconfirmed = estimateCarbonImpact(food({ categoryConfirmed: false, measuredMassKg: 38 }));
  assert.equal(unconfirmed.state, "unavailable"); assert.equal(unconfirmed.code, "CATEGORY_NOT_CONFIRMED"); assert.equal(unconfirmed.kgAtRisk, 38);
  const nonfood = estimateCarbonImpact(food({ isFood: false }));
  assert.equal(nonfood.state, "unavailable"); assert.equal(nonfood.code, "NOT_FOOD");
});

test("per-unit mass keeps its conversion source and missing conversions never turn into zero", () => {
  const converted = estimateCarbonImpact(food());
  assert.equal(converted.state, "estimated");
  if (converted.state === "estimated") { assert.equal(converted.massKg, 5); assert.equal(converted.conversionSource, "Confirmed source-file unit weight"); assert.match(converted.calculation, /5 kg/); }
  const missing = estimateCarbonImpact(food({ massKgPerUnit: undefined }));
  assert.equal(missing.state, "unavailable"); assert.equal(missing.code, "NO_WEIGHT");
  assert.equal(estimateCarbonImpact(food({ massKgPerUnit: -1 })).state, "unavailable");
  assert.equal(estimateCarbonImpact(food({ conversionSource: undefined })).state, "unavailable");
  assert.equal(estimateCarbonImpact(food({ quantity: -1 })).state, "unavailable");
});

test("no recorded waste and explicitly recorded zero have distinct summary states", () => {
  const noRecord = estimateCarbonImpact(food({ kind: "recorded_waste", quantity: undefined }));
  assert.equal(noRecord.state, "no_record"); assert.equal(summarizeCarbonImpact([noRecord]).state, "no_records");
  assert.equal(summarizeCarbonImpact([noRecord]).kgCO2e, undefined);
  const zero = estimateCarbonImpact(food({ kind: "recorded_waste", quantity: 0 }));
  assert.equal(zero.state, "estimated");
  const summary = summarizeCarbonImpact([zero]); assert.equal(summary.state, "estimated"); assert.equal(summary.kgCO2e, 0); assert.equal(summary.includedProductCount, 1);
});

test("signed scenario CO2e remains separate from actual records and requires a named baseline", () => {
  const difference = estimateCarbonImpact(food({ kind: "scenario_difference", quantity: -10, baseline: "Supplier B minus current planned order" }));
  assert.equal(difference.state, "estimated");
  if (difference.state === "estimated") { assert.ok(difference.kgCO2e < 0); assert.ok(difference.kgCO2eRange.low <= difference.kgCO2eRange.high); assert.match(difference.limitation, /does not change recorded waste/); }
  assert.equal(estimateCarbonImpact(food({ kind: "scenario_difference", baseline: undefined })).state, "unavailable");
  assert.throws(() => summarizeCarbonImpact([difference, estimateCarbonImpact(food({ kind: "recorded_waste" }))]), /separately/);
});

test("summaries expose contributors, mass shares by factor label, and confirmation work ordered by kg at risk", () => {
  const summary = summarizeCarbonImpact([
    estimateCarbonImpact(food()),
    estimateCarbonImpact(food({ productKey: "bread", category: "bread" })),
    estimateCarbonImpact(food({ productKey: "small", quantity: 2, categoryConfirmed: false })),
    estimateCarbonImpact(food({ productKey: "big", quantity: 100, categoryConfirmed: false })),
  ]);
  assert.equal(summary.totalProductCount, 4); assert.equal(summary.includedProductCount, 2); assert.equal(summary.excludedProductCount, 2);
  assert.equal(summary.massKgSourcesAgree, 5); assert.equal(summary.massKgEstimate, 5); assert.equal(summary.massShareSourcesAgree, 0.5); assert.equal(summary.massShareEstimate, 0.5);
  assert.deepEqual(summary.confirmationQueue.map(row => row.productKey), ["big", "small"]);
  assert.equal(CARBON_MALAYSIA_ILLUSTRATION.kgCO2ePerPersonPerDay, 29.95); assert.match(CARBON_MALAYSIA_ILLUSTRATION.scope, /All sectors/);
});
