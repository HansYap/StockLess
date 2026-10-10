import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import {
  buildDemandForecastReview, confirmIdentityMode, createMappingState, parseCsvBytes,
  runReadinessCheck, setMapping,
} from "../src/engine.ts";
import { rebaseSampleCsvDates } from "../src/screens/UploadScreen.tsx";

const sample = readFileSync(path.resolve(process.cwd(), "public/samples/sample_with_issues.csv"), "utf8");

it.each(["2026-10-09", "2027-01-01", "2028-02-29"])("keeps core sample forecasts usable on %s", async analysisDate => {
  const csv = rebaseSampleCsvDates(sample, analysisDate);
  const dataset = await parseCsvBytes(new TextEncoder().encode(csv), {
    sourceMode: "sample", sourceName: "sample_with_issues.csv", mimeType: "text/csv",
  });
  let mapping = createMappingState();
  for (const [index, field] of ([
    "transaction_date", "product_code", "product_name", "pack_variant", "quantity_sold",
    "transaction_reference", "current_stock", "stock_as_of_date", "planned_order_quantity",
    "incoming_stock_quantity", "expiry_date",
  ] as const).entries()) mapping = setMapping(mapping, field, `column-${index}`, true);
  mapping = confirmIdentityMode(mapping, "stable");
  const snapshot = await runReadinessCheck(dataset, mapping, { analysisDate });
  const forecast = buildDemandForecastReview(snapshot);

  for (const code of ["MM0001", "MM0002", "MM0003", "MM0004"]) {
    const product = forecast.products.find(item => item.productKey === `ID|${code}`);
    expect(product?.recordedWeeksInLast8).toBe(8);
    expect(product?.range).toBeDefined();
  }
  expect(forecast.products.find(item => item.productKey === "ID|MM0006")?.label).toBe("Cannot assess");
  expect(csv).toContain("2026-13-45"); // The intentionally invalid sample row remains invalid.
});
