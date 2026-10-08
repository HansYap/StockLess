import assert from "node:assert/strict";
import { test } from "node:test";
import { predictM12CategoryModel, suggestProductCategory, confirmProductCategory, type CategoryKeywordDefinition } from "../src/cp3-category.ts";
import { parsePackQuantity, resolveProductMass, listMeasuredFaoDensities } from "../src/cp3-mass.ts";
import { M12_REFERENCE } from "./fixtures/cp3-m12-reference.ts";
import { CP3_PACK_GOLD } from "./fixtures/cp3-pack-gold.ts";

const definitions: readonly CategoryKeywordDefinition[] = [
  { category: "rice", keywords: ["beras", "rice"], provenance: "Test-only reviewed keyword fixture" },
  { category: "soy_sauce", keywords: ["soy sauce", "kicap"], provenance: "Test-only reviewed keyword fixture" },
  { category: "sauce", keywords: ["sauce"], provenance: "Test-only reviewed keyword fixture" },
  { category: "chicken", keywords: ["chicken", "ayam"], provenance: "Test-only reviewed keyword fixture" },
  { category: "sugar", keywords: ["sugar"], provenance: "Test-only reviewed keyword fixture" },
];

test("supplied M12 P0 browser model preserves all 446 Python reference labels", () => {
  for (const item of M12_REFERENCE) assert.equal(predictM12CategoryModel(item.name).category, item.label, item.name);
});

test("M12 never treats a model-only prediction or suggestion as confirmed", () => {
  const missing = suggestProductCategory("Beras putih 5kg", { keywordDefinitions: [] });
  assert.equal(missing.state, "needs_category");
  assert.equal(missing.reasonCode, "keyword_table_missing");
  assert.equal(missing.requiresConfirmation, true);
  const suggestion = suggestProductCategory("Beras putih 5kg", { keywordDefinitions: definitions });
  assert.equal(suggestion.state, "suggested");
  assert.equal(suggestion.category, "rice");
  assert.equal(suggestion.requiresConfirmation, true);
  assert.ok(suggestion.evidence.closestKnownItem);
  assert.equal("probability" in suggestion, false);
  assert.equal("confidence" in suggestion, false);
  const decision = confirmProductCategory("Beras putih 5kg", "rice", { productKey: "R", evidenceKey: "source-v1" });
  assert.equal(decision.state, "confirmed");
  assert.equal(decision.evidenceKey, "source-v1");
  assert.equal(decision.provenance, "user confirmed");
});

test("M9 refuses independent conflicting keywords and retains nested specific evidence", () => {
  const ambiguous = suggestProductCategory("Chicken rice", { keywordDefinitions: definitions });
  assert.equal(ambiguous.reasonCode, "ambiguous_keywords");
  const nested = suggestProductCategory("Soy sauce", { keywordDefinitions: definitions });
  assert.deepEqual(nested.evidence.keywordHits.map(item => item.category), ["soy_sauce"]);
  const spelling = suggestProductCategory("chikcen", { keywordDefinitions: definitions });
  assert.equal(spelling.evidence.keywordHits[0].match, "spelling_tolerance");
  assert.equal(spelling.evidence.keywordHits[0].category, "chicken");
  const trap = suggestProductCategory("Nasi ayam kukus", { keywordDefinitions: definitions });
  assert.equal(trap.reasonCode, "prepared_food");
  const unproven = suggestProductCategory("Rice", { keywordDefinitions: [{ category: "rice", keywords: ["rice"], provenance: "" }] });
  assert.equal(unproven.reasonCode, "keyword_table_missing");
});

test("pack parser agrees with supplied 155 real-unit and 60 synthetic gold strings", () => {
  for (const [text, expected, dimension] of CP3_PACK_GOLD) {
    const parsed = parsePackQuantity(text);
    if (expected === null) assert.equal(parsed.state, "unavailable", text);
    else {
      assert.equal(parsed.state, "available", text);
      if (parsed.state === "available") {
        assert.ok(Math.abs(parsed.quantity - expected) <= expected * .000001, text);
        assert.equal(parsed.dimension, dimension, text);
      }
    }
  }
});

test("mass has measured FAO density provenance; unsupported liquids and count units refuse", () => {
  const oil = resolveProductMass({ packText: "2 x 1L", confirmedCategory: "cooking_oil" });
  assert.equal(oil.state, "available");
  if (oil.state === "available") {
    assert.equal(oil.kgPerUnit, 1.78);
    assert.equal(oil.densityKgPerLitre, .89);
    assert.equal(oil.method, "fao_density");
    assert.ok(oil.provenance.includes("FAO/INFOODS"));
  }
  for (const category of ["cordial", "fresh_milk", "water", "coconut_milk"]) {
    const mass = resolveProductMass({ packText: "1L", confirmedCategory: category });
    assert.equal(mass.state, "unavailable");
    if (mass.state === "unavailable") assert.equal(mass.reasonCode, "density_missing");
  }
  assert.equal(Object.keys(listMeasuredFaoDensities()).length, 4);
  assert.equal(resolveProductMass({ packText: "1L" }).state, "unavailable");
  assert.equal(resolveProductMass({ packText: "30 biji", confirmedCategory: "eggs" }).state, "unavailable");
});

test("manual mass and explicitly enabled estimated density remain distinguishable", () => {
  const manual = resolveProductMass({ packText: "30 biji", confirmedCategory: "eggs", manualKgPerUnit: 1.65 });
  assert.equal(manual.state, "available");
  if (manual.state === "available") { assert.equal(manual.method, "manual"); assert.equal(manual.kgPerUnit, 1.65); }
  for (const invalid of [0, -1, NaN, Infinity]) assert.equal(resolveProductMass({ packText: "1kg", manualKgPerUnit: invalid }).state, "unavailable");
  const estimate = resolveProductMass({ packText: "250ml", confirmedCategory: "cordial", allowEstimatedDensity: true });
  assert.equal(estimate.state, "available");
  if (estimate.state === "available") { assert.equal(estimate.method, "estimated_density"); assert.equal(estimate.kgPerUnit, .25); assert.equal(estimate.approximate, true); }
  const mass = resolveProductMass({ packText: "1/2 kg" });
  assert.equal(mass.state, "available");
  if (mass.state === "available") assert.equal(mass.kgPerUnit, .5);
  for (const text of ["100g + 200g", "2x3x100g", "180–200g", "1/0 kg", "0kg"]) assert.equal(parsePackQuantity(text).state, "unavailable", text);
});
