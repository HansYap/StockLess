import assert from "node:assert/strict";
import { test } from "node:test";
import { addCalendarDays, confirmIdentityMode, createCorrectionReport, createMappingState, parseCsvBytes, READINESS_POLICY_VERSION, runReadinessCheck, setMapping } from "../src/index.ts";

async function check(records: readonly (readonly string[])[]) {
  const csv = ["Date,SKU,Quantity,Name,Stock,Stock date,Pack", ...records.map(row => row.join(","))].join("\n");
  const dataset = await parseCsvBytes(new TextEncoder().encode(csv), { sourceMode: "user", sourceName: "sales.csv" });
  let mapping = createMappingState();
  const fields = ["transaction_date", "product_code", "quantity_sold", "product_name", "current_stock", "stock_as_of_date", "pack_variant"] as const;
  fields.forEach((field, index) => { mapping = setMapping(mapping, field, "column-" + index, true); });
  mapping = confirmIdentityMode(mapping, "stable");
  const before = JSON.stringify(dataset);
  const snapshot = await runReadinessCheck(dataset, mapping, { analysisDate: "2026-09-15" });
  assert.equal(JSON.stringify(dataset), before, "source evidence is unchanged");
  return snapshot;
}
const row = (date: string, quantity = "5", stock = "12", stockDate = "2026-09-10") => [date, "0007", quantity, "Kopi O", stock, stockDate, "250 g"];

test("latest valid dated stock count replaces historical snapshots without summing stock", async () => {
  const result = await check([row("2026-08-01", "5", "25", "2026-08-01"), row("2026-09-01")]);
  assert.equal(result.productStock[0].currentStock, 12);
  assert.equal(result.productStock[0].stockAsOfDate, "2026-09-10");
  assert.equal(result.productStock[0].usableForCover, true);
  assert.equal(result.policyVersion, READINESS_POLICY_VERSION);
  assert.ok(!result.issues.some(issue => issue.issueCode === "CONFLICTING_CURRENT_STOCK"));
});
test("conflicting counts on the newest date remain unusable", async () => {
  const result = await check([row("2026-08-01", "5", "25"), row("2026-09-01")]);
  assert.equal(result.productStock[0].currentStock, undefined);
  assert.equal(result.productStock[0].usableForCover, false);
  assert.ok(result.issues.some(issue => issue.issueCode === "CONFLICTING_CURRENT_STOCK"));
});
test("future-dated stock is flagged and cannot replace a valid count", async () => {
  const result = await check([row("2026-08-01"), row("2026-09-01", "5", "40", "2026-09-21")]);
  assert.equal(result.productStock[0].currentStock, 12);
  assert.ok(result.issues.some(issue => issue.issueCode === "FUTURE_STOCK_DATE"));
});
test("large-sale advisories preserve every usable sale and require enough history", async () => {
  const records = Array.from({ length: 8 }, (_, i) => row(addCalendarDays("2026-07-20", i * 7), i === 7 ? "2300" : "5"));
  const result = await check(records);
  assert.equal(result.issues.filter(issue => issue.issueCode === "UNUSUAL_SALE").length, 1);
  assert.equal(result.reconciliation.rowsUsed, 8);
  assert.equal(result.rows.at(-1)?.interpretedValues.quantitySold, 2300);
  const sparse = await check([row("2026-08-01"), row("2026-09-01", "2300")]);
  assert.ok(!sparse.issues.some(issue => issue.issueCode === "UNUSUAL_SALE"));
});
test("different names and packs produce identity warnings while preserving codes", async () => {
  const second = row("2026-09-01"); second[3] = "Kopi Kaw"; second[6] = "500 g";
  const result = await check([row("2026-08-01"), second]);
  assert.ok(result.issues.some(issue => issue.issueCode === "PRODUCT_IDENTITY_CONFLICT"));
  assert.deepEqual(result.rows.map(row => row.interpretedValues.productCode), ["0007", "0007"]);
  assert.equal(result.reconciliation.rowsUsed, 2);
});
test("full evidence download retains safe tidy-ups and their original values", async () => {
  const input = row("2026-09-01"); input[1] = " 0007 ";
  const result = await check([input]);
  const report = createCorrectionReport(result);
  assert.ok(report.csvText.includes("Safe tidy-up: Trim whitespace"));
  assert.ok(report.csvText.includes(" 0007 "));
  assert.ok(report.csvText.includes("→"));
  assert.equal(result.rows[0].interpretedValues.productCode, "0007");
});
