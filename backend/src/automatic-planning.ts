import type { ReadinessSnapshot } from './contracts.ts';
import { suggestProductCategory, type CategorySuggestion } from './cp3-category.ts';
import { activePlanningContext, type ProductPlanningContext } from './planning-context.ts';
import { PRICECATCHER_REFERENCES } from './reference-data/cp3-prices.ts';
import { FOODKEEPER_AGGREGATES, FOODKEEPER_PRODUCTS, FOODKEEPER_REFERENCE_SOURCE } from './reference-storage-data.ts';

const suggestions = new Map<string, CategorySuggestion>();
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Derived on current source evidence; never saves a guessed cost, actual storage or manual confirmation. */
export function resolveProductPlanningContext(snapshot: ReadinessSnapshot, productKey: string, original?: ProductPlanningContext): ProductPlanningContext | undefined {
  const active = activePlanningContext(snapshot, original);
  if (!snapshot.evidenceKey) return active;
  const row = snapshot.rows.find(row => row.productKey === productKey)?.interpretedValues;
  const blocked = snapshot.productLimitations.some(item => item.productKey === productKey && item.code === 'IDENTITY_CONFLICT')
    || snapshot.issues.some(item => item.productKey === productKey && item.issueCode === 'PRODUCT_IDENTITY_CONFLICT' && item.resolutionState === 'unresolved');
  if (!row || blocked) return active?.categorySource === 'ai' ? undefined : active;
  let context: ProductPlanningContext = { ...active, evidenceKey: snapshot.evidenceKey };
  if (!active?.categoryConfirmed) {
    const name = row.productName ?? '';
    let suggestion = suggestions.get(name);
    if (!suggestion) {
      suggestion = suggestProductCategory(name);
      if (suggestions.size >= 1000) suggestions.clear();
      suggestions.set(name, suggestion);
    }
    context = { ...context, category: suggestion.state === 'suggested' ? suggestion.category : undefined,
      categoryConfirmed: false, isFood: suggestion.state === 'suggested' ? true : undefined,
      categorySource: suggestion.state === 'suggested' ? 'ai' : undefined,
      categoryProvenance: suggestion.state === 'suggested' ? `${suggestion.evidence.modelVersion}; model and supported keyword rules agree; automatic estimate; evidence ${snapshot.evidenceKey}` : undefined };
  }
  // Shop SKUs never act as reference IDs. Only one exact supported name match is accepted;
  // reference-price.ts separately verifies the sales-unit conversion before using its price.
  if (!context.priceCatcherItemCode && row.productName) {
    const matches = PRICECATCHER_REFERENCES.filter(item => normalize(item.name) === normalize(row.productName!));
    if (matches.length === 1) context = { ...context, priceCatcherItemCode: matches[0].itemCode };
  }
  return context;
}

/** Broad reference advice, independent of ordering. It never asserts the owner's actual storage condition. */
export function automaticStorageAdvice(snapshot: ReadinessSnapshot, productKey: string, original?: ProductPlanningContext) {
  const context = resolveProductPlanningContext(snapshot, productKey, original);
  if (!context?.category || context.isFood === false) return undefined;
  const ids = new Set(PRICECATCHER_REFERENCES.filter(item => item.category === context.category).map(item => item.foodKeeperCategoryId));
  if (ids.size !== 1) return undefined;
  const categoryId = [...ids][0];
  const windows = FOODKEEPER_AGGREGATES.filter(item => item.categoryId === categoryId);
  if (!windows.length) return undefined;
  return { categoryName: FOODKEEPER_PRODUCTS.find(item => item.categoryId === categoryId)?.categoryName ?? context.category,
    windows: windows.map(item => ({ storage: item.storage, days: item.p25MinimumDays })), source: FOODKEEPER_REFERENCE_SOURCE,
    mappingSource: PRICECATCHER_REFERENCES.find(item => item.category === context.category)?.mappingProvenance,
    limitation: 'FoodKeeper category references; not an actual expiry date or evidence of storage conditions. No automatic order limit is applied.' };
}
