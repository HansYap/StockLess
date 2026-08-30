import type {
  CoverReasonCode,
  DemandProductEvidence,
  DemandReview,
  ProductStockEvidence,
  ProductTimeline,
  ReadinessSnapshot,
  RecentAverageEvidence,
  RecentAverageReasonCode,
  WeeksOfCoverEvidence,
} from "./contracts.ts";
import { buildProductTimelines } from "./timeline.ts";

/** Returns a stable, retailer-readable label without changing the product key. */
function productDisplayName(snapshot: ReadinessSnapshot, productKey: string): string {
  const row = snapshot.rows.find((candidate) => candidate.productKey === productKey && candidate.useState === "used")
    ?? snapshot.rows.find((candidate) => candidate.productKey === productKey);
  if (!row) return productKey;
  const { productName, packVariant, productCode } = row.interpretedValues;
  const descriptive = [productName, packVariant].filter((value): value is string => Boolean(value)).join(" · ");
  return descriptive || productCode || productKey;
}

/** Calculates the recent mean from only the completed observed weeks selected by the timeline. */
function buildRecentAverage(timeline: ProductTimeline): RecentAverageEvidence {
  const window = timeline.recentWindow;
  if (window.state === "unavailable") {
    return Object.freeze({
      state: "cannot_calculate",
      selectedWeekStarts: window.selectedWeekStarts,
      observedWeekCount: 0,
      reasonCodes: window.reasonCodes,
    });
  }

  const selected = new Set(window.selectedWeekStarts);
  const quantities = timeline.weeks
    .filter((week) => selected.has(week.weekStart))
    .map((week) => week.netQuantity)
    .filter((quantity): quantity is number => quantity !== null);
  const value = quantities.reduce((sum, quantity) => sum + quantity, 0) / quantities.length;

  return Object.freeze({
    value,
    state: window.state,
    selectedWeekStarts: window.selectedWeekStarts,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    observedWeekCount: window.observedWeekCount,
    reasonCodes: window.reasonCodes,
  });
}

function pushUnique<T>(items: T[], value: T): void {
  if (!items.includes(value)) items.push(value);
}

/** Resolves named stock failures without collapsing invalid, missing and conflicting evidence. */
function stockFailureReasons(
  snapshot: ReadinessSnapshot,
  productKey: string,
  stock: ProductStockEvidence | undefined,
): CoverReasonCode[] {
  if (!stock) return ["MISSING_CURRENT_STOCK", "MISSING_STOCK_DATE"];
  const reasons: CoverReasonCode[] = [];
  const issueCodes = new Set(
    snapshot.issues.filter((issue) => issue.productKey === productKey).map((issue) => issue.issueCode),
  );

  if (stock.currentStock === undefined) {
    if (stock.reasonCodes.includes("CONFLICTING_CURRENT_STOCK")) {
      pushUnique(reasons, "CONFLICTING_CURRENT_STOCK");
    } else if (issueCodes.has("INVALID_CURRENT_STOCK")) {
      pushUnique(reasons, "INVALID_CURRENT_STOCK");
    } else {
      pushUnique(reasons, "MISSING_CURRENT_STOCK");
    }
  }

  if (stock.reasonCodes.includes("CONFLICTING_STOCK_DATE")) {
    pushUnique(reasons, "CONFLICTING_STOCK_DATE");
  } else if (issueCodes.has("INVALID_STOCK_DATE")) {
    pushUnique(reasons, "INVALID_STOCK_DATE");
  } else if (issueCodes.has("FUTURE_STOCK_DATE")) {
    pushUnique(reasons, "FUTURE_STOCK_DATE");
  } else if (issueCodes.has("MISSING_STOCK_DATE")) {
    pushUnique(reasons, "MISSING_STOCK_DATE");
  } else if (stock.freshness.state === "unusable") {
    const code = stock.freshness.reasonCode;
    if (code === "INVALID_STOCK_DATE") pushUnique(reasons, "INVALID_STOCK_DATE");
    else if (code === "FUTURE_STOCK_DATE") pushUnique(reasons, "FUTURE_STOCK_DATE");
    else if (code === "STALE_STOCK") pushUnique(reasons, "STALE_STOCK");
    else pushUnique(reasons, "MISSING_STOCK_DATE");
  }
  return reasons;
}

/** Applies every stock-cover guard before division and labels any degraded value. */
function buildCover(
  snapshot: ReadinessSnapshot,
  timeline: ProductTimeline,
  recentAverage: RecentAverageEvidence,
  stock: ProductStockEvidence | undefined,
): WeeksOfCoverEvidence {
  const fatal = stockFailureReasons(snapshot, timeline.productKey, stock);
  if (recentAverage.state === "cannot_calculate" || recentAverage.value === undefined) {
    pushUnique(fatal, "NO_COMPLETED_OBSERVED_WEEK");
  } else if (recentAverage.value === 0) {
    pushUnique(fatal, "ZERO_AVERAGE");
  } else if (recentAverage.value < 0) {
    pushUnique(fatal, "NEGATIVE_AVERAGE");
  }

  const inputs = {
    currentStock: stock?.currentStock,
    recentAverage: recentAverage.value,
    stockAsOfDate: stock?.stockAsOfDate,
    stockAgeDays: stock?.freshness.ageDays,
    freshnessState: stock?.freshness.state,
  } as const;
  if (fatal.length > 0) {
    return Object.freeze({ ...inputs, state: "cannot_calculate", reasonCodes: Object.freeze(fatal) });
  }

  const limited: CoverReasonCode[] = [];
  for (const reason of recentAverage.reasonCodes) pushUnique(limited, reason);
  if (stock?.freshness.state === "limited") pushUnique(limited, "AGED_STOCK");
  if (snapshot.productLimitations.some((limitation) =>
    limitation.productKey === timeline.productKey && limitation.code === "DUPLICATE_UNRESOLVED")) {
    pushUnique(limited, "DUPLICATE_UNRESOLVED");
  }

  const value = stock!.currentStock! / recentAverage.value!;
  return Object.freeze({
    ...inputs,
    value,
    state: limited.length > 0 ? "limited" : "standard",
    reasonCodes: Object.freeze(limited),
  });
}

/** Builds the one authoritative descriptive-demand view consumed by Screen 4 and exports. */
export function buildDemandReview(snapshot: ReadinessSnapshot): DemandReview {
  const stockByProduct = new Map(snapshot.productStock.map((stock) => [stock.productKey, stock]));
  const products: DemandProductEvidence[] = buildProductTimelines(snapshot).map((timeline) => {
    const recentAverage = buildRecentAverage(timeline);
    const duplicateLimited = snapshot.productLimitations.some((limitation) =>
      limitation.productKey === timeline.productKey && limitation.code === "DUPLICATE_UNRESOLVED");
    const stateReasons: (RecentAverageReasonCode | "DUPLICATE_UNRESOLVED")[] = [...recentAverage.reasonCodes];
    if (duplicateLimited) stateReasons.push("DUPLICATE_UNRESOLVED");
    return Object.freeze({
      productKey: timeline.productKey,
      displayName: productDisplayName(snapshot, timeline.productKey),
      timeline,
      recentAverage,
      cover: buildCover(snapshot, timeline, recentAverage, stockByProduct.get(timeline.productKey)),
      state: recentAverage.state === "standard" && !duplicateLimited ? "standard" : "limited",
      stateReasons: Object.freeze(stateReasons),
      forecastReady: false as const,
    });
  });
  products.sort((left, right) =>
    left.displayName < right.displayName ? -1 : left.displayName > right.displayName ? 1 : 0);
  return Object.freeze({
    snapshotId: snapshot.id,
    analysisDate: snapshot.analysisDate,
    products: Object.freeze(products),
  });
}
