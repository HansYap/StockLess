import assert from "node:assert/strict";
import test from "node:test";
import { suggestSupplierOrder } from "../src/supplier-order.ts";

import type {
  DemandForecastReview,
  ProductDemandEstimate,
  ProductStockEvidence,
  PurchaseQuantityField,
  ReadinessSnapshot,
} from "../src/contracts.ts";
import {
  applyPurchaseQuantityEdit,
  buildPurchasePlanReview,
  checkExpiry,
  createPurchaseQuantity,
  emptyProductPurchaseInputs,
  evaluateProductPurchasePlan,
  expiryInputFromFileEvidence,
  purchaseInputsFromFileEvidence,
} from "../src/purchase-plan.ts";

const ANALYSIS_DATE = "2026-09-14";

function demand(
  label: "Ready" | "Limited" | "Cannot assess" = "Ready",
  low = 20,
  high = 30,
): ProductDemandEstimate {
  if (label === "Cannot assess") {
    return Object.freeze({
      productKey: "SKU-1",
      label,
      labelReason: Object.freeze({
        code: "INSUFFICIENT_RECORDED_WEEKS" as const,
        message: "Only 3 of the last 8 weeks have records",
        recordedWeekCount: 3,
      }),
      recordedWeeksInLast8: 3,
      policyVersion: "test-e3",
    });
  }
  return Object.freeze({
    productKey: "SKU-1",
    label,
    recordedWeeksInLast8: label === "Ready" ? 8 : 4,
    pattern: "Steady seller" as const,
    range: Object.freeze({
      low,
      high,
      unroundedCentral: (low + high) / 2,
      unroundedLow: low,
      unroundedHigh: high,
      horizonWeeks: 4 as const,
      basedOnWeekCount: label === "Ready" ? 8 : 4,
      firstWeekUsed: "2026-07-13",
      lastWeekUsed: "2026-09-06",
      method: "recent_mean_8" as const,
      intervalMethod: "recent_variability_fallback" as const,
      historicalErrorCount: 0,
    }),
    policyVersion: "test-e3",
  });
}

function stock(
  currentStock: number | undefined = 10,
  stockAsOfDate: string | undefined = ANALYSIS_DATE,
): ProductStockEvidence {
  return Object.freeze({
    productKey: "SKU-1",
    currentStock,
    stockAsOfDate,
    freshness: Object.freeze({
      snapshotDate: stockAsOfDate,
      analysisDate: ANALYSIS_DATE,
      state: "current" as const,
    }),
    usableForCover: true,
    reasonCodes: Object.freeze([]),
  });
}

function inputs(planned: number | undefined, incoming?: number) {
  return Object.freeze({
    plannedOrder: planned === undefined
      ? ({ state: "empty" } as const)
      : createPurchaseQuantity(planned, "input by you"),
    incomingStock: incoming === undefined
      ? ({ state: "empty" } as const)
      : createPurchaseQuantity(incoming, "input by you"),
  });
}

test("empty-order preview uses zero without changing saved inputs or dashboard audits", () => {
  const empty = emptyProductPurchaseInputs();
  const options = { analysisDate: ANALYSIS_DATE, stock: stock(), inputs: empty };
  const normal = evaluateProductPurchasePlan(demand(), options);
  const preview = evaluateProductPurchasePlan(demand(), { ...options, previewEmptyOrder: true });
  assert.equal(normal.audit.state, "not_planned");
  assert.equal(preview.audit.state, "verdict");
  assert.equal(preview.inputs, empty);
  assert.equal(preview.inputs.plannedOrder.state, "empty");
  if (preview.audit.state === "verdict") {
    assert.equal(preview.audit.verdict, "Needs review");
    assert.deepEqual(preview.audit.figures.plannedOrder, { value: 0, source: "worked out by StockLess" });
  }
  const stale = evaluateProductPurchasePlan(demand(), { ...options, stock: stock(10, "2026-08-01"), previewEmptyOrder: true });
  assert.equal(stale.audit.state, "cannot_judge");
});

test("supplier suggestions honour minimums, round cases, and never force an unnecessary order", () => {
  const estimate = evaluateProductPurchasePlan(demand(), { analysisDate: ANALYSIS_DATE, stock: stock() }).estimatedRestock;
  assert.deepEqual(suggestSupplierOrder(estimate, { caseSize: 12, minimumOrder: 25, leadTimeDays: 5 }, ANALYSIS_DATE), {
    state: "available", quantity: 36, cases: 3, arrivalDate: "2026-09-19", beyondPlanningWindow: false,
  });
  const zero = evaluateProductPurchasePlan(demand(), { analysisDate: ANALYSIS_DATE, stock: stock(40) }).estimatedRestock;
  assert.equal((suggestSupplierOrder(zero, { caseSize: 12, minimumOrder: 100 }, ANALYSIS_DATE) as { quantity: number }).quantity, 0);
  const slow = suggestSupplierOrder(estimate, { leadTimeDays: 28 }, ANALYSIS_DATE);
  assert.equal(slow.state === "available" && slow.beyondPlanningWindow, true);
  const unknown = suggestSupplierOrder(estimate, {}, ANALYSIS_DATE);
  assert.equal(unknown.state === "available" && unknown.arrivalDate, undefined);
});

test("supplier suggestions reject invalid terms, unavailable estimates and overflow", () => {
  const estimate = evaluateProductPurchasePlan(demand(), { analysisDate: ANALYSIS_DATE, stock: stock() }).estimatedRestock;
  for (const terms of [{ caseSize: 0 }, { minimumOrder: -1 }, { caseSize: 1.5 }, { leadTimeDays: 3651 }]) {
    assert.equal(suggestSupplierOrder(estimate, terms, ANALYSIS_DATE).state, "unavailable");
  }
  assert.equal(suggestSupplierOrder(estimate, { caseSize: 600000, minimumOrder: 999999 }, ANALYSIS_DATE).state, "unavailable");
  assert.equal(suggestSupplierOrder(undefined, {}, ANALYSIS_DATE).state, "unavailable");
  assert.throws(() => suggestSupplierOrder(estimate, {}, "bad-date"), /valid analysis date/);
});

test("purchase fields accept only whole numbers from 0 to 999999", () => {
  const previous = createPurchaseQuantity(12, "from your file");
  for (const raw of ["-1", "1.5", "one", "1,000", "1000000"]) {
    const result = applyPurchaseQuantityEdit(previous, raw);
    assert.equal(result.accepted, false);
    assert.equal(result.field, previous);
    if (!result.accepted) assert.equal(result.message, "Whole numbers only");
  }

  assert.deepEqual(applyPurchaseQuantityEdit(previous, "0"), {
    accepted: true,
    field: { state: "value", value: 0, source: "input by you" },
  });
  assert.deepEqual(applyPurchaseQuantityEdit(previous, "999999"), {
    accepted: true,
    field: { state: "value", value: 999999, source: "input by you" },
  });
  assert.deepEqual(applyPurchaseQuantityEdit(previous, "  "), {
    accepted: true,
    field: { state: "empty" },
  });
});

test("an empty planned order has no audit, while estimated restock remains available", () => {
  const result = evaluateProductPurchasePlan(demand(), {
    analysisDate: ANALYSIS_DATE,
    stock: stock(),
    inputs: emptyProductPurchaseInputs(),
  });

  assert.deepEqual(result.audit, { state: "not_planned" });
  assert.deepEqual(result.estimatedRestock, {
    state: "available",
    quantity: { value: 15, source: "worked out by StockLess" },
    beforeQuantity: { value: 15, source: "worked out by StockLess" },
    afterQuantity: { value: 15, source: "worked out by StockLess" },
    midpointTarget: { value: 25, source: "worked out by StockLess" },
  });
});

test("incoming stock lowers the estimate but only the planned order triggers a verdict", () => {
  const result = evaluateProductPurchasePlan(demand(), {
    analysisDate: ANALYSIS_DATE,
    stock: stock(),
    inputs: inputs(5, 4),
  });

  assert.equal(result.estimatedRestock.state, "available");
  if (result.estimatedRestock.state === "available") {
    assert.equal(result.estimatedRestock.quantity.value, 11);
  }
  assert.equal(result.audit.state, "verdict");
  if (result.audit.state === "verdict") {
    assert.equal(result.audit.verdict, "Needs review");
    assert.equal(result.audit.figures.availableAfterOrder.value, 19);
    assert.equal(result.audit.figures.incomingStock.source, "input by you");
    assert.equal(result.audit.figures.demandLow.source, "worked out by StockLess");
  }
});

test("a fractional stock count still produces a whole-number estimate that Planned order accepts", () => {
  const result = evaluateProductPurchasePlan(demand(), {
    analysisDate: ANALYSIS_DATE,
    stock: stock(10.5),
  });
  assert.equal(result.estimatedRestock.state, "available");
  if (result.estimatedRestock.state === "available") {
    assert.equal(result.estimatedRestock.quantity.value, 15);
    assert.equal(Number.isInteger(result.estimatedRestock.quantity.value), true);
    assert.equal(
      applyPurchaseQuantityEdit(
        { state: "empty" },
        String(result.estimatedRestock.quantity.value),
      ).accepted,
      true,
    );
  }
});

test("validated file evidence becomes file-sourced defaults and a confirmed expiry input", () => {
  const fileEvidence = {
    plannedOrderColumnConfirmed: true,
    incomingStockColumnConfirmed: true,
    expiryDateColumnConfirmed: true,
    products: [{
      productKey: "SKU-1",
      plannedOrderQuantity: 12,
      incomingStockQuantity: 3,
      expiryDates: ["2026-09-20"],
      reasonCodes: [],
    }],
  } as const;
  assert.deepEqual(purchaseInputsFromFileEvidence(fileEvidence.products[0]), {
    plannedOrder: { state: "value", value: 12, source: "from your file" },
    incomingStock: { state: "value", value: 3, source: "from your file" },
  });
  assert.deepEqual(expiryInputFromFileEvidence(fileEvidence, "SKU-1"), {
    columnConfirmed: true,
    dates: ["2026-09-20"],
  });
});

test("verdict boundaries are inclusive and reasons stay within 25 words", () => {
  const cases = [
    { planned: 9, expected: "Needs review" },
    { planned: 10, expected: "Looks balanced" },
    { planned: 20, expected: "Looks balanced" },
    { planned: 21, expected: "Overstock risk" },
  ] as const;

  for (const item of cases) {
    const result = evaluateProductPurchasePlan(demand(), {
      analysisDate: ANALYSIS_DATE,
      stock: stock(),
      inputs: inputs(item.planned),
    });
    assert.equal(result.audit.state, "verdict");
    if (result.audit.state === "verdict") {
      assert.equal(result.audit.verdict, item.expected);
      assert.ok(result.audit.reasonSentence.trim().split(/\s+/).length <= 25);
    }
  }
});

test("empty incoming stock is treated as zero with explicit derived provenance", () => {
  const result = evaluateProductPurchasePlan(demand(), {
    analysisDate: ANALYSIS_DATE,
    stock: stock(),
    inputs: inputs(10),
  });
  assert.equal(result.audit.state, "verdict");
  if (result.audit.state === "verdict") {
    assert.deepEqual(result.audit.figures.incomingStock, {
      value: 0,
      source: "worked out by StockLess",
    });
  }
});

test("clearing the planned order removes the verdict and worked figures", () => {
  const oldPlan = createPurchaseQuantity(10, "input by you");
  const cleared = applyPurchaseQuantityEdit(oldPlan, "");
  assert.equal(cleared.accepted, true);
  const result = evaluateProductPurchasePlan(demand(), {
    analysisDate: ANALYSIS_DATE,
    stock: stock(),
    inputs: Object.freeze({ incomingStock: inputs(undefined).incomingStock, plannedOrder: cleared.field }),
  });
  assert.deepEqual(result.audit, { state: "not_planned" });
  assert.equal("figures" in result.audit, false);
});

test("Cannot judge applies the submitted reason priority and one corrective action", () => {
  const planned = inputs(5);
  const noStock = Object.freeze({ ...stock(), currentStock: undefined, stockAsOfDate: undefined });
  const noStockDate = Object.freeze({ ...stock(), stockAsOfDate: undefined });
  const cases: readonly [ProductDemandEstimate, ProductStockEvidence | undefined, string][] = [
    [demand("Cannot assess"), undefined, "the product is Cannot assess"],
    [demand(), noStock, "no stock on hand figure"],
    [demand(), noStockDate, "no stock count date"],
    [demand(), stock(10, "2026-08-30"), "the stock count date is more than 14 days old"],
    [demand(), stock(10, "2026-09-15"), "the stock count date is in the future"],
  ];

  for (const [productDemand, productStock, reason] of cases) {
    const result = evaluateProductPurchasePlan(productDemand, {
      analysisDate: ANALYSIS_DATE,
      stock: productStock,
      inputs: planned,
    });
    assert.equal(result.audit.state, "cannot_judge");
    if (result.audit.state === "cannot_judge") {
      assert.equal(result.audit.reason, reason);
      assert.ok(result.audit.correctiveAction.length > 0);
      assert.equal("figures" in result.audit, false);
      assert.equal("reasonSentence" in result.audit, false);
    }
  }
});

test("stock age boundaries 7, 8, 14 and 15 follow the freshness policy", () => {
  const cases = [
    { date: "2026-09-07", state: "verdict", gettingOld: false },
    { date: "2026-09-06", state: "verdict", gettingOld: true },
    { date: "2026-08-31", state: "verdict", gettingOld: true },
    { date: "2026-08-30", state: "cannot_judge", gettingOld: false },
  ] as const;

  for (const item of cases) {
    const result = evaluateProductPurchasePlan(demand(), {
      analysisDate: ANALYSIS_DATE,
      stock: stock(10, item.date),
      inputs: inputs(10),
    });
    assert.equal(result.audit.state, item.state);
    assert.equal(result.audit.state === "verdict" ? result.audit.gettingOld : false, item.gettingOld);
  }
});

test("expiry uses the earliest readable non-past date and never changes the audit", () => {
  assert.deepEqual(checkExpiry(undefined, ANALYSIS_DATE), {
    state: "no_column",
    message: "Expiry not checked — your file has no expiry dates",
  });
  assert.deepEqual(checkExpiry({ columnConfirmed: true, dates: ["bad", "2026-09-13"] }, ANALYSIS_DATE), {
    state: "no_usable_date",
    message: "Expiry not checked — no usable expiry date for this product",
  });

  const today = checkExpiry({ columnConfirmed: true, dates: ["2026-10-12", "2026-09-14"] }, ANALYSIS_DATE);
  assert.equal(today.message, "Expires in 0 days (2026-09-14)");
  const day28 = checkExpiry({ columnConfirmed: true, dates: ["2026-10-12"] }, ANALYSIS_DATE);
  assert.equal(day28.state, "expires_within_four_weeks");
  const day29 = checkExpiry({ columnConfirmed: true, dates: ["2026-10-13"] }, ANALYSIS_DATE);
  assert.equal(day29.state, "no_expiry_inside_four_weeks");

  const withoutExpiry = evaluateProductPurchasePlan(demand(), {
    analysisDate: ANALYSIS_DATE,
    stock: stock(),
    inputs: inputs(10),
  });
  const withExpiry = evaluateProductPurchasePlan(demand(), {
    analysisDate: ANALYSIS_DATE,
    stock: stock(),
    inputs: inputs(10),
    expiry: { columnConfirmed: true, dates: ["2026-09-15"] },
  });
  assert.deepEqual(withExpiry.audit, withoutExpiry.audit);
});

test("input constructors reject values outside the contract", () => {
  for (const value of [-1, 1.2, 1_000_000, Number.NaN]) {
    assert.throws(() => createPurchaseQuantity(value, "input by you"));
  }
  const accepted: PurchaseQuantityField = createPurchaseQuantity(25, "from your file");
  assert.deepEqual(accepted, { state: "value", value: 25, source: "from your file" });
});

test("a purchase review joins stock and submitted US5.6 guidance to Epic 3 output", () => {
  const productDemand = demand();
  const productStock = stock();
  const snapshot: ReadinessSnapshot = Object.freeze({
    id: "snapshot-1",
    sourceMode: "user",
    sourceName: "sales.csv",
    sourceSha256: "abc",
    analysisDate: ANALYSIS_DATE,
    rows: Object.freeze([]),
    issues: Object.freeze([]),
    normalizations: Object.freeze([]),
    duplicateGroups: Object.freeze([]),
    reconciliation: Object.freeze({ rowsIn: 0, rowsUsed: 0, rowsExcluded: 0, rowsSafelyNormalized: 0 }),
    productStock: Object.freeze([productStock]),
    productLimitations: Object.freeze([]),
  });
  const forecast: DemandForecastReview = Object.freeze({
    snapshotId: snapshot.id,
    analysisDate: snapshot.analysisDate,
    policyVersion: "test-e3",
    products: Object.freeze([productDemand]),
  });
  const review = buildPurchasePlanReview(snapshot, forecast, {
    inputsByProduct: { "SKU-1": inputs(12, 3) },
  });

  assert.equal(review.products.length, 1);
  assert.equal(review.products[0].audit.state, "verdict");
  assert.equal("counts" in review, false);
  assert.throws(() => buildPurchasePlanReview(
    Object.freeze({ ...snapshot, id: "different-snapshot" }),
    forecast,
  ), /IDs do not match/);
});
