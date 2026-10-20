import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import {
  buildDemandForecastReview, buildEnvironmentalImpact, buildImpactReview, confirmIdentityMode, createMappingState, parseCsvBytes,
  runReadinessCheck, setMapping, evaluateProductPurchasePlan,
} from "../src/engine.ts";
import { rebaseSampleCsvDates } from "../src/screens/UploadScreen.tsx";
import { automaticPurchaseDrafts } from "../src/purchase-plan/suggested-orders.ts";
import { joinPurchaseEvidence } from "../src/purchase-plan/model.ts";

const sample = readFileSync(path.resolve(process.cwd(), "public/samples/sample_with_issues.csv"), "utf8");

it.each([
  "2026-10-09", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14",
  "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18",
  "2027-01-01", "2028-02-29",
])("keeps complete sample weeks and stock dates usable on %s", async analysisDate => {
  const csv = rebaseSampleCsvDates(sample, analysisDate);
  const dataset = await parseCsvBytes(new TextEncoder().encode(csv), {
    sourceMode: "sample", sourceName: "sample_with_issues.csv", mimeType: "text/csv",
  });
  let mapping = createMappingState();
  for (const [index, field] of ([
    "transaction_date", "product_code", "product_name", "pack_variant", "quantity_sold",
    "transaction_reference", "current_stock", "stock_as_of_date", "planned_order_quantity",
    "incoming_stock_quantity", "expiry_date", "unit_cost", "unit_weight_kg",
  ] as const).entries()) mapping = setMapping(mapping, field, `column-${index}`, true);
  mapping = confirmIdentityMode(mapping, "stable");
  const snapshot = await runReadinessCheck(dataset, mapping, { analysisDate });
  const forecast = buildDemandForecastReview(snapshot);
  const impact = buildImpactReview(snapshot, forecast);
  const environmental = buildEnvironmentalImpact(snapshot, impact);

  for (const code of ["MM0001", "MM0002", "MM0003", "MM0004", "MM0007", "MM0009", "MM0010", "MM0012"]) {
    const product = forecast.products.find(item => item.productKey === `ID|${code}`);
    expect(product?.recordedWeeksInLast8).toBe(8);
    expect(product?.range).toBeDefined();
  }
  expect(forecast.products.find(item => item.productKey === "ID|MM0005")?.recordedWeeksInLast8).toBe(5);
  expect(forecast.products.find(item => item.productKey === "ID|MM0006")?.recordedWeeksInLast8).toBe(2);
  expect(forecast.products.find(item => item.productKey === "ID|MM0006")?.label).toBe("Cannot assess");
  expect(impact.assessedCount).toBe(22);
  expect(impact.products.find(item => item.productKey === "ID|MM0002")?.excessUnits).toBeGreaterThan(0);
  expect(environmental.potential.includedProductCount).toBeGreaterThan(0);
  expect(environmental.potential.kgCO2e).toBeDefined();
  expect(snapshot.productStock.find(item => item.productKey === "ID|MM0008")?.freshness.reasonCode).toBe("STALE_STOCK");
  expect(snapshot.productStock.find(item => item.productKey === "ID|MM0025")?.freshness.reasonCode).toBe("FUTURE_STOCK_DATE");
  const sampleDate = (reference: string) => csv.split(/\r?\n/).find(row => row.includes(reference))?.split(",")[0];
  expect(sampleDate("SMP-TODAY-001")).toBe(analysisDate);
  expect(sampleDate("SMP-FUT-001")! > analysisDate).toBe(true);
  expect(csv).toContain("2026-13-45"); // The intentionally invalid sample row remains invalid.
});

it("reports the current sample's positive-excess CO₂e coverage without counting zero-excess products", async () => {
  const analysisDate = "2026-10-19";
  const dataset = await parseCsvBytes(new TextEncoder().encode(rebaseSampleCsvDates(sample, analysisDate)), {
    sourceMode: "sample", sourceName: "sample_with_issues.csv", mimeType: "text/csv",
  });
  let mapping = createMappingState();
  for (const [index, field] of ([
    "transaction_date", "product_code", "product_name", "pack_variant", "quantity_sold",
    "transaction_reference", "current_stock", "stock_as_of_date", "planned_order_quantity",
    "incoming_stock_quantity", "expiry_date", "unit_cost", "unit_weight_kg",
  ] as const).entries()) mapping = setMapping(mapping, field, `column-${index}`, true);
  const snapshot = await runReadinessCheck(dataset, confirmIdentityMode(mapping, "stable"), { analysisDate });
  const forecast = buildDemandForecastReview(snapshot);
  const products = joinPurchaseEvidence(snapshot, forecast);
  const drafts = automaticPurchaseDrafts(products, {}, {}, analysisDate, evaluateProductPurchasePlan).drafts;
  const impact = buildImpactReview(snapshot, forecast, drafts);
  const environmental = buildEnvironmentalImpact(snapshot, impact);
  const coverage = environmental.potential.potentialCoverage!;
  expect(environmental.potential.totalProductCount).toBe(42);
  expect(coverage.unassessedCount).toBe(19);
  expect(coverage.zeroExcessCount).toBe(10);
  expect(coverage.positiveExcessCount).toBe(13);
  expect(coverage.estimatedPositiveCount).toBe(8);
  expect(coverage.state).toBe("partial");
  expect(environmental.potential.includedProductCount).toBe(8);
  expect(environmental.potential.kgCO2e).toBeGreaterThan(0);
  const milo = coverage.blockedPositive.find(row => row.productName?.includes("Milo 3in1"));
  expect(milo?.quantity).toBe(15);
  expect(milo?.state).toBe("unavailable");
});
