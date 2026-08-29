import type { StockFreshness } from "./contracts.ts";
import { calendarDaysBetween, parseIsoDate } from "./dates.ts";

/** Classifies a stock snapshot using fixed calendar-date boundaries. */
export function evaluateStockFreshness(
  stockAsOfDate: string | undefined,
  analysisDate: string,
): StockFreshness {
  if (!parseIsoDate(analysisDate)) {
    throw new Error("analysisDate must be a valid ISO YYYY-MM-DD date.");
  }
  if (!stockAsOfDate) {
    return Object.freeze({
      analysisDate,
      state: "unusable",
      reasonCode: "MISSING_STOCK_DATE",
    });
  }
  if (!parseIsoDate(stockAsOfDate)) {
    return Object.freeze({
      snapshotDate: stockAsOfDate,
      analysisDate,
      state: "unusable",
      reasonCode: "INVALID_STOCK_DATE",
    });
  }

  const ageDays = calendarDaysBetween(stockAsOfDate, analysisDate);
  if (ageDays < 0) {
    return Object.freeze({
      snapshotDate: stockAsOfDate,
      analysisDate,
      ageDays,
      state: "unusable",
      reasonCode: "FUTURE_STOCK_DATE",
    });
  }
  if (ageDays <= 7) {
    return Object.freeze({ snapshotDate: stockAsOfDate, analysisDate, ageDays, state: "current" });
  }
  if (ageDays <= 14) {
    return Object.freeze({ snapshotDate: stockAsOfDate, analysisDate, ageDays, state: "limited" });
  }
  return Object.freeze({
    snapshotDate: stockAsOfDate,
    analysisDate,
    ageDays,
    state: "unusable",
    reasonCode: "STALE_STOCK",
  });
}
