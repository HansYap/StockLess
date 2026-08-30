import type {
  ProductTimeline,
  ReadinessSnapshot,
  RecentWindowEvidence,
  ValidatedRow,
  WeeklyEvidence,
  WeekState,
} from "./contracts.ts";
import { addCalendarDays, isoWeekStart } from "./dates.ts";

interface WeekAccumulator {
  readonly productKey: string;
  readonly weekStart: string;
  positiveQuantity: number;
  negativeQuantity: number;
  netQuantity: number;
  recordCount: number;
  readonly sourceRows: number[];
}

/** Classifies an observed week without confusing zero activity with net zero. */
function classifyObservedWeek(week: WeekAccumulator): Exclude<WeekState, "missing"> {
  if (week.netQuantity !== 0) return "observed_demand";
  if (week.positiveQuantity !== 0 || week.negativeQuantity !== 0) return "net_zero_with_activity";
  return "confirmed_zero_sales";
}

/** Builds the latest completed observed-week window and its evidence state. */
function buildRecentWindow(
  weeks: readonly WeeklyEvidence[],
  analysisDate: string,
): RecentWindowEvidence {
  const completedObserved = weeks
    .filter((week) => week.state !== "missing" && week.weekEnd < analysisDate)
    .slice(-8);
  if (completedObserved.length === 0) {
    return Object.freeze({
      selectedWeekStarts: Object.freeze([]),
      observedWeekCount: 0,
      state: "unavailable",
      reasonCodes: Object.freeze(["NO_COMPLETED_OBSERVED_WEEK"] as const),
    });
  }

  const selectedWeekStarts = completedObserved.map((week) => week.weekStart);
  const selectedSet = new Set(selectedWeekStarts);
  const reasons: ("FEWER_THAN_8_COMPLETED_WEEKS" | "MISSING_WEEK_IN_RECENT_SPAN")[] = [];
  if (completedObserved.length < 8) reasons.push("FEWER_THAN_8_COMPLETED_WEEKS");
  for (
    let cursor = selectedWeekStarts[0];
    cursor <= selectedWeekStarts[selectedWeekStarts.length - 1];
    cursor = addCalendarDays(cursor, 7)
  ) {
    if (!selectedSet.has(cursor)) {
      reasons.push("MISSING_WEEK_IN_RECENT_SPAN");
      break;
    }
  }

  return Object.freeze({
    selectedWeekStarts: Object.freeze(selectedWeekStarts),
    windowStart: selectedWeekStarts[0],
    windowEnd: selectedWeekStarts[selectedWeekStarts.length - 1],
    observedWeekCount: completedObserved.length,
    state: completedObserved.length === 8 && reasons.length === 0 ? "standard" : "limited",
    reasonCodes: Object.freeze(reasons),
  });
}

/** Adds one valid demand row to its product and ISO-week accumulator. */
function accumulateRow(
  grouped: Map<string, WeekAccumulator>,
  row: ValidatedRow,
): void {
  const { transactionDate, quantitySold } = row.interpretedValues;
  if (row.useState !== "used" || !row.productKey || transactionDate === undefined || quantitySold === undefined) {
    return;
  }
  const weekStart = isoWeekStart(transactionDate);
  const key = `${row.productKey}\u0000${weekStart}`;
  const week = grouped.get(key) ?? {
    productKey: row.productKey,
    weekStart,
    positiveQuantity: 0,
    negativeQuantity: 0,
    netQuantity: 0,
    recordCount: 0,
    sourceRows: [],
  };
  week.positiveQuantity += Math.max(quantitySold, 0);
  week.negativeQuantity += Math.min(quantitySold, 0);
  week.netQuantity += quantitySold;
  week.recordCount += 1;
  week.sourceRows.push(row.sourceRow);
  grouped.set(key, week);
}

/** Aggregates used demand rows and inserts explicit missing-week evidence. */
export function buildProductTimelines(snapshot: ReadinessSnapshot): readonly ProductTimeline[] {
  const grouped = new Map<string, WeekAccumulator>();
  for (const row of snapshot.rows) accumulateRow(grouped, row);

  const observedByProduct = new Map<string, Map<string, WeekAccumulator>>();
  for (const week of grouped.values()) {
    const productWeeks = observedByProduct.get(week.productKey) ?? new Map<string, WeekAccumulator>();
    productWeeks.set(week.weekStart, week);
    observedByProduct.set(week.productKey, productWeeks);
  }

  const timelines: ProductTimeline[] = [];
  for (const [productKey, observed] of [...observedByProduct.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const observedStarts = [...observed.keys()].sort();
    const firstWeek = observedStarts[0];
    const lastWeek = observedStarts[observedStarts.length - 1];
    const weeks: WeeklyEvidence[] = [];
    for (let cursor = firstWeek; cursor <= lastWeek; cursor = addCalendarDays(cursor, 7)) {
      const week = observed.get(cursor);
      if (!week) {
        weeks.push(Object.freeze({
          productKey,
          weekStart: cursor,
          weekEnd: addCalendarDays(cursor, 6),
          positiveQuantity: null,
          negativeQuantity: null,
          netQuantity: null,
          recordCount: 0,
          state: "missing",
          sourceRows: Object.freeze([]),
        }));
        continue;
      }
      weeks.push(Object.freeze({
        productKey,
        weekStart: week.weekStart,
        weekEnd: addCalendarDays(week.weekStart, 6),
        positiveQuantity: week.positiveQuantity,
        negativeQuantity: week.negativeQuantity,
        netQuantity: week.netQuantity,
        recordCount: week.recordCount,
        state: classifyObservedWeek(week),
        sourceRows: Object.freeze([...week.sourceRows].sort((left, right) => left - right)),
      }));
    }

    const missingWeekCount = weeks.filter((week) => week.state === "missing").length;
    timelines.push(Object.freeze({
      productKey,
      weeks: Object.freeze(weeks),
      summary: Object.freeze({
        productKey,
        firstWeek,
        lastWeek,
        dateRangeStart: firstWeek,
        dateRangeEnd: addCalendarDays(lastWeek, 6),
        observedWeekCount: observedStarts.length,
        weeksInSpan: weeks.length,
        missingWeekCount,
      }),
      recentWindow: buildRecentWindow(weeks, snapshot.analysisDate),
    }));
  }
  return Object.freeze(timelines);
}
