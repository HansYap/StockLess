import assert from "node:assert/strict";
import test from "node:test";

import type { MappingState, ParsedDataset } from "../src/contracts.ts";
import { runReadinessCheck } from "../src/readiness.ts";

const headers = [
  "Sale Date",
  "SKU",
  "Quantity Sold",
  "Stock on Hand",
  "Stock Count Date",
  "Planned Order",
  "Incoming Stock",
  "Expiry Date",
] as const;

function dataset(rows: readonly (readonly string[])[]): ParsedDataset {
  return {
    sourceMode: "user",
    sourceName: "purchase-inputs.csv",
    sourceByteLength: 100,
    sourceSha256: "purchase-inputs-hash",
    delimiter: ",",
    columns: headers.map((header, index) => ({
      id: `column-${index}`,
      index,
      header,
      normalizedHeader: header.toLowerCase(),
      previewValues: rows.map((row) => row[index] ?? "").slice(0, 5),
    })),
    rows: rows.map((values, index) => ({
      sourceRow: index + 2,
      originalValues: values,
      normalizedValues: values,
    })),
    normalizations: [],
  };
}

const mapping: MappingState = {
  mappings: {
    transaction_date: { targetField: "transaction_date", sourceColumnId: "column-0", confirmed: true },
    product_code: { targetField: "product_code", sourceColumnId: "column-1", confirmed: true },
    quantity_sold: { targetField: "quantity_sold", sourceColumnId: "column-2", confirmed: true },
    current_stock: { targetField: "current_stock", sourceColumnId: "column-3", confirmed: true },
    stock_as_of_date: { targetField: "stock_as_of_date", sourceColumnId: "column-4", confirmed: true },
    planned_order_quantity: { targetField: "planned_order_quantity", sourceColumnId: "column-5", confirmed: true },
    incoming_stock_quantity: { targetField: "incoming_stock_quantity", sourceColumnId: "column-6", confirmed: true },
    expiry_date: { targetField: "expiry_date", sourceColumnId: "column-7", confirmed: true },
  },
  identityMode: "stable",
  identityConfirmed: true,
};

test("readiness carries validated mapped Epic 5 defaults and all expiry dates", async () => {
  const snapshot = await runReadinessCheck(dataset([
    ["2026-07-20", "A", "5", "10.5", "2026-09-10", "20", "2", "2026-09-20"],
    ["2026-07-27", "A", "6", "10.5", "2026-09-10", "20", "2", "2026-10-20"],
  ]), mapping, { analysisDate: "2026-09-14" });

  assert.equal(snapshot.purchaseFileEvidence?.plannedOrderColumnConfirmed, true);
  assert.equal(snapshot.purchaseFileEvidence?.incomingStockColumnConfirmed, true);
  assert.equal(snapshot.purchaseFileEvidence?.expiryDateColumnConfirmed, true);
  assert.deepEqual(snapshot.purchaseFileEvidence?.products, [{
    productKey: "ID|A",
    plannedOrderQuantity: 20,
    incomingStockQuantity: 2,
    expiryDates: ["2026-09-20", "2026-10-20"],
    reasonCodes: [],
  }]);
  assert.equal(snapshot.rows[0].interpretedValues.plannedOrderQuantity, 20);
  assert.equal(snapshot.rows[0].interpretedValues.incomingStockQuantity, 2);
  assert.equal(snapshot.rows[0].interpretedValues.expiryDate, "2026-09-20");
});

test("conflicting or invalid optional file values are reported and not silently prefilled", async () => {
  const snapshot = await runReadinessCheck(dataset([
    ["2026-07-20", "A", "5", "10", "2026-09-10", "20", "1.5", "not-a-date"],
    ["2026-07-27", "A", "6", "10", "2026-09-10", "21", "", "2026-09-20"],
  ]), mapping, { analysisDate: "2026-09-14" });

  const product = snapshot.purchaseFileEvidence?.products[0];
  assert.equal(product?.plannedOrderQuantity, undefined);
  assert.equal(product?.incomingStockQuantity, undefined);
  assert.deepEqual(product?.expiryDates, ["2026-09-20"]);
  assert.deepEqual(product?.reasonCodes, ["CONFLICTING_PLANNED_ORDER"]);
  assert.ok(snapshot.issues.some((issue) => issue.issueCode === "CONFLICTING_PLANNED_ORDER"));
  assert.ok(snapshot.issues.some((issue) => issue.issueCode === "INVALID_INCOMING_STOCK"));
  assert.ok(snapshot.issues.some((issue) => issue.issueCode === "INVALID_EXPIRY_DATE"));
});

test("a confirmed non-ISO expiry format is normalized before Epic 5 uses it", async () => {
  const snapshot = await runReadinessCheck(dataset([
    ["2026-07-20", "A", "5", "10", "2026-09-10", "", "", "20/09/2026"],
  ]), mapping, {
    analysisDate: "2026-09-14",
    dateConfirmations: [{
      sourceColumnId: "column-7",
      format: "DD/MM/YYYY",
      confirmationId: "expiry-format-confirmed",
    }],
  });

  assert.deepEqual(snapshot.purchaseFileEvidence?.products[0].expiryDates, ["2026-09-20"]);
  assert.ok(snapshot.normalizations.some((event) =>
    event.sourceColumn === "Expiry Date" && event.resultingValue === "2026-09-20"));
});
