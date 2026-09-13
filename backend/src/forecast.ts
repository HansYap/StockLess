import type {
  DemandAssessmentReason,
  DemandForecastMethod,
  DemandForecastReview,
  DemandPattern,
  DemandRangeEvidence,
  DemandReadinessLabel,
  ProductDemandEstimate,
  ProductTimeline,
  ReadinessSnapshot,
  WeeklyEvidence,
} from "./contracts.ts";
import { addCalendarDays, isoWeekStart } from "./dates.ts";
import { buildProductTimelines } from "./timeline.ts";

export const EPIC3_POLICY_VERSION = "stockless-i2-e3-v1.0.0";

export const EPIC3_POLICY = Object.freeze({
  horizonWeeks: 4 as const,
  labelWindowWeeks: 8,
  minimumRecordedWeeks: 4,
  steadyPositiveFraction: 0.5,
  tsbDemandAlpha: 0.2,
  tsbOccurrenceBeta: 0.2,
  maximumHistoricalErrors: 6,
  minimumHistoricalErrors: 3,
  historicalErrorMultiplier: 1.5,
  variabilityZ: 1.2815515655,
});

interface PointForecast {
  readonly value: number;
  readonly basedOn: readonly WeeklyEvidence[];
}

interface Assessment {
  readonly label: DemandReadinessLabel;
  readonly reason?: DemandAssessmentReason;
  readonly records: readonly WeeklyEvidence[];
  readonly pattern?: DemandPattern;
}

export interface EstimateProductDemandOptions {
  readonly duplicateRowsNotDecided?: boolean;
}

/** Returns the eight Monday starts belonging to complete weeks before the origin. */
function previousCompleteWeekStarts(originDate: string): readonly string[] {
  const currentWeekStart = isoWeekStart(originDate);
  return Object.freeze(Array.from(
    { length: EPIC3_POLICY.labelWindowWeeks },
    (_, index) => addCalendarDays(currentWeekStart, (index - EPIC3_POLICY.labelWindowWeeks) * 7),
  ));
}

function weekByStart(timeline: ProductTimeline): ReadonlyMap<string, WeeklyEvidence> {
  return new Map(timeline.weeks.map((week) => [week.weekStart, week]));
}

function isRecorded(week: WeeklyEvidence | undefined): week is WeeklyEvidence {
  return week !== undefined && week.state !== "missing";
}

/** Applies the submitted Ready/Limited/Cannot assess and two-pattern rules. */
function assessAt(
  timeline: ProductTimeline,
  originDate: string,
  duplicateRowsNotDecided: boolean,
): Assessment {
  const indexed = weekByStart(timeline);
  const records = previousCompleteWeekStarts(originDate)
    .map((weekStart) => indexed.get(weekStart))
    .filter(isRecorded);

  if (duplicateRowsNotDecided) {
    return Object.freeze({
      label: "Cannot assess",
      reason: Object.freeze({
        code: "DUPLICATE_ROWS_NOT_DECIDED",
        message: "Duplicate rows not yet decided",
      }),
      records: Object.freeze(records),
    });
  }

  if (records.length < EPIC3_POLICY.minimumRecordedWeeks) {
    return Object.freeze({
      label: "Cannot assess",
      reason: Object.freeze({
        code: "INSUFFICIENT_RECORDED_WEEKS",
        message: `Only ${records.length} of the last 8 weeks have records`,
        recordedWeekCount: records.length,
      }),
      records: Object.freeze(records),
    });
  }

  const positiveWeeks = records.filter((week) => (week.positiveQuantity ?? 0) > 0).length;
  const pattern: DemandPattern = positiveWeeks / records.length >= EPIC3_POLICY.steadyPositiveFraction
    ? "Steady seller"
    : "Occasional seller";
  const label: DemandReadinessLabel = records.length === EPIC3_POLICY.labelWindowWeeks ? "Ready" : "Limited";
  return Object.freeze({
    label,
    reason: label === "Limited"
      ? Object.freeze({
        code: "INSUFFICIENT_RECORDED_WEEKS" as const,
        message: `Only ${records.length} of the last 8 weeks have records`,
        recordedWeekCount: records.length,
      })
      : undefined,
    records: Object.freeze(records),
    pattern,
  });
}

function completedRecordedHistory(timeline: ProductTimeline, originDate: string): readonly WeeklyEvidence[] {
  return Object.freeze(timeline.weeks.filter((week) => isRecorded(week) && week.weekEnd < originDate));
}

function positiveQuantity(week: WeeklyEvidence): number {
  return Math.max(0, week.positiveQuantity ?? 0);
}

function recentMeanPoint(records: readonly WeeklyEvidence[]): PointForecast {
  const weeklyMean = records.reduce((sum, week) => sum + positiveQuantity(week), 0) / records.length;
  return Object.freeze({
    value: weeklyMean * EPIC3_POLICY.horizonWeeks,
    basedOn: records,
  });
}

/** Teunter-Syntetos-Babai forecast. Recorded zeros update occurrence; missing weeks never do. */
function tsbPoint(history: readonly WeeklyEvidence[]): PointForecast {
  const initial = history.slice(0, Math.min(8, history.length));
  const initialPositive = initial.map(positiveQuantity).filter((value) => value > 0);
  let demandSize = initialPositive.length > 0
    ? initialPositive.reduce((sum, value) => sum + value, 0) / initialPositive.length
    : 0;
  let occurrenceProbability = initial.length > 0
    ? initialPositive.length / initial.length
    : 0;

  for (const week of history.slice(initial.length)) {
    const value = positiveQuantity(week);
    const occurrence = value > 0 ? 1 : 0;
    occurrenceProbability += EPIC3_POLICY.tsbOccurrenceBeta * (occurrence - occurrenceProbability);
    if (occurrence === 1) {
      demandSize += EPIC3_POLICY.tsbDemandAlpha * (value - demandSize);
    }
  }

  return Object.freeze({
    value: Math.max(0, occurrenceProbability * demandSize * EPIC3_POLICY.horizonWeeks),
    basedOn: history,
  });
}

function forecastForMethod(
  method: DemandForecastMethod,
  timeline: ProductTimeline,
  originDate: string,
  assessment: Assessment,
): PointForecast | undefined {
  if (assessment.label === "Cannot assess") return undefined;
  if (method === "recent_mean_8") return recentMeanPoint(assessment.records);
  const history = completedRecordedHistory(timeline, originDate);
  return history.length > 0 ? tsbPoint(history) : undefined;
}

function targetTotal(
  timeline: ProductTimeline,
  originDate: string,
): number | undefined {
  const indexed = weekByStart(timeline);
  const target = Array.from(
    { length: EPIC3_POLICY.horizonWeeks },
    (_, index) => indexed.get(addCalendarDays(isoWeekStart(originDate), index * 7)),
  );
  if (!target.every(isRecorded)) return undefined;
  return target.reduce((sum, week) => sum + positiveQuantity(week), 0);
}

/** Earlier outcomes finish before the current origin, so the range cannot see its answer. */
function historicalErrors(
  timeline: ProductTimeline,
  originDate: string,
  method: DemandForecastMethod,
): readonly number[] {
  const errors: number[] = [];
  const currentWeekStart = isoWeekStart(originDate);
  for (let step = EPIC3_POLICY.maximumHistoricalErrors; step >= 1; step -= 1) {
    const historicalOrigin = addCalendarDays(currentWeekStart, -step * EPIC3_POLICY.horizonWeeks * 7);
    const assessment = assessAt(timeline, historicalOrigin, false);
    const point = forecastForMethod(method, timeline, historicalOrigin, assessment);
    const actual = targetTotal(timeline, historicalOrigin);
    if (point !== undefined && actual !== undefined) errors.push(actual - point.value);
  }
  return Object.freeze(errors);
}

function sampleStandardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function buildRange(
  point: PointForecast,
  assessment: Assessment,
  errors: readonly number[],
  method: DemandForecastMethod,
): DemandRangeEvidence {
  let halfWidth: number;
  let intervalMethod: DemandRangeEvidence["intervalMethod"];
  if (errors.length >= EPIC3_POLICY.minimumHistoricalErrors) {
    halfWidth = Math.max(...errors.map(Math.abs)) * EPIC3_POLICY.historicalErrorMultiplier;
    intervalMethod = "symmetric_max_abs_historical_error_x1_5";
  } else {
    const deviation = sampleStandardDeviation(assessment.records.map(positiveQuantity));
    const patternFactor = assessment.pattern === "Occasional seller" ? 1.5 : 1;
    halfWidth = EPIC3_POLICY.variabilityZ * Math.sqrt(EPIC3_POLICY.horizonWeeks) * deviation * patternFactor;
    intervalMethod = "recent_variability_fallback";
  }

  const unroundedLow = Math.max(0, point.value - halfWidth);
  const unroundedHigh = Math.max(point.value, point.value + halfWidth);
  const low = Math.floor(Math.min(unroundedLow, point.value));
  const high = Math.ceil(Math.max(unroundedHigh, point.value));
  const first = point.basedOn[0];
  const last = point.basedOn[point.basedOn.length - 1];
  return Object.freeze({
    low,
    high,
    unroundedCentral: point.value,
    unroundedLow,
    unroundedHigh,
    horizonWeeks: 4,
    basedOnWeekCount: point.basedOn.length,
    firstWeekUsed: first.weekStart,
    lastWeekUsed: last.weekEnd,
    method,
    intervalMethod,
    historicalErrorCount: errors.length,
  });
}

/** Produces the complete Epic 3 result for one product without UI or stock dependencies. */
export function estimateProductDemand(
  timeline: ProductTimeline,
  analysisDate: string,
  options: EstimateProductDemandOptions = {},
): ProductDemandEstimate {
  const assessment = assessAt(timeline, analysisDate, options.duplicateRowsNotDecided ?? false);
  const base = {
    productKey: timeline.productKey,
    label: assessment.label,
    labelReason: assessment.reason,
    recordedWeeksInLast8: assessment.records.length,
    policyVersion: EPIC3_POLICY_VERSION,
  } as const;
  if (assessment.label === "Cannot assess" || assessment.pattern === undefined) {
    return Object.freeze(base);
  }

  const method: DemandForecastMethod = assessment.pattern === "Steady seller"
    ? "recent_mean_8"
    : "tsb_alpha_0_2_beta_0_2";
  const point = forecastForMethod(method, timeline, analysisDate, assessment);
  if (!point) throw new Error(`Epic 3 policy could not forecast eligible product ${timeline.productKey}.`);
  const errors = historicalErrors(timeline, analysisDate, method);
  return Object.freeze({
    ...base,
    pattern: assessment.pattern,
    range: buildRange(point, assessment, errors, method),
  });
}

/** Orchestrates one deterministic Epic 3 result per product timeline. */
export function buildDemandForecastReview(snapshot: ReadinessSnapshot): DemandForecastReview {
  const duplicateBlocked = new Set(snapshot.productLimitations
    .filter((limitation) => limitation.code === "DUPLICATE_UNRESOLVED")
    .map((limitation) => limitation.productKey));
  const timelineByProduct = new Map(
    buildProductTimelines(snapshot).map((timeline) => [timeline.productKey, timeline]),
  );
  const productKeys = [...new Set(snapshot.rows
    .map((row) => row.productKey)
    .filter((productKey): productKey is string => productKey !== undefined))].sort();
  const products = productKeys.map((productKey): ProductDemandEstimate => {
    const timeline = timelineByProduct.get(productKey);
    if (timeline) {
      return estimateProductDemand(timeline, snapshot.analysisDate, {
        duplicateRowsNotDecided: duplicateBlocked.has(productKey),
      });
    }
    const duplicateRowsNotDecided = duplicateBlocked.has(productKey);
    return Object.freeze({
      productKey,
      label: "Cannot assess",
      labelReason: Object.freeze(duplicateRowsNotDecided
        ? {
          code: "DUPLICATE_ROWS_NOT_DECIDED" as const,
          message: "Duplicate rows not yet decided",
        }
        : {
          code: "INSUFFICIENT_RECORDED_WEEKS" as const,
          message: "Only 0 of the last 8 weeks have records",
          recordedWeekCount: 0,
        }),
      recordedWeeksInLast8: 0,
      policyVersion: EPIC3_POLICY_VERSION,
    });
  });
  return Object.freeze({
    snapshotId: snapshot.id,
    analysisDate: snapshot.analysisDate,
    policyVersion: EPIC3_POLICY_VERSION,
    products: Object.freeze(products),
  });
}
