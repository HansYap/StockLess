import {
  addCalendarDays,
  buildDemandForecastReview,
  type ReadinessSnapshot,
  type ValidatedRow,
} from "../src/engine.ts";
export function makeEvidence() {
  const rows: ValidatedRow[] = [];
  const series: Record<string, (number | null)[]> = {
    A: [5, 7, 6, 4, 5, 6, 8, 7],
    B: [4, null, 7, 0, 3, 5, null, 6],
    C: [null, 3, null, null, 4, null, null, 5],
  };
  for (const [key, values] of Object.entries(series))
    values.forEach((value, i) => {
      if (value === null) return;
      rows.push({
        sourceRow: rows.length + 2,
        productKey: key,
        originalValues: [],
        normalizedValues: [],
        interpretedValues: {
          transactionDate: addCalendarDays("2026-07-20", i * 7),
          quantitySold: value,
          productCode:
            key === "A" ? "000101" : key === "B" ? "000202" : "000303",
          productName: key === "C" ? "Few records" : "Same product name",
          currentStock: 12,
          stockAsOfDate: "2026-09-10",
        },
        duplicateFingerprint: `row-${rows.length}`,
        useState: "used",
        issueIds: [],
      });
    });
  const snapshot: ReadinessSnapshot = {
    id: "snapshot-test",
    sourceMode: "user",
    sourceName: "test.csv",
    sourceSha256: "test",
    analysisDate: "2026-09-14",
    rows,
    issues: [],
    normalizations: [],
    duplicateGroups: [],
    productLimitations: [],
    reconciliation: {
      rowsIn: rows.length,
      rowsUsed: rows.length,
      rowsExcluded: 0,
      rowsSafelyNormalized: 0,
    },
    productStock: Object.keys(series).map((productKey) => ({
      productKey,
      currentStock: 12,
      stockAsOfDate: "2026-09-10",
      freshness: {
        analysisDate: "2026-09-14",
        snapshotDate: "2026-09-10",
        ageDays: 4,
        state: "current",
      },
      usableForCover: true,
      reasonCodes: [],
    })),
  };
  return { snapshot, forecast: buildDemandForecastReview(snapshot) };
}
