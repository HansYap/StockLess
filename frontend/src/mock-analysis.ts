/**
 * Mock analysis layer.
 *
 * Computes readiness and weekly demand from the parsed dataset so screens 3
 * and 4 behave for real. Swap for the engine's own exports when they land.
 */
import type { CanonicalField, MappingState, ParsedDataset } from "./engine.mock.ts";

/* ── types ──────────────────────────────────────────────────────────────── */

export type IssueKind = "invalid_date" | "invalid_quantity" | "duplicate_row" | "missing_value";

export interface IssueSummary {
  readonly kind: IssueKind;
  readonly label: string;
  readonly hint: string;
  readonly severity: "fix" | "review";
  readonly count: number;
}

export interface CorrectionRow {
  readonly sourceRow: number;
  readonly kind: IssueKind;
  readonly issueLabel: string;
  readonly foundValue: string;
  readonly howToFix: string;
}

export interface TimelineWarning {
  readonly title: string;
  readonly detail: string;
}

export interface ReadinessResult {
  readonly totalRows: number;
  readonly usableRows: number;
  readonly issues: readonly IssueSummary[];
  readonly corrections: readonly CorrectionRow[];
  readonly warnings: readonly TimelineWarning[];
}

export interface WeekPoint {
  readonly label: string;
  /** null marks an observed gap: a week inside the range with no transactions. */
  readonly units: number | null;
}

export type ProductDataStatus = "complete" | "missing_week" | "stale_stock";

export interface ProductSummary {
  readonly key: string;
  readonly displayName: string;
  readonly weeks: readonly WeekPoint[];
  readonly recentWeeklyAverage: number | null;
  readonly currentStock: number | null;
  readonly stockAsOf: string | null;
  readonly weeksOfCover: number | null;
  readonly observedWeeks: number;
  readonly status: ProductDataStatus;
}

export interface DemandResult {
  readonly products: readonly ProductSummary[];
  /** True when no current-stock column was confirmed, so cover cannot be shown. */
  readonly coverUnavailable: boolean;
}

/* ── helpers ────────────────────────────────────────────────────────────── */

function indexOf(dataset: ParsedDataset, mapping: MappingState, field: CanonicalField): number | null {
  const id = mapping.mappings[field]?.sourceColumnId;
  if (!id) return null;
  return dataset.columns.find((column) => column.id === id)?.index ?? null;
}

function cell(row: readonly string[], index: number | null): string {
  return index === null ? "" : (row[index] ?? "").trim();
}

/** Accepts ISO or day/month/year and returns a UTC date, or null. */
function parseDate(value: string): Date | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return Number.isNaN(date.getTime()) || date.getUTCMonth() !== Number(iso[2]) - 1 ? null : date;
  }
  const dmy = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(value);
  if (dmy) {
    const date = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
    return Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(dmy[1]) ? null : date;
  }
  return null;
}

/** Monday of the week containing the given date. */
function weekStart(date: Date): Date {
  const copy = new Date(date.getTime());
  const day = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - day);
  return copy;
}

function weekLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function isNumber(value: string): boolean {
  return value !== "" && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value);
}

/* ── readiness ──────────────────────────────────────────────────────────── */

const ISSUE_META: Record<IssueKind, { label: string; hint: string; severity: "fix" | "review" }> = {
  invalid_date: { label: "Invalid dates", hint: "Rows cannot be placed on the timeline", severity: "fix" },
  invalid_quantity: { label: "Invalid quantities", hint: "Text, symbols or negatives in quantity", severity: "fix" },
  duplicate_row: { label: "Duplicate rows", hint: "Possible repeated transactions", severity: "review" },
  missing_value: { label: "Missing values", hint: "A confirmed field is blank", severity: "review" },
};

export function analyseReadiness(dataset: ParsedDataset, mapping: MappingState): ReadinessResult {
  const dateIndex = indexOf(dataset, mapping, "transaction_date");
  const qtyIndex = indexOf(dataset, mapping, "quantity_sold");
  const codeIndex = indexOf(dataset, mapping, "product_code");
  const nameIndex = indexOf(dataset, mapping, "product_name");
  const variantIndex = indexOf(dataset, mapping, "pack_variant");
  const stockIndex = indexOf(dataset, mapping, "current_stock");
  const stockDateIndex = indexOf(dataset, mapping, "stock_as_of_date");

  const counts: Record<IssueKind, number> = {
    invalid_date: 0, invalid_quantity: 0, duplicate_row: 0, missing_value: 0,
  };
  const corrections: CorrectionRow[] = [];
  const seen = new Set<string>();
  let usable = 0;

  for (const row of dataset.rows) {
    const values = row.normalizedValues;
    const rawDate = cell(values, dateIndex);
    const rawQty = cell(values, qtyIndex);
    const identity = mapping.identityMode === "stable"
      ? cell(values, codeIndex)
      : [cell(values, nameIndex), cell(values, variantIndex)].filter(Boolean).join("|");

    let ok = true;

    if (!identity) {
      counts.missing_value += 1;
      ok = false;
      corrections.push({
        sourceRow: row.sourceRow, kind: "missing_value",
        issueLabel: "Missing product", foundValue: "blank",
        howToFix: "Add a product name or code",
      });
    }

    const date = parseDate(rawDate);
    if (!date) {
      counts.invalid_date += 1;
      ok = false;
      corrections.push({
        sourceRow: row.sourceRow, kind: "invalid_date",
        issueLabel: "Invalid date", foundValue: rawDate || "blank",
        howToFix: "Enter a valid calendar date",
      });
    }

    if (!isNumber(rawQty)) {
      counts.invalid_quantity += 1;
      ok = false;
      corrections.push({
        sourceRow: row.sourceRow, kind: "invalid_quantity",
        issueLabel: "Invalid quantity", foundValue: rawQty || "blank",
        howToFix: "Replace text with a number",
      });
    } else if (Number(rawQty) < 0) {
      counts.invalid_quantity += 1;
      ok = false;
      corrections.push({
        sourceRow: row.sourceRow, kind: "invalid_quantity",
        issueLabel: "Negative quantity", foundValue: rawQty,
        howToFix: "Confirm whether this is a return, or correct the value",
      });
    }

    if (ok) {
      const key = `${identity}|${rawDate}|${rawQty}`;
      if (seen.has(key)) {
        counts.duplicate_row += 1;
        corrections.push({
          sourceRow: row.sourceRow, kind: "duplicate_row",
          issueLabel: "Possible duplicate", foundValue: `${identity} · ${rawDate}`,
          howToFix: "Confirm whether this sale repeats an earlier row",
        });
      } else {
        seen.add(key);
      }
      usable += 1;
    }
  }

  // Timeline warnings.
  const warnings: TimelineWarning[] = [];
  const weeks = new Set<number>();
  let earliest: Date | null = null;
  let latest: Date | null = null;
  for (const row of dataset.rows) {
    const date = parseDate(cell(row.normalizedValues, dateIndex));
    if (!date) continue;
    const start = weekStart(date);
    weeks.add(start.getTime());
    if (!earliest || start < earliest) earliest = start;
    if (!latest || start > latest) latest = start;
  }
  if (earliest && latest) {
    const span = Math.round((latest.getTime() - earliest.getTime()) / (7 * 86_400_000)) + 1;
    const missing = span - weeks.size;
    if (missing > 0) {
      warnings.push({
        title: `${missing} missing ${missing === 1 ? "week" : "weeks"}`,
        detail: "No transactions were recorded for some periods inside the range.",
      });
    }
  }
  if (stockIndex !== null && stockDateIndex !== null) {
    let newest: Date | null = null;
    for (const row of dataset.rows) {
      const date = parseDate(cell(row.normalizedValues, stockDateIndex));
      if (date && (!newest || date > newest)) newest = date;
    }
    if (newest && latest) {
      const age = Math.round((Date.now() - newest.getTime()) / 86_400_000);
      if (age > 14) {
        warnings.push({
          title: `Stock snapshot is ${age} days old`,
          detail: "Weeks of cover may not represent today's stock.",
        });
      }
    }
  }

  const issues: IssueSummary[] = (Object.keys(ISSUE_META) as IssueKind[]).map((kind) => ({
    kind,
    label: ISSUE_META[kind].label,
    hint: ISSUE_META[kind].hint,
    severity: ISSUE_META[kind].severity,
    count: counts[kind],
  }));

  return {
    totalRows: dataset.rows.length,
    usableRows: usable,
    issues,
    corrections,
    warnings,
  };
}

/** Renders the correction report as CSV text for download. */
export function correctionReportCsv(result: ReadinessResult): string {
  const header = "row,issue,found_value,how_to_fix";
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = result.corrections.map((row) =>
    [row.sourceRow, escape(row.issueLabel), escape(row.foundValue), escape(row.howToFix)].join(","),
  );
  return [header, ...lines].join("\n");
}

/* ── demand ─────────────────────────────────────────────────────────────── */

export function analyseDemand(dataset: ParsedDataset, mapping: MappingState): DemandResult {
  const dateIndex = indexOf(dataset, mapping, "transaction_date");
  const qtyIndex = indexOf(dataset, mapping, "quantity_sold");
  const codeIndex = indexOf(dataset, mapping, "product_code");
  const nameIndex = indexOf(dataset, mapping, "product_name");
  const variantIndex = indexOf(dataset, mapping, "pack_variant");
  const stockIndex = indexOf(dataset, mapping, "current_stock");
  const stockDateIndex = indexOf(dataset, mapping, "stock_as_of_date");

  interface Bucket {
    key: string;
    displayName: string;
    byWeek: Map<number, number>;
    stock: number | null;
    stockAsOf: string | null;
  }
  const buckets = new Map<string, Bucket>();
  let globalEarliest: Date | null = null;
  let globalLatest: Date | null = null;

  for (const row of dataset.rows) {
    const values = row.normalizedValues;
    const date = parseDate(cell(values, dateIndex));
    const rawQty = cell(values, qtyIndex);
    if (!date || !isNumber(rawQty) || Number(rawQty) < 0) continue;

    const code = cell(values, codeIndex);
    const name = cell(values, nameIndex);
    const variant = cell(values, variantIndex);
    const key = mapping.identityMode === "stable" ? code : [name, variant].filter(Boolean).join(" · ");
    if (!key) continue;

    const display = mapping.identityMode === "stable"
      ? [name, variant].filter(Boolean).join(" · ") || code
      : key;

    const bucket = buckets.get(key) ?? {
      key, displayName: display, byWeek: new Map<number, number>(), stock: null, stockAsOf: null,
    };
    const start = weekStart(date).getTime();
    bucket.byWeek.set(start, (bucket.byWeek.get(start) ?? 0) + Number(rawQty));

    const rawStock = cell(values, stockIndex);
    if (stockIndex !== null && isNumber(rawStock)) bucket.stock = Number(rawStock);
    const rawStockDate = cell(values, stockDateIndex);
    if (stockDateIndex !== null && rawStockDate) bucket.stockAsOf = rawStockDate;

    buckets.set(key, bucket);

    const startDate = new Date(start);
    if (!globalEarliest || startDate < globalEarliest) globalEarliest = startDate;
    if (!globalLatest || startDate > globalLatest) globalLatest = startDate;
  }

  const products: ProductSummary[] = [];

  for (const bucket of buckets.values()) {
    const times = [...bucket.byWeek.keys()].sort((a, b) => a - b);
    const first = times[0];
    const last = times[times.length - 1];
    const weeks: WeekPoint[] = [];

    if (first !== undefined && last !== undefined) {
      for (let t = first; t <= last; t += 7 * 86_400_000) {
        const units = bucket.byWeek.get(t);
        weeks.push({ label: weekLabel(new Date(t)), units: units === undefined ? null : units });
      }
    }

    const observed = weeks.filter((week) => week.units !== null);
    const recent = observed.slice(-8);
    const average = recent.length > 0
      ? recent.reduce((sum, week) => sum + (week.units ?? 0), 0) / recent.length
      : null;

    const cover = bucket.stock !== null && average !== null && average > 0
      ? bucket.stock / average
      : null;

    const stockAge = bucket.stockAsOf ? parseDate(bucket.stockAsOf) : null;
    const stale = stockAge !== null && (Date.now() - stockAge.getTime()) / 86_400_000 > 14;
    const hasGap = weeks.some((week) => week.units === null);

    products.push({
      key: bucket.key,
      displayName: bucket.displayName,
      weeks,
      recentWeeklyAverage: average,
      currentStock: bucket.stock,
      stockAsOf: bucket.stockAsOf,
      weeksOfCover: cover,
      observedWeeks: observed.length,
      status: hasGap ? "missing_week" : stale ? "stale_stock" : "complete",
    });
  }

  products.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return { products, coverUnavailable: stockIndex === null };
}
