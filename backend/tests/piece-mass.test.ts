import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePriceCatcherPieceMass } from "../src/piece-mass.ts";

test('cleaned graded-egg categories retain sourced mass and refuse a conflicting source grade',()=>{
  for(const grade of ['A','B','C']){
    const category=`eggs_chicken_grade_${grade.toLowerCase()}`;
    assert.deepEqual(parsePriceCatcherPieceMass(`TELUR AYAM GRED ${grade}`,category),parsePriceCatcherPieceMass(`TELUR AYAM GRED ${grade}`,'eggs'));
  }
  assert.equal(parsePriceCatcherPieceMass('TELUR AYAM GRED B','eggs_chicken_grade_a').state,'unavailable');
});

test("PriceCatcher chicken-egg A/B/C bounds become labelled per-piece midpoint estimates", () => {
  for (const [grade, low, high] of [["A", 65, 69.9], ["B", 60, 64.9], ["C", 55, 59.9]] as const) {
    const result = parsePriceCatcherPieceMass(`TELUR AYAM GRED ${grade}`, "eggs");
    assert.equal(result.state, "available"); if (result.state !== "available") continue;
    assert.equal(result.kgPerUnit, (low + high) / 2 / 1000); assert.equal(result.low, low / 1000); assert.equal(result.high, high / 1000);
    assert.equal(result.estimated, true); assert.equal(result.unitBasis, "one_piece"); assert.match(result.provenance, /PriceCatcher/);
  }
  const tray = parsePriceCatcherPieceMass("Telur Ayam Gred A 30 biji", "eggs");
  assert.equal(tray.state, "available"); if (tray.state === "available") assert.equal(tray.kgPerUnit, 0.06745); // One egg, not a tray.
});

test("counted kampung, quail, salted, boiled eggs and ungraded chicken eggs never default to a generic egg weight", () => {
  for (const name of ["TELUR AYAM KAMPUNG 10 BIJI", "TELUR PUYUH 20 BIJI", "TELUR MASIN", "TELUR REBUS", "TELUR AYAM", "TELUR AYAM KAMPUNG GRED A", "TELUR AYAM GRED A GRED B"]) {
    assert.equal(parsePriceCatcherPieceMass(name, "eggs").state, "unavailable", name);
  }
  assert.equal(parsePriceCatcherPieceMass("TELUR AYAM GRED A", undefined).state, "unavailable");
  assert.equal(parsePriceCatcherPieceMass("TELUR AYAM GRED A", "chicken").state, "unavailable");
});

test("the supplied bounded fish names use reciprocal count bounds and an explicit inverse-midpoint calculation", () => {
  const result = parsePriceCatcherPieceMass("IKAN BAWAL HITAM (ANTARA 2 HINGGA 5 EKOR SEKILOGRAM)", "fresh_fish_wild");
  assert.equal(result.state, "available");
  if (result.state === "available") {
    assert.equal(result.kgPerUnit, 1 / 3.5); assert.equal(result.low, 0.2); assert.equal(result.high, 0.5);
    assert.deepEqual(result.countPerKilogram, { low: 2, high: 5 }); assert.equal(result.method, "inverse_count_midpoint"); assert.match(result.calculation, /1 \/ \(\(2 \+ 5\) \/ 2\)/);
  }
  const prawn = parsePriceCatcherPieceMass("UDANG HARIMAU (ANTARA 20 HINGGA 30 EKOR SEKILOGRAM)", "prawns");
  assert.equal(prawn.state, "available"); if (prawn.state === "available") assert.equal(prawn.kgPerUnit, 0.04);
});

test("open-ended or contradictory fish size classes refuse rather than inventing the missing bound", () => {
  for (const name of ["IKAN SELAR KUNING (≥ 11 EKOR SEKILOGRAM)", "KETAM RENJONG/BUNGA (≤ 4 EKOR SEKILOGRAM)",
    "IKAN (ANTARA 5 HINGGA 2 EKOR SEKILOGRAM)", "IKAN (ANTARA 0 HINGGA 2 EKOR SEKILOGRAM)", "IKAN (ANTARA 2 HINGGA 5 EKOR SEKILOGRAM) (4 EKOR SEKILOGRAM)"]) {
    assert.equal(parsePriceCatcherPieceMass(name, name.startsWith("KETAM") ? "shellfish_other" : "fresh_fish_wild").state, "unavailable", name);
  }
  assert.equal(parsePriceCatcherPieceMass("IKAN 5 EKOR", "fresh_fish_wild").state, "unavailable");
  assert.equal(parsePriceCatcherPieceMass("IKAN 5 EKOR SEKILOGRAM", "beef").state, "unavailable");
});

test("an explicit grams-per-piece statement is accepted without mistaking a pack weight for a piece weight", () => {
  const exact = parsePriceCatcherPieceMass("TELUR AYAM 65 GRAM SEBIJI", "eggs");
  assert.equal(exact.state, "available"); if (exact.state === "available") assert.equal(exact.kgPerUnit, 0.065);
  const bounded = parsePriceCatcherPieceMass("TELUR AYAM 65-69.9 G SEBIJI", "eggs");
  assert.equal(bounded.state, "available"); if (bounded.state === "available") assert.equal(bounded.method, "explicit_piece_weight_midpoint");
  for (const name of ["TELUR AYAM 650 G 10 BIJI", "EPAL HIJAU SAIZ M 1 BIJI", "TELUR AYAM 0 G SEBIJI", "TELUR AYAM -65 G SEBIJI", "TELUR AYAM ≥65 G SEBIJI", "TELUR AYAM 65 G SEBIJI 70 G SEBIJI", "TELUR AYAM GRED A 100 G SEBIJI"]) {
    assert.equal(parsePriceCatcherPieceMass(name, name.startsWith("EPAL") ? "apple" : "eggs").state, "unavailable", name);
  }
});
