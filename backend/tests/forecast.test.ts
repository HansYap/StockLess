import assert from "node:assert/strict";
import test from "node:test";

import type { ProductTimeline, ReadinessSnapshot, WeeklyEvidence } from "../src/contracts.ts";
import { addCalendarDays } from "../src/dates.ts";
import { buildDemandForecastReview, estimateProductDemand } from "../src/forecast.ts";

const FIRST_WEEK = "2026-06-15";

function buildTimeline(values: readonly (number | null)[]): ProductTimeline {
  const weeks: WeeklyEvidence[] = values.map((value, index) => {
    const weekStart = addCalendarDays(FIRST_WEEK, index * 7);
    return Object.freeze({
      productKey: "TEST001",
      weekStart,
      weekEnd: addCalendarDays(weekStart, 6),
      positiveQuantity: value,
      negativeQuantity: value === null ? null : 0,
      netQuantity: value,
      recordCount: value === null ? 0 : 1,
      state: value === null ? "missing" as const : value === 0 ? "confirmed_zero_sales" as const : "observed_demand" as const,
      sourceRows: Object.freeze(value === null ? [] : [index + 2]),
    });
  });
  const observed = weeks.filter((week) => week.state !== "missing");
  return Object.freeze({
    productKey: "TEST001",
    weeks: Object.freeze(weeks),
    summary: Object.freeze({
      productKey: "TEST001",
      firstWeek: weeks[0].weekStart,
      lastWeek: weeks[weeks.length - 1].weekStart,
      dateRangeStart: weeks[0].weekStart,
      dateRangeEnd: weeks[weeks.length - 1].weekEnd,
      observedWeekCount: observed.length,
      weeksInSpan: weeks.length,
      missingWeekCount: weeks.length - observed.length,
    }),
    recentWindow: Object.freeze({
      selectedWeekStarts: Object.freeze([]),
      observedWeekCount: 0,
      state: "unavailable" as const,
      reasonCodes: Object.freeze(["NO_COMPLETED_OBSERVED_WEEK"] as const),
    }),
  });
}

test("Ready steady product receives a whole-number four-week range and basis", () => {
  const timeline = buildTimeline([10, 10, 10, 10, 10, 10, 10, 10]);
  const result = estimateProductDemand(timeline, "2026-08-10");

  assert.equal(result.label, "Ready");
  assert.equal(result.labelReason, undefined);
  assert.equal(result.pattern, "Steady seller");
  assert.deepEqual([result.range?.low, result.range?.high], [40, 40]);
  assert.equal(result.range?.horizonWeeks, 4);
  assert.equal(result.range?.basedOnWeekCount, 8);
  assert.equal(result.range?.firstWeekUsed, "2026-06-15");
  assert.equal(result.range?.lastWeekUsed, "2026-08-09");
  assert.equal(result.range?.method, "recent_mean_8");
});

test("four recorded weeks in the last eight produce Limited with the exact reason", () => {
  const timeline = buildTimeline([null, 8, null, 8, null, 8, null, 8]);
  const result = estimateProductDemand(timeline, "2026-08-10");

  assert.equal(result.label, "Limited");
  assert.equal(result.recordedWeeksInLast8, 4);
  assert.equal(result.labelReason?.message, "Only 4 of the last 8 weeks have records");
  assert.equal(result.pattern, "Steady seller");
  assert.ok(result.range);
});

test("fewer than four recorded weeks produce Cannot assess with no pattern or range", () => {
  const timeline = buildTimeline([null, 8, null, null, null, 8, null, 8]);
  const result = estimateProductDemand(timeline, "2026-08-10");

  assert.equal(result.label, "Cannot assess");
  assert.equal(result.labelReason?.message, "Only 3 of the last 8 weeks have records");
  assert.equal(result.pattern, undefined);
  assert.equal(result.range, undefined);
});

test("recorded zero weeks create an Occasional seller and use TSB", () => {
  const timeline = buildTimeline([0, 0, 0, 10, 0, 0, 0, 10]);
  const result = estimateProductDemand(timeline, "2026-08-10");

  assert.equal(result.label, "Ready");
  assert.equal(result.pattern, "Occasional seller");
  assert.equal(result.range?.method, "tsb_alpha_0_2_beta_0_2");
  assert.equal(result.range?.unroundedCentral, 10);
  assert.ok(Number.isInteger(result.range!.low));
  assert.ok(Number.isInteger(result.range!.high));
  assert.ok(result.range!.low <= result.range!.unroundedCentral);
  assert.ok(result.range!.unroundedCentral <= result.range!.high);
});

test("an unresolved duplicate overrides an otherwise Ready product", () => {
  const timeline = buildTimeline([10, 10, 10, 10, 10, 10, 10, 10]);
  const result = estimateProductDemand(timeline, "2026-08-10", { duplicateRowsNotDecided: true });

  assert.equal(result.label, "Cannot assess");
  assert.equal(result.labelReason?.message, "Duplicate rows not yet decided");
  assert.equal(result.pattern, undefined);
  assert.equal(result.range, undefined);
});

test("older observations do not turn a sparse last-eight-week window into Ready", () => {
  const timeline = buildTimeline([9, 9, 9, 9, 9, 9, 9, 9, null, 6, null, 6, null, 6, null, 6]);
  const result = estimateProductDemand(timeline, "2026-10-05");

  assert.equal(result.label, "Limited");
  assert.equal(result.recordedWeeksInLast8, 4);
});

test("future weeks cannot change the result at the same analysis date", () => {
  const past = [10, 10, 10, 10, 10, 10, 10, 10] as const;
  const original = estimateProductDemand(buildTimeline(past), "2026-08-10");
  const changedFuture = estimateProductDemand(
    buildTimeline([...past, 9999, 9999, 9999, 9999]),
    "2026-08-10",
  );

  assert.deepEqual(changedFuture, original);
});

test("three or more earlier comparisons use the historical-error range", () => {
  const timeline = buildTimeline(Array.from({ length: 32 }, () => 10));
  const result = estimateProductDemand(timeline, addCalendarDays(FIRST_WEEK, 32 * 7));

  assert.equal(result.range?.historicalErrorCount, 6);
  assert.equal(result.range?.intervalMethod, "symmetric_max_abs_historical_error_x1_5");
  assert.deepEqual([result.range?.low, result.range?.high], [40, 40]);
});

test("the review retains an identified product with no usable timeline as Cannot assess", () => {
  const snapshot: ReadinessSnapshot = Object.freeze({
    id: "snapshot-1",
    sourceMode: "user",
    sourceName: "test.csv",
    sourceSha256: "abc",
    analysisDate: "2026-08-10",
    rows: Object.freeze([Object.freeze({
      sourceRow: 2,
      productKey: "TEST001",
      originalProductHint: "Kopi O",
      originalValues: Object.freeze(["TEST001"]),
      normalizedValues: Object.freeze(["TEST001"]),
      interpretedValues: Object.freeze({ productCode: "TEST001" }),
      duplicateFingerprint: "fingerprint",
      useState: "excluded",
      issueIds: Object.freeze([]),
    })]),
    issues: Object.freeze([]),
    normalizations: Object.freeze([]),
    duplicateGroups: Object.freeze([]),
    reconciliation: Object.freeze({ rowsIn: 1, rowsUsed: 0, rowsExcluded: 1, rowsSafelyNormalized: 0 }),
    productStock: Object.freeze([]),
    productLimitations: Object.freeze([]),
  });

  const result = buildDemandForecastReview(snapshot);

  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].label, "Cannot assess");
  assert.equal(result.products[0].labelReason?.message, "Only 0 of the last 8 weeks have records");
  assert.equal(result.products[0].range, undefined);
});
