import assert from "node:assert/strict";
import { test } from "node:test";
import { addCalendarDays, buildDemandForecastReview, buildProductAssessments, buildProductTimelines, buildPurchasePlanReview, confirmIdentityMode,
  createCorrectionReport, createMappingState, createPurchaseQuantity, emptyProductPurchaseInputs, estimatePurchaseCost, evaluateCapabilities, evaluateStockFreshness,
  parseCsvBytes, previousCompleteWeekStarts, readinessEvidenceKey, runReadinessCheck, setMapping, collectProductLabels, compareSupplierOrders, summarizePurchaseExcess, proposeMappings, type CanonicalField, type MappingState } from "../src/index.ts";

const DATE = "2026-10-06";
const fields: readonly CanonicalField[] = ["transaction_date", "product_code", "quantity_sold", "product_name", "pack_variant", "current_stock", "stock_as_of_date", "unit_cost", "unit_weight_kg"];
const headers = "Date,SKU,Quantity,Name,Pack,Stock,Stock date,Unit Cost,Unit Weight Kg";
const line = (date: string, code = "A", cost = "2.50", name = "Tea", pack = "250 g", quantity = "10") => [date, code, quantity, name, pack, "0", "2026-10-05", cost, "0.25"];
function mappingFor(selected: readonly CanonicalField[] = fields, mode: "stable" | "composite" = "stable") {
  let mapping = createMappingState();
  for (const field of selected) mapping = setMapping(mapping, field, `column-${fields.indexOf(field)}`, true);
  return confirmIdentityMode(mapping, mode);
}
async function check(records: string[][], mapping: MappingState = mappingFor()) {
  const bytes = new TextEncoder().encode([headers, ...records.map(row => row.join(","))].join("\n"));
  const source = bytes.slice();
  const dataset = await parseCsvBytes(bytes, { sourceMode: "user", sourceName: "sales.csv" });
  const before = JSON.stringify(dataset);
  const snapshot = await runReadinessCheck(dataset, mapping, { analysisDate: DATE });
  assert.deepEqual(bytes, source); assert.equal(JSON.stringify(dataset), before);
  return { dataset, mapping, snapshot, forecast: buildDemandForecastReview(snapshot) };
}
const eight = (code = "A", cost = "2.50") => previousCompleteWeekStarts(DATE).map(date => line(date, code, cost, `Tea ${code}`));

test("column proposals distinguish product pack size from supplier case size in English and Malay", async () => {
  for (const header of ["Pack size", "Saiz Pek"]) {
    const dataset = await parseCsvBytes(new TextEncoder().encode(`Date,SKU,Quantity,${header},Case size\n2026-09-28,A,10,250 g,6`), {sourceMode:"user",sourceName:"packs.csv"});
    const result = await proposeMappings(dataset);
    assert.equal(result.proposals.find(p=>p.targetField==="pack_variant")?.sourceColumnId,"column-3");
    assert.equal(result.proposals.find(p=>p.targetField==="pack_size")?.sourceColumnId,"column-4");
  }
});

test("US1.6 retains every conflicting source label without restoring recommendations", async () => {
  const records = eight(); records[7][3] = "Teh Alternatif"; records[7][4] = "500 g";
  const { snapshot, forecast } = await check(records);
  const labels = collectProductLabels(snapshot).get("ID|A")!;
  assert.deepEqual(labels.names, ["Tea A", "Teh Alternatif"]);
  assert.deepEqual(labels.packs, ["250 g", "500 g"]);
  assert.deepEqual(labels.codes, ["A"]);
  assert.equal(forecast.products[0].range, undefined);
});

test("supplier comparison shares the restock target, handles MOQ and missing/invalid terms, and leaves evidence unchanged", async () => {
  const { snapshot, forecast } = await check(eight());
  const estimate = buildPurchasePlanReview(snapshot, forecast).products[0].estimatedRestock;
  assert.equal(estimate.state, "available");
  const before = JSON.stringify({ snapshot, forecast, estimate });
  const options = compareSupplierOrders(estimate, [
    { id: "a", name: "A", terms: { caseSize: 6, minimumOrder: 24, leadTimeDays: 2 } },
    { id: "b", name: "B", terms: { caseSize: 12, minimumOrder: 60, leadTimeDays: 28 } },
    { id: "missing", name: "Missing", terms: {} },
    { id: "invalid", name: "Invalid", terms: { caseSize: 0, minimumOrder: 0, leadTimeDays: 0 } },
  ], DATE);
  assert.equal(options[0].result.state === "available" ? options[0].result.quantity : undefined, 42);
  assert.equal(options[0].result.state === "available" ? options[0].result.arrivalDate : undefined, "2026-10-08");
  assert.equal(options[1].result.state === "available" ? options[1].result.quantity : undefined, 60);
  assert.equal(options[1].result.state === "available" ? options[1].result.beyondPlanningWindow : undefined, true);
  assert.equal(options[2].result.state, "unavailable"); assert.equal(options[3].result.state, "unavailable");
  assert.equal(JSON.stringify({ snapshot, forecast, estimate }), before);
});

test("shared result summary distinguishes no order, real zero, unavailable evidence and partial coverage", async () => {
  const { snapshot, forecast } = await check(eight());
  const inputs = { ...emptyProductPurchaseInputs(), plannedOrder: createPurchaseQuantity(0, "input by you") };
  const plan = buildPurchasePlanReview(snapshot, forecast, { inputsByProduct: { "ID|A": inputs } }).products[0];
  assert.equal(summarizePurchaseExcess([{ inputs: emptyProductPurchaseInputs() }]).state, "not_entered");
  assert.equal(summarizePurchaseExcess([{ inputs }]).state, "unavailable");
  const zero = summarizePurchaseExcess([{ inputs, plan }]);
  assert.equal(zero.state, "assessed"); if (zero.state === "assessed") assert.equal(zero.quantity, 0);
  const partial = summarizePurchaseExcess([{ inputs, plan }, { inputs }]);
  assert.equal(partial.state, "assessed");
  if (partial.state === "assessed") { assert.equal(partial.assessedCount, 1); assert.equal(partial.excludedCount, 1); }
});

test("US1.6 blocks ambiguous products while unaffected products retain forecasts and purchase recommendations", async () => {
  const bad = eight(); bad[7][3] = "Another tea";
  const { snapshot, forecast } = await check([...bad, ...eight("B")]);
  assert.equal(snapshot.reconciliation.rowsUsed, 8); assert.equal(snapshot.reconciliation.rowsExcluded, 8);
  assert.equal(forecast.products.find(item => item.productKey === "ID|A")?.labelReason?.code, "IDENTITY_CONFLICT");
  assert.equal(forecast.products.find(item => item.productKey === "ID|A")?.range, undefined);
  assert.equal(forecast.products.find(item => item.productKey === "ID|B")?.label, "Ready");
  const inputs = { ...emptyProductPurchaseInputs(), plannedOrder: createPurchaseQuantity(40, "input by you") };
  // The purchase boundary also refuses a stale or fabricated Ready forecast for a conflicted product.
  const forged = { ...forecast, products: forecast.products.map(item => item.productKey === "ID|A" ? { ...forecast.products.find(p => p.productKey === "ID|B")!, productKey: "ID|A" } : item) };
  const review = buildPurchasePlanReview(snapshot, forged, { inputsByProduct: { "ID|A": inputs, "ID|B": inputs } });
  assert.equal(review.products[0].estimatedRestock.state, "unavailable");
  assert.equal(review.products[0].audit.state, "cannot_judge"); assert.equal(review.products[1].audit.state, "verdict");
  assert.equal(estimatePurchaseCost(snapshot, "ID|A", 40).state, "unavailable");
});

test("US1.6 detects same-code names without a pack column and same-code packs without a name column", async () => {
  const records = [line("2026-08-10"), line("2026-08-17", "A", "2.50", "Other", "500 g")];
  for (const omitted of ["product_name", "pack_variant"] as const) {
    const { snapshot } = await check(records, mappingFor(fields.filter(field => field !== omitted)));
    assert.ok(snapshot.issues.some(issue => issue.issueCode === "PRODUCT_IDENTITY_CONFLICT"));
    assert.equal(snapshot.reconciliation.rowsUsed, 0);
  }
});

test("US1.6 blocks name-and-pack identities assigned different codes and separates distinct packs", async () => {
  const clash = await check([line("2026-08-10", "A"), line("2026-08-17", "B")], mappingFor(fields, "composite"));
  assert.equal(clash.snapshot.reconciliation.rowsUsed, 0);
  const separate = await check([line("2026-08-10", "A", "1", "Tea", "250 g"), line("2026-08-17", "B", "2", "Tea", "500 g")]);
  assert.equal(separate.snapshot.productCosts?.length, 2);
  assert.deepEqual(separate.snapshot.productCosts?.map(item => item.state === "usable" ? item.value : undefined), [1, 2]);
});

for (const [values, state] of [[['0','0'], 'usable'], [['2.50','2.5'], 'usable'], [['2.50',''], 'usable'], [['',''], 'missing'], [['2.5','-1'], 'invalid'], [['2.5','oops'], 'invalid'], [['2.5','3'], 'conflicting']] as const) {
  test(`US2.1 unit cost ${values.join("/")} is ${state} without discarding quantity evidence`, async () => {
    const rows = eight(); rows.forEach(row => row[7] = values[0]); rows[7][7] = values[1];
    const { snapshot, forecast } = await check(rows);
    assert.equal(snapshot.productCosts?.[0].state, state); assert.equal(snapshot.reconciliation.rowsUsed, 8); assert.equal(forecast.products[0].label, "Ready");
    const amount = estimatePurchaseCost(snapshot, "ID|A", 10);
    assert.equal(amount.state, state === "usable" ? "estimated" : "unavailable");
    if (amount.state === "estimated") assert.equal(amount.amount, Number(values[0]) * 10);
  });
}

test("US2.1 cost revalidation uses source and mapping provenance, preserves zero and keeps unentered orders distinct", async () => {
  const { dataset, mapping, snapshot } = await check(eight());
  assert.equal(estimatePurchaseCost(snapshot, "ID|A", undefined).state, "not_entered");
  const zero = estimatePurchaseCost(snapshot, "ID|A", 0); assert.equal(zero.state, "estimated"); if (zero.state === "estimated") assert.equal(zero.amount, 0);
  const remapped = setMapping(mapping, "unit_cost", "column-8", true);
  const nextKey = readinessEvidenceKey(dataset, remapped, { analysisDate: DATE });
  assert.equal(estimatePurchaseCost(snapshot, "ID|A", 10, nextKey).state, "unavailable");
  assert.notEqual(readinessEvidenceKey({ ...dataset, sourceSha256: "replacement" }, mapping, { analysisDate: DATE }), snapshot.evidenceKey);
  const rerun = await runReadinessCheck(dataset, remapped, { analysisDate: DATE });
  const amount = estimatePurchaseCost(rerun, "ID|A", 10); assert.equal(amount.state, "estimated"); if (amount.state === "estimated") assert.equal(amount.amount, 2.5);
  assert.equal(snapshot.productCosts?.[0].state === "usable" ? snapshot.productCosts[0].value : undefined, 2.5);
});

test("US1.5a missing optional stock and cost do not prevent a demand range", async () => {
  const { snapshot, forecast, mapping } = await check(eight(), mappingFor(["transaction_date", "product_code", "quantity_sold"]));
  assert.equal(forecast.products[0].label, "Ready");
  const [assessment] = buildProductAssessments(snapshot);
  assert.equal(assessment.history.state, "available"); assert.equal(assessment.demand.state, "available");
  assert.equal(assessment.purchase.state, "needs_information"); assert.equal(assessment.cost.state, "needs_information"); assert.notEqual(assessment.status, "missing");
  assert.notEqual(evaluateCapabilities(mapping).find(item => item.capability === "supplier_scenario")?.state, "locked");
});

test("US2.5 excludes only exact duplicates and retains distinct transaction details", async () => {
  const row = line("2026-08-10");
  const { snapshot } = await check([row, row, line("2026-08-10", "A", "2.50", "Tea", "250 g", "11")]);
  assert.equal(snapshot.reconciliation.rowsUsed, 2); assert.equal(snapshot.reconciliation.rowsExcluded, 1);
  assert.equal(snapshot.duplicateGroups[0].retainedSourceRow, 3); assert.equal(snapshot.duplicateGroups[0].excludedCopyCount, 1);
  assert.equal(buildProductTimelines(snapshot)[0].weeks[0].netQuantity, 21);
});

test("US3.6 explains missing and excluded weeks, keeps invalid-date rows unplaced, and refreshes after correction", async () => {
  const dates = previousCompleteWeekStarts(DATE);
  const { snapshot, forecast } = await check([line(dates[0]), line(dates[1], "A", "2.50", "Tea", "250 g", "invalid"), line("invalid-date")]);
  const evidence = forecast.products[0].historyEvidence!;
  assert.equal(evidence.usableWeekStarts.length, 1); assert.equal(evidence.additionalWeeksNeeded, 3);
  assert.equal(evidence.missingWeekStarts.length, 7); assert.deepEqual(evidence.excludedPeriods[0].sourceRows, [3]);
  assert.deepEqual(evidence.unplacedExcludedRows, [4]); assert.ok(evidence.correctiveAction.includes("3 more"));
  assert.equal(snapshot.reconciliation.rowsUsed, 1);
  const corrected = await check(dates.slice(0, 4).map(date => line(date)));
  assert.equal(corrected.forecast.products[0].label, "Limited"); assert.equal(corrected.forecast.products[0].historyEvidence?.additionalWeeksNeeded, 0);
});

test("US2.4 report includes source worksheet, fields, handling states and a no-problems summary", async () => {
  const { snapshot } = await check(eight());
  const clean = createCorrectionReport({ ...snapshot, worksheetName: "Sales" });
  assert.ok(clean.csvText.includes("No problems found")); assert.ok(clean.csvText.includes('"Worksheet"')); assert.ok(clean.csvText.includes('"Sales"')); assert.ok(clean.csvText.includes('"Field"'));
  const { snapshot: duplicate } = await check([line("2026-08-10"), line("2026-08-10")]);
  const report = createCorrectionReport({ ...duplicate, sourceMode: "sample" });
  assert.ok(report.csvText.split("\n").slice(0, 5).join("\n").includes("Sample data"));
  assert.ok(report.csvText.includes('"Handled"')); assert.ok(report.csvText.includes('"Left out"'));
});

test("US1.3 CSV supports UTF-8 BOM, quotes, semicolon and tab; header-only files are rejected", async () => {
  for (const delimiter of [",", ";", "\t"]) {
    const dataset = await parseCsvBytes(new TextEncoder().encode(`\ufeffDate${delimiter}SKU${delimiter}Quantity\r\n2026-08-10${delimiter}"茶, kopi"${delimiter}2`), { sourceMode: "user", sourceName: "sales.csv" });
    assert.equal(dataset.delimiter, delimiter); assert.equal(dataset.rows[0].normalizedValues[1], "茶, kopi");
  }
  await assert.rejects(parseCsvBytes(new TextEncoder().encode(headers), { sourceMode: "user", sourceName: "empty.csv" }), /No records found/);
});

test("US1.3 worksheet metadata preserves noncontiguous original rows", async () => {
  const dataset = await parseCsvBytes(new TextEncoder().encode([headers, line("2026-08-10").join(","), line("2026-08-17").join(",")].join("\n")), {
    sourceMode: "user", sourceName: "sales.xlsx", mimeType: "text/csv;converted-from=excel",
    sourceMetadata: { worksheetName: "Selected", headerRow: 3, sourceRowNumbers: [4, 7], originalSha256: "original-workbook", originalByteLength: 100 },
  });
  assert.deepEqual(dataset.rows.map(row => row.sourceRow), [4, 7]); assert.equal(dataset.headerRow, 3); assert.equal(dataset.sourceSha256, "original-workbook");
});

test("US2.3 stock boundaries and US3.1 calculation are independent of host timezone", async () => {
  for (const days of [0,6,7,8,13,14,15]) assert.equal(evaluateStockFreshness(addCalendarDays(DATE, -days), DATE).state, days <= 7 ? "current" : days <= 14 ? "limited" : "unusable");
  assert.equal(evaluateStockFreshness(addCalendarDays(DATE, 1), DATE).reasonCode, "FUTURE_STOCK_DATE");
  const original = process.env.TZ;
  try {
    let expected: string | undefined;
    for (const zone of ["Asia/Kuala_Lumpur", "UTC", "America/Los_Angeles"]) {
      process.env.TZ = zone; const { forecast } = await check(eight()); const answer = JSON.stringify(forecast.products);
      if (expected) assert.equal(answer, expected); expected = answer;
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
