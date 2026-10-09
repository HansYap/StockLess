import type { ReadinessSnapshot } from './contracts.ts';
import { resolveProductMass, type ResolvedProductMass } from './cp3-mass.ts';
import { parsePriceCatcherPieceMass } from './piece-mass.ts';
import { resolveStorageWindow, type StorageWindowSelection } from './storage-window.ts';
import { FOODKEEPER_AGGREGATES, FOODKEEPER_PRODUCTS } from './reference-storage-data.ts';

export interface ProductPlanningContext {
  readonly evidenceKey: string;
  readonly category?: string;
  readonly categoryConfirmed?: boolean;
  /** Derived AI estimates are distinct from a retailer's explicit confirmation. */
  readonly categorySource?: 'ai' | 'manual';
  readonly categoryProvenance?: string;
  readonly isFood?: boolean;
  readonly unitCost?: number;
  /** Retailer's selling price per sales unit (MYR); only for the estimated sales value, never a cost. */
  readonly sellingPrice?: number;
  readonly kgPerUnit?: number;
  readonly restockDate?: string;
  readonly storageSelection?: StorageWindowSelection;
  /** Explicit reference-item choice; a shop SKU is never treated as a PriceCatcher code. */
  readonly priceCatcherItemCode?: string;
}
export type PlanningContexts = Readonly<Record<string, ProductPlanningContext | undefined>>;
export function activePlanningContext(snapshot: ReadinessSnapshot, context: ProductPlanningContext | undefined) {
  return snapshot.evidenceKey && context?.evidenceKey === snapshot.evidenceKey ? context : undefined;
}
export function applyPlanningContexts(snapshot: ReadinessSnapshot, contexts: PlanningContexts): ReadinessSnapshot {
  const costs = [...(snapshot.productCosts ?? [])], weights = [...(snapshot.productWeights ?? [])];
  for (const [productKey, original] of Object.entries(contexts)) {
    const context = activePlanningContext(snapshot, original);
    if (!context || !snapshot.rows.some(r => r.productKey === productKey)) continue;
    for (const [field, value, evidence] of [['unit_cost',context.unitCost,costs],['unit_weight_kg',context.kgPerUnit,weights]] as const) {
      if (value === undefined) continue;
      if (!Number.isFinite(value) || value < 0 || (field === 'unit_weight_kg' && value === 0)) throw new Error('Enter a finite seller cost >= 0 and weight per sales unit > 0.');
      const entry = { productKey, field, state: 'usable' as const, value, sourceRows: [] as number[], sourceColumn: 'Explicitly entered by retailer for this checked product and sales unit' };
      const index = evidence.findIndex(p => p.productKey === productKey);
      if (index < 0) evidence.push(entry); else evidence[index] = entry;
    }
  }
  return { ...snapshot, productCosts: costs, productWeights: weights };
}
export function planningMass(snapshot: ReadinessSnapshot, productKey: string, original?: ProductPlanningContext, allowEstimatedDensity = false) {
  const context = activePlanningContext(snapshot, original);
  const row = snapshot.rows.find(r => r.productKey === productKey)?.interpretedValues;
  const weight = snapshot.productWeights?.find(p => p.productKey === productKey);
  if (context?.kgPerUnit === undefined && weight && ['invalid','conflicting'].includes(weight.state)) return { state: 'unavailable' as const, reason: 'Weight has invalid or conflicting source values; correct it or enter an explicit verified weight.', correctiveAction: 'Correct weight evidence.' };
  const result = resolveProductMass({ packText: row?.packVariant ?? '', productName: row?.productName,
    confirmedCategory: context?.categoryConfirmed || context?.categorySource === 'ai' ? context.category : undefined,
    manualKgPerUnit: context?.kgPerUnit ?? (weight?.state === 'usable' ? weight.value : undefined), allowEstimatedDensity });
  if (result.state === 'available') return weight?.state === 'usable' && context?.kgPerUnit === undefined
    ? { ...result, provenance: `Validated file weight: ${weight.sourceColumn ?? 'Weight per unit'}; source rows ${weight.sourceRows.join(', ')}` } : result;
  // The standalone reference API estimates ONE piece. Inventory units can be trays
  // or packs, so an explicit count is mandatory and is read only from packVariant.
  if (result.reasonCode !== 'count_unit' || !(context?.categoryConfirmed || context?.categorySource === 'ai') || !context.category || context.isFood === false
    || snapshot.productLimitations.some(item => item.productKey === productKey && item.code === 'IDENTITY_CONFLICT')) return result;
  const count = explicitPackPieceCount(row?.packVariant ?? '', context.category);
  if (count === undefined) return result;
  const piece = parsePriceCatcherPieceMass(row?.productName ?? '', context.category);
  if (piece.state !== 'available') return result;
  const kgPerUnit = piece.kgPerUnit * count;
  if (!Number.isFinite(kgPerUnit) || kgPerUnit <= 0 || kgPerUnit > Number.MAX_SAFE_INTEGER) return result;
  const estimate: ResolvedProductMass = Object.freeze({ state: 'available', kgPerUnit, method: 'piece_estimate',
    label: 'Estimated (PriceCatcher piece size)', approximate: true, category: context.category, sourceText: row?.packVariant,
    provenance: `${piece.provenance} Explicit sales-unit pack count: ${count} pieces from "${row?.packVariant}". ${count} × ${piece.kgPerUnit} kg/piece = ${kgPerUnit} kg/sales unit; bounded mass ${count * piece.low}–${count * piece.high} kg/sales unit. Piece calculation: ${piece.calculation}. This is a size estimate, not a measured pack weight.` });
  return estimate;
}

/** No tray/carton/dozen size is assumed, and count-per-kg text cannot match this grammar. */
function explicitPackPieceCount(pack: string, category: string): number | undefined {
  const text = pack.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
  const one = text === 'sebiji' ? 1 : text === 'seekor' ? 1 : undefined;
  if (one !== undefined) return one;
  const match = text.match(/^(?:pack of\s+)?(\d+)\s*(pieces?|pcs?|biji|eggs?|ekor|fish|prawns?)$/);
  if (!match) return undefined;
  const count = Number(match[1]), unit = match[2];
  if (!Number.isSafeInteger(count) || count <= 0) return undefined;
  if (/^eggs?$/.test(unit) && category !== 'eggs' && !/^eggs_chicken_grade_[abc]$/.test(category)) return undefined;
  if (unit === 'fish' && !['fresh_fish', 'fresh_fish_wild', 'fresh_fish_farmed'].includes(category)) return undefined;
  if (/^prawns?$/.test(unit) && category !== 'prawns') return undefined;
  return count;
}
export function planningStorageWindow(snapshot: ReadinessSnapshot, context?: ProductPlanningContext) {
  return resolveStorageWindow(activePlanningContext(snapshot, context)?.storageSelection, FOODKEEPER_PRODUCTS, FOODKEEPER_AGGREGATES);
}
