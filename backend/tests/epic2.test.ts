import test from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarDays,
  buildProductTimelines,
  confirmIdentityMode,
  createCorrectionReport,
  createMappingState,
  detectDateFormatCandidate,
  evaluateStockFreshness,
  parseCsvBytes,
  runReadinessCheck,
  safeSpreadsheetCell,
  setMapping,
} from "../src/index.ts";
import type {
  CanonicalField,
  MappingState,
  ParsedDataset,
} from "../src/index.ts";

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

/** Parses a small synthetic retailer CSV through the production import path. */
async function datasetFrom(csv: string, sourceName = "retailer.csv"): Promise<ParsedDataset> {
  return parseCsvBytes(encode(csv), {
    sourceMode: "user",
    sourceName,
    mimeType: "text/csv",
  });
}

/** Creates confirmed field mappings by matching test headers exactly. */
function confirmedMapping(
  dataset: ParsedDataset,
  fields: readonly CanonicalField[],
  identityMode: "stable" | "composite" = "stable",
): MappingState {
  let mapping = createMappingState();
  for (const field of fields) {
    const column = dataset.columns.find((candidate) => candidate.normalizedHeader === field);
    if (!column) throw new Error(`Test fixture is missing ${field}.`);
    mapping = setMapping(mapping, field, column.id, true);
  }
  return confirmIdentityMode(mapping, identityMode);
}

test("E2.US2.1.AC1-AC3 and AC5: strict validation preserves values and reconciles every row", async () => {
  const dataset = await datasetFrom(
    "transaction_date,product_code,quantity_sold,current_stock,stock_as_of_date\n"
      + "2026-08-03, 001 ,2,10,2026-08-20\n"
      + "31/02/2026,002,3,,\n"
      + "2026-08-04,003,three,,\n"
      + "2026-08-05,,4,,",
  );
  const mapping = confirmedMapping(dataset, [
    "transaction_date",
    "product_code",
    "quantity_sold",
    "current_stock",
    "stock_as_of_date",
  ]);
  const snapshot = await runReadinessCheck(dataset, mapping, { analysisDate: "2026-08-26" });

  assert.deepEqual(snapshot.reconciliation, {
    rowsIn: 4,
    rowsUsed: 1,
    rowsExcluded: 3,
    rowsSafelyNormalized: 1,
  });
  assert.equal(snapshot.rows[0].originalValues[1], " 001 ");
  assert.equal(snapshot.rows[0].normalizedValues[1], "001");
  assert.equal(snapshot.rows[0].interpretedValues.productCode, "001");
  assert.equal(snapshot.rows[0].interpretedValues.quantitySold, 2);
  assert.deepEqual(
    snapshot.issues.filter((issue) => ["INVALID_DATE", "INVALID_QUANTITY", "MISSING_IDENTITY"].includes(issue.issueCode))
      .map((issue) => [issue.issueCode, issue.sourceRow]),
    [["INVALID_DATE", 3], ["INVALID_QUANTITY", 4], ["MISSING_IDENTITY", 5]],
  );
  assert.ok(snapshot.normalizations.some((event) =>
    event.sourceRow === 2
      && event.normalizationType === "trim_whitespace"
      && event.originalValue === " 001 "
      && event.resultingValue === "001"));
});

test("E2.US2.1.AC2 and AC5: non-ISO dates convert only after column confirmation", async () => {
  const dataset = await datasetFrom(
    "transaction_date,product_code,quantity_sold\n"
      + "13/08/2026,001,2\n"
      + "14/08/2026,001,3",
  );
  const mapping = confirmedMapping(dataset, ["transaction_date", "product_code", "quantity_sold"]);
  const dateColumn = dataset.columns[0];
  assert.deepEqual(detectDateFormatCandidate(dataset, dateColumn.id), {
    sourceColumnId: dateColumn.id,
    state: "candidate",
    candidates: ["DD/MM/YYYY"],
  });

  const unconfirmed = await runReadinessCheck(dataset, mapping, { analysisDate: "2026-08-26" });
  assert.equal(unconfirmed.reconciliation.rowsUsed, 0);
  assert.equal(unconfirmed.issues.filter((issue) => issue.issueCode === "DATE_FORMAT_CONFIRMATION_REQUIRED").length, 2);

  const confirmed = await runReadinessCheck(dataset, mapping, {
    analysisDate: "2026-08-26",
    dateConfirmations: [{
      sourceColumnId: dateColumn.id,
      format: "DD/MM/YYYY",
      confirmationId: "date-confirmation-1",
    }],
  });
  assert.equal(confirmed.reconciliation.rowsUsed, 2);
  assert.deepEqual(confirmed.rows.map((row) => row.interpretedValues.transactionDate), ["2026-08-13", "2026-08-14"]);
  assert.equal(confirmed.normalizations.filter((event) => event.normalizationType === "confirmed_date_format").length, 2);
  assert.ok(confirmed.normalizations.every((event) =>
    event.normalizationType !== "confirmed_date_format" || event.confirmationId === "date-confirmation-1"));

  const ambiguousDataset = await datasetFrom(
    "transaction_date,product_code,quantity_sold\n"
      + "03/08/2026,001,2\n"
      + "04/08/2026,001,3",
  );
  assert.deepEqual(detectDateFormatCandidate(ambiguousDataset, ambiguousDataset.columns[0].id), {
    sourceColumnId: ambiguousDataset.columns[0].id,
    state: "ambiguous",
    candidates: ["DD/MM/YYYY", "MM/DD/YYYY"],
  });
});

test("E2.US2.1.AC4: duplicate candidates remain used until an explicit decision", async () => {
  const dataset = await datasetFrom(
    "transaction_date,product_code,quantity_sold\n"
      + "2026-08-03,001,2\n"
      + "2026-08-03,001,2",
  );
  const mapping = confirmedMapping(dataset, ["transaction_date", "product_code", "quantity_sold"]);
  const unresolved = await runReadinessCheck(dataset, mapping, { analysisDate: "2026-08-26" });
  const fingerprint = unresolved.duplicateGroups[0].fingerprint;
  assert.equal(unresolved.reconciliation.rowsUsed, 2);
  assert.equal(unresolved.duplicateGroups[0].decision, "unresolved");
  assert.equal(unresolved.productLimitations[0].code, "DUPLICATE_UNRESOLVED");

  const kept = await runReadinessCheck(dataset, mapping, {
    analysisDate: "2026-08-26",
    duplicateDecisions: { [fingerprint]: "keep_both" },
  });
  assert.equal(kept.reconciliation.rowsUsed, 2);
  assert.equal(kept.productLimitations.length, 0);

  const deduplicated = await runReadinessCheck(dataset, mapping, {
    analysisDate: "2026-08-26",
    duplicateDecisions: { [fingerprint]: "treat_as_duplicate" },
  });
  assert.deepEqual(deduplicated.rows.map((row) => [row.sourceRow, row.useState]), [[2, "used"], [3, "excluded"]]);
  assert.equal(deduplicated.reconciliation.rowsExcluded, 1);
  assert.ok(deduplicated.issues.some((issue) => issue.sourceRow === 3 && issue.issueCode === "DUPLICATE_CONFIRMED"));
});

test("E2.US2.1.AC1 and E2.US2.3.AC3: optional stock problems do not discard valid demand", async () => {
  const dataset = await datasetFrom(
    "transaction_date,product_code,quantity_sold,current_stock,stock_as_of_date\n"
      + "2026-08-03,001,2,-5,2026-08-27",
  );
  const mapping = confirmedMapping(dataset, [
    "transaction_date",
    "product_code",
    "quantity_sold",
    "current_stock",
    "stock_as_of_date",
  ]);
  const snapshot = await runReadinessCheck(dataset, mapping, { analysisDate: "2026-08-26" });
  assert.equal(snapshot.rows[0].useState, "used");
  assert.ok(snapshot.issues.some((issue) => issue.issueCode === "INVALID_CURRENT_STOCK"));
  assert.ok(snapshot.issues.some((issue) => issue.issueCode === "FUTURE_STOCK_DATE"));
  assert.equal(snapshot.productStock[0].freshness.state, "unusable");
  assert.equal(snapshot.productStock[0].usableForCover, false);

  const conflictDataset = await datasetFrom(
    "transaction_date,product_code,quantity_sold,current_stock,stock_as_of_date\n"
      + "2026-08-03,001,2,10,2026-08-20\n"
      + "2026-08-04,001,3,11,2026-08-20",
  );
  const conflictMapping = confirmedMapping(conflictDataset, [
    "transaction_date", "product_code", "quantity_sold", "current_stock", "stock_as_of_date",
  ]);
  const conflict = await runReadinessCheck(conflictDataset, conflictMapping, { analysisDate: "2026-08-26" });
  assert.equal(conflict.reconciliation.rowsUsed, 2);
  assert.equal(conflict.productStock[0].usableForCover, false);
  assert.equal(conflict.issues.filter((issue) => issue.issueCode === "CONFLICTING_CURRENT_STOCK").length, 2);
});

test("E2.US2.2.AC1-AC3: missing, zero, net-zero activity, and demand weeks stay distinct", async () => {
  const dataset = await datasetFrom(
    "transaction_date,product_code,quantity_sold\n"
      + "2026-06-01,001,0\n"
      + "2026-06-15,001,5\n"
      + "2026-06-16,001,-5\n"
      + "2026-06-22,001,2",
  );
  const mapping = confirmedMapping(dataset, ["transaction_date", "product_code", "quantity_sold"]);
  const snapshot = await runReadinessCheck(dataset, mapping, { analysisDate: "2026-07-01" });
  const timeline = buildProductTimelines(snapshot)[0];

  assert.deepEqual(timeline.weeks.map((week) => week.state), [
    "confirmed_zero_sales",
    "missing",
    "net_zero_with_activity",
    "observed_demand",
  ]);
  assert.equal(timeline.weeks[1].netQuantity, null);
  assert.equal(timeline.weeks[2].positiveQuantity, 5);
  assert.equal(timeline.weeks[2].negativeQuantity, -5);
  assert.equal(timeline.weeks[2].netQuantity, 0);
  assert.deepEqual(timeline.summary, {
    productKey: "ID|001",
    firstWeek: "2026-06-01",
    lastWeek: "2026-06-22",
    dateRangeStart: "2026-06-01",
    dateRangeEnd: "2026-06-28",
    observedWeekCount: 3,
    weeksInSpan: 4,
    missingWeekCount: 1,
  });
});

test("E2.US2.2.AC4: a gap inside the recent observed window makes it Limited", async () => {
  const observedStarts = [
    "2026-03-02", "2026-03-09", "2026-03-16", "2026-03-30",
    "2026-04-06", "2026-04-13", "2026-04-20", "2026-04-27",
  ];
  const csv = "transaction_date,product_code,quantity_sold\n"
    + observedStarts.map((date) => `${date},001,1`).join("\n");
  const dataset = await datasetFrom(csv);
  const mapping = confirmedMapping(dataset, ["transaction_date", "product_code", "quantity_sold"]);
  const snapshot = await runReadinessCheck(dataset, mapping, { analysisDate: "2026-05-11" });
  const recent = buildProductTimelines(snapshot)[0].recentWindow;

  assert.equal(recent.observedWeekCount, 8);
  assert.equal(recent.state, "limited");
  assert.deepEqual(recent.reasonCodes, ["MISSING_WEEK_IN_RECENT_SPAN"]);
});

test("E2.US2.3.AC1-AC2: stock freshness covers every required boundary", () => {
  const analysisDate = "2026-08-26";
  const cases = [
    { age: 0, state: "current" },
    { age: 6, state: "current" },
    { age: 7, state: "current" },
    { age: 8, state: "limited" },
    { age: 13, state: "limited" },
    { age: 14, state: "limited" },
    { age: 15, state: "unusable" },
    { age: -1, state: "unusable" },
  ] as const;

  for (const expected of cases) {
    const snapshotDate = addCalendarDays(analysisDate, -expected.age);
    const result = evaluateStockFreshness(snapshotDate, analysisDate);
    assert.equal(result.ageDays, expected.age);
    assert.equal(result.state, expected.state);
  }
  assert.equal(evaluateStockFreshness(undefined, analysisDate).reasonCode, "MISSING_STOCK_DATE");
});

test("E2.US2.3.AC4: correcting the stock date recomputes freshness without an override", async () => {
  const staleDataset = await datasetFrom(
    "transaction_date,product_code,quantity_sold,current_stock,stock_as_of_date\n"
      + "2026-08-03,001,2,10,2026-08-10",
  );
  const correctedDataset = await datasetFrom(
    "transaction_date,product_code,quantity_sold,current_stock,stock_as_of_date\n"
      + "2026-08-03,001,2,10,2026-08-25",
  );
  const staleMapping = confirmedMapping(staleDataset, [
    "transaction_date", "product_code", "quantity_sold", "current_stock", "stock_as_of_date",
  ]);
  const correctedMapping = confirmedMapping(correctedDataset, [
    "transaction_date", "product_code", "quantity_sold", "current_stock", "stock_as_of_date",
  ]);

  const stale = await runReadinessCheck(staleDataset, staleMapping, { analysisDate: "2026-08-26" });
  const corrected = await runReadinessCheck(correctedDataset, correctedMapping, { analysisDate: "2026-08-26" });
  assert.equal(stale.productStock[0].freshness.state, "unusable");
  assert.equal(corrected.productStock[0].freshness.state, "current");
  assert.equal(corrected.productStock[0].usableForCover, true);
});

test("E2.US2.4.AC1-AC3: export uses the same immutable issues and reconciliation snapshot", async () => {
  const dataset = await datasetFrom(
    "transaction_date,product_code,product_name,quantity_sold\n"
      + "bad,,叁巴,+cmd",
    "retailer-issues.csv",
  );
  const mapping = confirmedMapping(dataset, [
    "transaction_date", "product_code", "product_name", "quantity_sold",
  ]);
  const snapshot = await runReadinessCheck(dataset, mapping, { analysisDate: "2026-08-26" });
  const before = JSON.stringify(snapshot);
  const report = createCorrectionReport(snapshot);

  assert.deepEqual(report.metadata, {
    snapshotId: snapshot.id,
    issueTotal: snapshot.issues.length,
    rowsIn: snapshot.reconciliation.rowsIn,
    rowsUsed: snapshot.reconciliation.rowsUsed,
    rowsExcluded: snapshot.reconciliation.rowsExcluded,
    rowsSafelyNormalized: snapshot.reconciliation.rowsSafelyNormalized,
  });
  assert.match(report.csvText, /"INVALID_DATE"/);
  assert.match(report.csvText, /"INVALID_QUANTITY"/);
  assert.match(report.csvText, /"MISSING_IDENTITY"/);
  assert.match(report.csvText, /"excluded"/);
  assert.equal(JSON.stringify(snapshot), before);
});

test("E2.US2.4.AC4: UTF-8 survives export and every formula control prefix is neutralized", async () => {
  for (const value of ["=x", "+x", "-5", "@x", "\tx", "\rx", "\nx"]) {
    assert.equal(safeSpreadsheetCell(value), `'${value}`);
  }
  assert.equal(safeSpreadsheetCell("ordinary"), "ordinary");

  const dataset = await datasetFrom(
    "transaction_date,product_code,product_name,quantity_sold\n"
      + "bad,,Sambal 鱼,+cmd",
    "@retailer.csv",
  );
  const mapping = confirmedMapping(dataset, [
    "transaction_date", "product_code", "product_name", "quantity_sold",
  ]);
  const snapshot = await runReadinessCheck(dataset, mapping, { analysisDate: "2026-08-26" });
  const report = createCorrectionReport(snapshot);
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(report.utf8Bytes);

  assert.equal(decoded, report.csvText);
  assert.match(decoded, /Sambal 鱼/);
  assert.match(decoded, /"'@retailer\.csv"/);
  assert.match(decoded, /"'\+cmd"/);
});
