import type { ConfirmedDateFormat } from "./contracts.ts";

export interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const DAY_MILLISECONDS = 86_400_000;

/** Returns whether the supplied parts describe a supported calendar date. */
function isCalendarDate(parts: DateParts): boolean {
  if (parts.year < 1900 || parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return date.getUTCFullYear() === parts.year
    && date.getUTCMonth() === parts.month - 1
    && date.getUTCDate() === parts.day;
}

/** Parses a strict ISO date-only value without applying a browser timezone. */
export function parseIsoDate(value: string): DateParts | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const parts = Object.freeze({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  });
  return isCalendarDate(parts) ? parts : undefined;
}

/** Formats calendar parts as a strict ISO date-only value. */
export function formatIsoDate(parts: DateParts): string {
  if (!isCalendarDate(parts)) throw new Error("Cannot format an invalid calendar date.");
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

/** Parses a date using one retailer-confirmed, column-level format. */
export function parseConfirmedDate(
  value: string,
  format: ConfirmedDateFormat,
): DateParts | undefined {
  const separator = format.includes("/") ? "/" : format.includes(".") ? "." : "-";
  const escapedSeparator = separator === "." ? "\\." : separator;
  const match = new RegExp(`^(\\d{1,2})${escapedSeparator}(\\d{1,2})${escapedSeparator}(\\d{4})$`).exec(value);
  if (!match) return undefined;
  const dayFirst = format.startsWith("DD");
  const parts = Object.freeze({
    year: Number(match[3]),
    month: Number(match[dayFirst ? 2 : 1]),
    day: Number(match[dayFirst ? 1 : 2]),
  });
  return isCalendarDate(parts) ? parts : undefined;
}

/** Converts a valid ISO date into a timezone-independent day number. */
function isoDayNumber(value: string): number {
  const parts = parseIsoDate(value);
  if (!parts) throw new Error(`Invalid ISO date: ${value}.`);
  return Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MILLISECONDS;
}

/** Returns the signed calendar-day distance between two ISO dates. */
export function calendarDaysBetween(earlier: string, later: string): number {
  return isoDayNumber(later) - isoDayNumber(earlier);
}

/** Adds whole calendar days to an ISO date without local-time conversion. */
export function addCalendarDays(value: string, days: number): string {
  if (!Number.isInteger(days)) throw new Error("Calendar-day offset must be an integer.");
  const date = new Date((isoDayNumber(value) + days) * DAY_MILLISECONDS);
  return formatIsoDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

/** Returns the Monday ISO week start containing a valid ISO date. */
export function isoWeekStart(value: string): string {
  const date = new Date(isoDayNumber(value) * DAY_MILLISECONDS);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return addCalendarDays(value, -mondayOffset);
}
