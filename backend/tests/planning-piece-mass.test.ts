import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDemandForecastReview, buildEnvironmentalImpact, buildImpactReview, confirmIdentityMode, createMappingState,
  createPurchaseQuantity, emptyProductPurchaseInputs, parseCsvBytes, planningMass, previousCompleteWeekStarts, runReadinessCheck, setMapping,
  type ProductPlanningContext } from "../src/index.ts";

const DATE = "2026-10-06", KEY = "ID|000101";
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
async function fixture(pack: string, name = "TELUR AYAM GRED A", weights?: readonly string[]) {
  const headers = ["Date", "SKU", "Name", "Pack", "Quantity", "Stock", "Stock date", ...(weights ? ["Weight kg"] : [])];
  const records = previousCompleteWeekStarts(DATE).map((date, index) => [date, "000101", name, pack, "10", "0", DATE, ...(weights ? [weights[index] ?? weights[0]] : [])]);
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const dataset = await parseCsvBytes(new TextEncoder().encode([headers, ...records].map(row => row.map(quote).join(",")).join("\n")), { sourceMode: "user", sourceName: "piece-packs.csv" });
  let mapping = createMappingState();
  for (const [index, field] of (["transaction_date", "product_code", "product_name", "pack_variant", "quantity_sold", "current_stock", "stock_as_of_date", ...(weights ? ["unit_weight_kg" as const] : [])] as const).entries()) mapping = setMapping(mapping, field, `column-${index}`, true);
  const snapshot = await runReadinessCheck(dataset, confirmIdentityMode(mapping, "stable"), { analysisDate: DATE });
  const context: ProductPlanningContext = { evidenceKey: snapshot.evidenceKey!, category: "eggs", categoryConfirmed: true, isFood: true };
  return { snapshot, context };
}

test("explicit egg count multiplies one-piece grade estimate into one actual sales pack", async () => {
  for (const [pack, count] of [["1 piece", 1], ["30 biji", 30], ["6 eggs", 6], ["pack of 12 eggs", 12], ["sebiji", 1]] as const) {
    const { snapshot, context } = await fixture(pack);
    const mass = planningMass(snapshot, KEY, context);
    assert.equal(mass.state, "available", pack);
    if (mass.state === "available") {
      close(mass.kgPerUnit, .06745 * count);
      assert.equal(mass.method, "piece_estimate");
      assert.equal(mass.approximate, true);
      assert.match(mass.provenance, new RegExp(`${count} pieces`));
      assert.match(mass.provenance, /PriceCatcher/);
      assert.match(mass.provenance, /not a measured pack weight/);
    }
  }
});

test("bounded fish count-per-kg in the name supplies only a piece estimate, never the sales pack count", async () => {
  const name = "IKAN BAWAL HITAM (ANTARA 2 HINGGA 5 EKOR SEKILOGRAM)";
  const { snapshot, context } = await fixture("4 ekor", name);
  const fishContext = { ...context, category: "fresh_fish_wild" };
  const mass = planningMass(snapshot, KEY, fishContext);
  assert.equal(mass.state, "available");
  if (mass.state === "available") { close(mass.kgPerUnit, 4 / 3.5); assert.match(mass.provenance, /4 pieces/); }
  for (const pack of ["1 tray", "tray", "", "unknown", "2 ekor per kg", "2-5 ekor", "1 unit", "1 dozen", "4 eggs"]) {
    const unknown = await fixture(pack, name);
    assert.equal(planningMass(unknown.snapshot, KEY, { ...unknown.context, category: "fresh_fish_wild" }).state, "unavailable", pack);
  }
});

test("unconfirmed/stale categories and unsourced size names never unlock a pack conversion", async () => {
  const { snapshot, context } = await fixture("30 biji", "TELUR AYAM GRED A 30 BIJI");
  assert.equal(planningMass(snapshot, KEY, { ...context, categoryConfirmed: false }).state, "unavailable");
  assert.equal(planningMass(snapshot, KEY, { ...context, evidenceKey: "old-source" }).state, "unavailable");
  assert.equal(planningMass(snapshot, KEY, { ...context, isFood: false }).state, "unavailable");
  const tray = await fixture("tray", "TELUR AYAM GRED A 30 BIJI");
  assert.equal(planningMass(tray.snapshot, KEY, tray.context).state, "unavailable");
  const noBounds = await fixture("30 biji", "TELUR AYAM KAMPUNG");
  assert.equal(planningMass(noBounds.snapshot, KEY, noBounds.context).state, "unavailable");
});

test("piece fallback preserves verified pack/manual/file mass and never masks invalid source weight", async () => {
  const pack = await fixture("2kg");
  const packMass = planningMass(pack.snapshot, KEY, pack.context);
  assert.equal(packMass.state, "available");
  if (packMass.state === "available") { assert.equal(packMass.kgPerUnit, 2); assert.equal(packMass.method, "pack_parser"); }
  const file = await fixture("30 biji", undefined, ["1.8"]);
  const fileMass = planningMass(file.snapshot, KEY, file.context);
  assert.equal(fileMass.state, "available");
  if (fileMass.state === "available") { assert.equal(fileMass.kgPerUnit, 1.8); assert.equal(fileMass.method, "manual"); assert.match(fileMass.provenance, /Validated file weight/); }
  const manual = planningMass(file.snapshot, KEY, { ...file.context, kgPerUnit: 1.9 });
  assert.equal(manual.state, "available"); if (manual.state === "available") { assert.equal(manual.kgPerUnit, 1.9); assert.equal(manual.method, "manual"); }
  for (const weights of [["bad"], ["1.8", "2.0"]]) {
    const invalid = await fixture("30 biji", undefined, weights);
    assert.equal(planningMass(invalid.snapshot, KEY, invalid.context).state, "unavailable");
    const overridden = planningMass(invalid.snapshot, KEY, { ...invalid.context, kgPerUnit: 1.9 });
    assert.equal(overridden.state, "available"); if (overridden.state === "available") assert.equal(overridden.kgPerUnit, 1.9);
  }
  for (const count of ["0 eggs", "-3 eggs", "1.5 eggs", "30's", "2 x 30 biji"]) {
    const bad = await fixture(count);
    assert.equal(planningMass(bad.snapshot, KEY, bad.context).state, "unavailable", count);
  }
});

test("environment integration uses estimated whole-pack mass and retains its explicit multiplier", async () => {
  const { snapshot, context } = await fixture("30 biji");
  const forecast = buildDemandForecastReview(snapshot);
  const drafts = { [KEY]: { ...emptyProductPurchaseInputs(), plannedOrder: createPurchaseQuantity(100, "input by you") } };
  const contexts = { [KEY]: context };
  const impact = buildImpactReview(snapshot, forecast, drafts, undefined, contexts);
  const result = buildEnvironmentalImpact(snapshot, impact, contexts).potentialResults[0];
  assert.equal(result.state, "unavailable");
  if (result.state === "unavailable") {
    assert.equal(result.code, "SOURCES_DISAGREE");
    close(result.kgAtRisk!, impact.products[0].excessUnits! * .06745 * 30);
  }
});
