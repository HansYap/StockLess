import type { ReadinessSnapshot } from './contracts.ts';
import { parsePackQuantity } from './cp3-mass.ts';
import { activePlanningContext, type PlanningContexts, type ProductPlanningContext } from './planning-context.ts';
import { PRICECATCHER_REFERENCES } from './reference-data/cp3-prices.ts';
import { rankMissingCostRequests, type ImpactReview } from './impact.ts';

/** A reference retail price is used solely to prioritise missing seller-cost requests. */
export function resolveReferencePrice(snapshot: ReadinessSnapshot, productKey: string, original?: ProductPlanningContext) {
  const context = activePlanningContext(snapshot, original);
  const ref = PRICECATCHER_REFERENCES.find(r => r.itemCode === context?.priceCatcherItemCode);
  const none = (reason: string) => ({ state: 'unavailable' as const, reason });
  if (!ref) return none('Choose and confirm a matching PriceCatcher reference item. Shop product codes are not PriceCatcher codes.');
  if (ref.priceMYR === null || !Number.isFinite(ref.priceMYR) || ref.priceMYR < 0) return none('No stable reference price is available for this item. Enter seller cost manually.');
  const row = snapshot.rows.find(r => r.productKey === productKey)?.interpretedValues;
  if (!row || snapshot.productLimitations.some(r => r.productKey === productKey && r.code === 'IDENTITY_CONFLICT')) return none('Resolve product identity before matching a reference price.');
  const sales = parsePackQuantity(row.packVariant ?? ''), reference = parsePackQuantity(ref.unit);
  let multiplier: number | undefined;
  if (sales.state === 'available' && reference.state === 'available' && sales.dimension === reference.dimension) multiplier = sales.quantity / reference.quantity;
  // A measured sales-unit weight also establishes compatibility with a kg reference.
  if (multiplier === undefined && reference.state === 'available' && reference.dimension === 'kg') {
    const weight = snapshot.productWeights?.find(r => r.productKey === productKey);
    const kg = context?.kgPerUnit ?? (weight?.state === 'usable' ? weight.value : undefined);
    if (kg !== undefined && Number.isFinite(kg) && kg > 0) multiplier = kg / reference.quantity;
  }
  const norm = (s: string) => s.toLowerCase().normalize('NFKC').trim().replace(/\s+/g, ' ');
  // Identical count units are safe only after an explicit reference-item choice.
  if (multiplier === undefined && sales.state === 'unavailable' && reference.state === 'unavailable'
    && norm(ref.unit) && norm(row.packVariant ?? '') === norm(ref.unit)) multiplier = 1;
  if (multiplier === undefined || !Number.isFinite(multiplier) || multiplier <= 0) return none('Reference and sales units cannot be reconciled. Confirm the pack size or measured weight; no generic unit conversion is assumed.');
  const price = ref.priceMYR * multiplier;
  if (!Number.isFinite(price) || price > Number.MAX_SAFE_INTEGER) return none('Reference amount exceeds the supported numeric range.');
  return { state: 'available' as const, price, referenceOnly: true as const, itemCode: ref.itemCode,
    source: `${ref.provenance}; item ${ref.itemCode} ${ref.name}; MYR ${ref.priceMYR}/${ref.unit}; ${ref.basis}; ${ref.sampleCount} observations; pack multiplier ${multiplier}. Reference retail price, never seller purchase cost.` };
}

export function buildMissingCostQueue(snapshot: ReadinessSnapshot, impact: ImpactReview, contexts: PlanningContexts = {}) {
  const references = Object.fromEntries(impact.products.map(p => {
    const ref = resolveReferencePrice(snapshot, p.productKey, contexts[p.productKey]);
    return [p.productKey, ref.state === 'available' ? { price: ref.price, source: ref.source } : undefined];
  }));
  return rankMissingCostRequests(impact.products, references);
}
