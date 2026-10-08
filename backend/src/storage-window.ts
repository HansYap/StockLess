import { calendarDaysBetween, parseIsoDate } from './dates.ts';

export type StorageMode = 'pantry' | 'refrigerate' | 'freeze';
export interface FoodKeeperProduct { readonly id: string; readonly name: string; readonly categoryId: number; readonly windows: Readonly<Partial<Record<StorageMode, { readonly minDays: number; readonly maxDays: number }>>>; readonly version: '128'; readonly provenance?: string }
export interface StorageWindowSelection { readonly confirmed: boolean; readonly storage: StorageMode; readonly productId?: string; readonly categoryId?: number; readonly declined?: boolean }
export type StorageWindowResult = { readonly state: 'estimated'; readonly days: number; readonly minDays?: number; readonly maxDays?: number; readonly method: 'product_pick' | 'category_p25'; readonly source: string; readonly limitation: string; readonly productName?: string }
  | { readonly state: 'unavailable'; readonly reason: string; readonly correctiveAction: string };
export interface FoodKeeperAggregate { readonly categoryId: number; readonly storage: StorageMode; readonly p25MinimumDays: number; readonly productCount: number }
export function resolveStorageWindow(selection: StorageWindowSelection | undefined, products: readonly FoodKeeperProduct[] = [], aggregates: readonly FoodKeeperAggregate[] = []): StorageWindowResult {
  const none = (reason: string): StorageWindowResult => ({ state: 'unavailable', reason, correctiveAction: 'Confirm a FoodKeeper product and storage method. No actual expiry date is invented.' });
  if (!selection || !selection.confirmed || selection.declined) return none('Storage guidance was not confirmed or was declined.');
  const limitation = 'Estimated US FoodKeeper guidance; not Malaysian guidance or an actual expiry date.';
  if (selection.productId) {
    const product = products.find(p => p.id === selection.productId && p.version === '128');
    const window = product?.windows[selection.storage];
    if (product && selection.categoryId !== undefined && product.categoryId !== selection.categoryId) return none('The selected product does not belong to the confirmed storage category.');
    if (!window || !Number.isFinite(window.minDays) || window.minDays <= 0 || !Number.isFinite(window.maxDays) || window.maxDays < window.minDays) return none('No verified storage window for this product and storage method.');
    return { state: 'estimated', days: window.minDays, ...window, method: 'product_pick', source: `USDA FoodKeeper v128${product!.provenance ? '; ' + product!.provenance : ''}`, limitation, productName: product!.name };
  }
  if (selection.storage === 'pantry') return none('Pantry storage needs a product pick; category-level pantry estimates are not supported.');
  const aggregate = aggregates.find(p => p.categoryId === selection.categoryId && p.storage === selection.storage);
  if (!aggregate || !Number.isFinite(aggregate.p25MinimumDays) || aggregate.p25MinimumDays <= 0) return none('No sourced FoodKeeper category guidance available.');
  return { state: 'estimated', days: aggregate.p25MinimumDays, method: 'category_p25', source: 'FoodKeeper v128; CP3 e4_category_spread.csv P25 of product minimum', limitation };
}
export type RestockAge = { readonly state: 'entered'; readonly date: string; readonly elapsedDays: number; readonly source: 'Your date' } | { readonly state: 'unavailable'; readonly reason: string };
export function restockElapsedDays(date: string | undefined, analysisDate: string): RestockAge {
  if (!parseIsoDate(analysisDate)) throw new Error('Valid analysis date required.');
  if (!date) return { state: 'unavailable', reason: 'No restock date entered.' };
  if (!parseIsoDate(date) || date > analysisDate) return { state: 'unavailable', reason: 'Enter a valid restock date on or before the analysis date.' };
  return { state: 'entered', date, elapsedDays: calendarDaysBetween(date, analysisDate), source: 'Your date' };
}
