import { calendarDaysBetween, parseIsoDate } from './dates.ts';

export interface ExpiryBatch { readonly date: string; readonly quantity: number; readonly stockAsOfDate: string; readonly sourceRows?: readonly number[] }
export type ExpiryRisk =
  | { readonly state: 'estimated'; readonly quantity: number; readonly low: number; readonly high: number; readonly checkedQuantity: number; readonly method: 'FEFO at midpoint demand'; readonly batches: readonly ExpiryBatch[] }
  | { readonly state: 'not_checked' | 'cannot_tell'; readonly reason: string; readonly correctiveAction: string };

/** Earliest-expiry stock sells first. Past-dated batches are fully at risk. */
export function fefoRemaining(batches: readonly ExpiryBatch[], unitsPerDay: number, analysisDate: string): number {
  if (!parseIsoDate(analysisDate) || !Number.isFinite(unitsPerDay) || unitsPerDay < 0) throw new Error('Valid analysis date and non-negative demand rate required.');
  if (batches.some(b => !parseIsoDate(b.date) || !Number.isFinite(b.quantity) || b.quantity < 0)) throw new Error('Invalid expiry batch.');
  let sold = 0, remaining = 0;
  for (const batch of [...batches].sort((a,b) => a.date.localeCompare(b.date))) {
    const days = calendarDaysBetween(analysisDate, batch.date);
    if (days < 0) { remaining += batch.quantity; continue; }
    const sale = Math.min(batch.quantity, Math.max(0, unitsPerDay * days - sold));
    sold += sale; remaining += batch.quantity - sale;
  }
  return remaining;
}

export function estimateExpiryRisk(input: { analysisDate: string; stock?: number; stockAsOfDate?: string; low?: number; high?: number; batches?: readonly ExpiryBatch[]; reason?: string }): ExpiryRisk {
  if (!parseIsoDate(input.analysisDate)) throw new Error('Valid analysis date required.');
  const unavailable = (reason: string): ExpiryRisk => ({ state: 'not_checked', reason, correctiveAction: 'Provide dated batch quantities linked to the current stock count, covering all current stock.' });
  if (!input.batches?.length) return unavailable(input.reason ?? 'Expiry not checked: no linked batch quantities.');
  if (input.reason) return unavailable(input.reason);
  if (input.stock === undefined || !Number.isFinite(input.stock) || input.stock < 0 || !input.stockAsOfDate || !parseIsoDate(input.stockAsOfDate) || input.stockAsOfDate > input.analysisDate) return unavailable('Expiry not checked: current stock evidence is missing.');
  if (input.batches.some(b => !parseIsoDate(b.date) || b.stockAsOfDate !== input.stockAsOfDate || !Number.isFinite(b.quantity) || b.quantity < 0)) return unavailable('Expiry batches do not match the current stock count.');
  const checkedQuantity = input.batches.reduce((sum,b) => sum + b.quantity, 0);
  if (Math.abs(checkedQuantity - input.stock) > 1e-9 * Math.max(1, input.stock)) return unavailable('Batch quantities must reconcile to current stock; partial or duplicated batches cannot be assessed.');
  if (input.low === undefined || input.high === undefined || !Number.isFinite(input.low) || !Number.isFinite(input.high) || input.low < 0 || input.high < input.low) return unavailable('Expiry not checked: a valid demand range is required.');
  if (input.low === 0) return { state: 'cannot_tell', reason: 'Cannot tell how much will expire: demand could be zero', correctiveAction: 'Review more sales history. Only the Before restock amount is shown.' };
  const mid = Math.round((input.low + input.high) / 2);
  const rounded = (rate: number) => Math.max(0, Math.min(Math.ceil(input.stock!), Math.ceil(fefoRemaining(input.batches!, rate, input.analysisDate) - 1e-10)));
  return Object.freeze({ state: 'estimated', quantity: rounded(mid / 28), low: rounded(input.high / 28), high: rounded(input.low / 28), checkedQuantity, method: 'FEFO at midpoint demand', batches: Object.freeze([...input.batches]) });
}
