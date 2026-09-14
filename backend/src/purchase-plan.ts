import type {
  CannotJudgeReason,
  DemandForecastReview,
  ExpiryCheckInput,
  ExpiryCheckResult,
  ProductDemandEstimate,
  ProductPurchaseFileEvidence,
  ProductPurchaseInputs,
  ProductPurchasePlan,
  ProductStockEvidence,
  PurchaseAuditResult,
  PurchaseFigure,
  PurchaseInputSource,
  PurchaseFileEvidence,
  PurchasePlanReview,
  PurchaseQuantityField,
  PurchaseQuantityValidation,
  ReadinessSnapshot,
  RestockEstimate,
} from "./contracts.ts";
import { calendarDaysBetween, parseIsoDate } from "./dates.ts";

/** Domain policy for submitted Epic 5 US5.1-US5.5. US5.6 is intentionally UI-owned. */
export const EPIC5_POLICY_VERSION = "stockless-i2-e5-v1.1.0";

export const EPIC5_POLICY = Object.freeze({
  maximumQuantity: 999_999,
  gettingOldFromDays: 8,
  maximumStockAgeDays: 14,
  expiryWindowDays: 28,
  verdictRule: "available_after_order_vs_four_week_range" as const,
  restockTarget: "rounded_range_midpoint_then_ceiling_shortfall" as const,
});

export interface EvaluatePurchasePlanOptions {
  readonly analysisDate: string;
  readonly stock?: ProductStockEvidence;
  readonly inputs?: ProductPurchaseInputs;
  readonly currentStockSource?: PurchaseInputSource;
  readonly expiry?: ExpiryCheckInput;
}

export interface BuildPurchasePlanReviewOptions {
  readonly inputsByProduct?: Readonly<Record<string, ProductPurchaseInputs | undefined>>;
  readonly expiryByProduct?: Readonly<Record<string, ExpiryCheckInput | undefined>>;
  readonly currentStockSourceByProduct?: Readonly<Record<string, PurchaseInputSource | undefined>>;
}

const EMPTY_QUANTITY: PurchaseQuantityField = Object.freeze({ state: "empty" });

export function emptyPurchaseQuantity(): PurchaseQuantityField {
  return EMPTY_QUANTITY;
}

export function emptyProductPurchaseInputs(): ProductPurchaseInputs {
  return Object.freeze({
    incomingStock: EMPTY_QUANTITY,
    plannedOrder: EMPTY_QUANTITY,
  });
}

/** Converts validated optional file evidence into the same inputs used by typed edits. */
export function purchaseInputsFromFileEvidence(
  evidence: ProductPurchaseFileEvidence | undefined,
): ProductPurchaseInputs {
  return Object.freeze({
    incomingStock: evidence?.incomingStockQuantity === undefined
      ? EMPTY_QUANTITY
      : createPurchaseQuantity(evidence.incomingStockQuantity, "from your file"),
    plannedOrder: evidence?.plannedOrderQuantity === undefined
      ? EMPTY_QUANTITY
      : createPurchaseQuantity(evidence.plannedOrderQuantity, "from your file"),
  });
}

/** Supplies the confirmed-column state even when one product has no usable expiry date. */
export function expiryInputFromFileEvidence(
  fileEvidence: PurchaseFileEvidence | undefined,
  productKey: string,
  knownProduct?: ProductPurchaseFileEvidence,
): ExpiryCheckInput {
  const product = knownProduct
    ?? fileEvidence?.products.find((candidate) => candidate.productKey === productKey);
  return Object.freeze({
    columnConfirmed: fileEvidence?.expiryDateColumnConfirmed ?? false,
    dates: product?.expiryDates ?? Object.freeze([]),
  });
}

export function createPurchaseQuantity(
  value: number,
  source: PurchaseInputSource,
): PurchaseQuantityField {
  if (!Number.isSafeInteger(value) || value < 0 || value > EPIC5_POLICY.maximumQuantity) {
    throw new Error("Purchase quantities must be whole numbers from 0 to 999999.");
  }
  return Object.freeze({ state: "value", value, source });
}

/** Applies a UI edit without destroying the last accepted value when validation fails. */
export function applyPurchaseQuantityEdit(
  previous: PurchaseQuantityField,
  rawValue: string,
): PurchaseQuantityValidation {
  const trimmed = rawValue.trim();
  if (trimmed === "") {
    return Object.freeze({ accepted: true, field: EMPTY_QUANTITY });
  }

  if (!/^\d+$/.test(trimmed)) {
    return Object.freeze({ accepted: false, field: previous, message: "Whole numbers only" });
  }

  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value > EPIC5_POLICY.maximumQuantity) {
    return Object.freeze({ accepted: false, field: previous, message: "Whole numbers only" });
  }

  return Object.freeze({
    accepted: true,
    field: createPurchaseQuantity(value, "input by you"),
  });
}

function figure(value: number, source: PurchaseFigure["source"]): PurchaseFigure {
  return Object.freeze({ value, source });
}

function cannotJudgeReason(
  demand: ProductDemandEstimate,
  stock: ProductStockEvidence | undefined,
  analysisDate: string,
): CannotJudgeReason | undefined {
  if (demand.label === "Cannot assess") return "the product is Cannot assess";
  if (stock?.currentStock === undefined || !Number.isFinite(stock.currentStock)) {
    return "no stock on hand figure";
  }
  if (!stock.stockAsOfDate || !parseIsoDate(stock.stockAsOfDate)) return "no stock count date";

  const ageDays = calendarDaysBetween(stock.stockAsOfDate, analysisDate);
  if (ageDays > EPIC5_POLICY.maximumStockAgeDays) {
    return "the stock count date is more than 14 days old";
  }
  if (ageDays < 0) return "the stock count date is in the future";
  return undefined;
}

function correctiveAction(reason: CannotJudgeReason): string {
  switch (reason) {
    case "the product is Cannot assess":
      return "Review the product's data issues in the readiness check.";
    case "no stock on hand figure":
      return "Add a current stock figure and run the readiness check again.";
    case "no stock count date":
      return "Add the date when this stock was counted.";
    case "the stock count date is more than 14 days old":
      return "Provide a stock count dated within the last 14 days.";
    case "the stock count date is in the future":
      return "Correct the stock count date.";
  }
}

function assertAnalysisDate(analysisDate: string): void {
  if (!parseIsoDate(analysisDate)) throw new Error(`Invalid analysis date: ${analysisDate}.`);
}

function requireRange(demand: ProductDemandEstimate) {
  if (!demand.range) {
    throw new Error(`${demand.productKey} is ${demand.label} but has no four-week demand range.`);
  }
  return demand.range;
}

function effectiveIncoming(field: PurchaseQuantityField): PurchaseFigure {
  return field.state === "value"
    ? figure(field.value, field.source)
    : figure(0, "worked out by StockLess");
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function estimateRestock(
  demand: ProductDemandEstimate,
  stock: ProductStockEvidence | undefined,
  inputs: ProductPurchaseInputs,
  analysisDate: string,
): RestockEstimate {
  const cannotReason = cannotJudgeReason(demand, stock, analysisDate);
  if (cannotReason) return Object.freeze({ state: "unavailable", reason: cannotReason });

  const range = requireRange(demand);
  const midpointTarget = Math.round((range.low + range.high) / 2);
  const incoming = inputs.incomingStock.state === "value" ? inputs.incomingStock.value : 0;
  // Planned order accepts whole units. Ceiling prevents an adopted estimate
  // from falling short of the midpoint when stock on hand is fractional.
  const quantity = Math.max(0, Math.ceil(midpointTarget - stock!.currentStock! - incoming));
  return Object.freeze({
    state: "available",
    quantity: figure(quantity, "worked out by StockLess"),
    midpointTarget: figure(midpointTarget, "worked out by StockLess"),
  });
}

function auditPurchase(
  demand: ProductDemandEstimate,
  stock: ProductStockEvidence | undefined,
  inputs: ProductPurchaseInputs,
  analysisDate: string,
  currentStockSource: PurchaseInputSource,
): PurchaseAuditResult {
  if (inputs.plannedOrder.state === "empty") return Object.freeze({ state: "not_planned" });

  const cannotReason = cannotJudgeReason(demand, stock, analysisDate);
  if (cannotReason) {
    return Object.freeze({
      state: "cannot_judge",
      label: "Cannot judge",
      reason: cannotReason,
      correctiveAction: correctiveAction(cannotReason),
      gettingOld: false,
    });
  }

  const range = requireRange(demand);
  const incomingStock = effectiveIncoming(inputs.incomingStock);
  const plannedOrder = inputs.plannedOrder;
  const available = stock!.currentStock! + incomingStock.value + plannedOrder.value;
  const availableText = formatQuantity(available);

  let verdict: "High risk" | "Needs review" | "Looks balanced";
  let reasonSentence: string;
  if (available > range.high) {
    verdict = "High risk";
    reasonSentence = `You would have ${availableText} units, above the ${range.high}-unit four-week range, so the planned order looks too much.`;
  } else if (available < range.low) {
    verdict = "Needs review";
    reasonSentence = `You would have ${availableText} units, below the ${range.low}-unit four-week range, so the planned order looks too little.`;
  } else {
    verdict = "Looks balanced";
    reasonSentence = `You would have ${availableText} units, within the ${range.low}-${range.high} four-week range, so the planned order looks about right.`;
  }

  const ageDays = calendarDaysBetween(stock!.stockAsOfDate!, analysisDate);
  return Object.freeze({
    state: "verdict",
    verdict,
    reasonSentence,
    gettingOld: ageDays >= EPIC5_POLICY.gettingOldFromDays,
    figures: Object.freeze({
      stockOnHand: figure(stock!.currentStock!, currentStockSource),
      incomingStock,
      plannedOrder: figure(plannedOrder.value, plannedOrder.source),
      demandLow: figure(range.low, "worked out by StockLess"),
      demandHigh: figure(range.high, "worked out by StockLess"),
      availableAfterOrder: figure(available, "worked out by StockLess"),
    }),
  });
}

export function checkExpiry(
  input: ExpiryCheckInput | undefined,
  analysisDate: string,
): ExpiryCheckResult {
  assertAnalysisDate(analysisDate);
  if (!input?.columnConfirmed) {
    return Object.freeze({ state: "no_column", message: "Expiry not checked — your file has no expiry dates" });
  }

  const usable = input.dates
    .filter((date) => parseIsoDate(date) !== undefined)
    .map((date) => Object.freeze({ date, days: calendarDaysBetween(analysisDate, date) }))
    .filter(({ days }) => days >= 0)
    .sort((left, right) => left.days - right.days || left.date.localeCompare(right.date));

  const earliest = usable[0];
  if (!earliest) {
    return Object.freeze({
      state: "no_usable_date",
      message: "Expiry not checked — no usable expiry date for this product",
    });
  }
  if (earliest.days <= EPIC5_POLICY.expiryWindowDays) {
    return Object.freeze({
      state: "expires_within_four_weeks",
      message: `Expires in ${earliest.days} days (${earliest.date})`,
      earliestDate: earliest.date,
      daysUntilExpiry: earliest.days,
    });
  }
  return Object.freeze({
    state: "no_expiry_inside_four_weeks",
    message: "No expiry inside the next 4 weeks",
    earliestDate: earliest.date,
    daysUntilExpiry: earliest.days,
  });
}

export function evaluateProductPurchasePlan(
  demand: ProductDemandEstimate,
  options: EvaluatePurchasePlanOptions,
): ProductPurchasePlan {
  assertAnalysisDate(options.analysisDate);
  const inputs = options.inputs ?? emptyProductPurchaseInputs();
  return Object.freeze({
    productKey: demand.productKey,
    inputs,
    estimatedRestock: estimateRestock(demand, options.stock, inputs, options.analysisDate),
    audit: auditPurchase(
      demand,
      options.stock,
      inputs,
      options.analysisDate,
      options.currentStockSource ?? "from your file",
    ),
    expiry: checkExpiry(options.expiry, options.analysisDate),
    purchasePolicyVersion: EPIC5_POLICY_VERSION,
  });
}

export function buildPurchasePlanReview(
  snapshot: ReadinessSnapshot,
  forecast: DemandForecastReview,
  options: BuildPurchasePlanReviewOptions = {},
): PurchasePlanReview {
  if (forecast.snapshotId !== snapshot.id) {
    throw new Error("Forecast and readiness snapshot IDs do not match.");
  }
  if (forecast.analysisDate !== snapshot.analysisDate) {
    throw new Error("Forecast and readiness analysis dates do not match.");
  }

  const stockByProduct = new Map(snapshot.productStock.map((stock) => [stock.productKey, stock]));
  const fileEvidenceByProduct = new Map(
    (snapshot.purchaseFileEvidence?.products ?? []).map((evidence) => [evidence.productKey, evidence]),
  );
  const products = forecast.products.map((demand) => evaluateProductPurchasePlan(demand, {
    analysisDate: snapshot.analysisDate,
    stock: stockByProduct.get(demand.productKey),
    inputs: options.inputsByProduct?.[demand.productKey]
      ?? purchaseInputsFromFileEvidence(fileEvidenceByProduct.get(demand.productKey)),
    expiry: options.expiryByProduct?.[demand.productKey]
      ?? expiryInputFromFileEvidence(
        snapshot.purchaseFileEvidence,
        demand.productKey,
        fileEvidenceByProduct.get(demand.productKey),
      ),
    currentStockSource: options.currentStockSourceByProduct?.[demand.productKey],
  }));

  return Object.freeze({
    snapshotId: snapshot.id,
    analysisDate: snapshot.analysisDate,
    forecastPolicyVersion: forecast.policyVersion,
    purchasePolicyVersion: EPIC5_POLICY_VERSION,
    products: Object.freeze(products),
  });
}
