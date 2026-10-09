import { activePlanningContext, resolveProductPlanningContext, applyPlanningContexts, CP3_CATEGORY_DICTIONARY, estimatePurchaseCost, planningMass, planningStorageWindow, suggestProductCategory,
  type PlanningContexts, type ProductPlanningContext, type ReadinessSnapshot } from "../engine.ts";
import type { PurchaseProduct } from "../purchase-plan/model.ts";

export type PlanningDetail = "category" | "cost" | "weight" | "storage" | "other";
export const foodCategories: readonly string[] = [...new Set(CP3_CATEGORY_DICTIONARY.filter(row => row.isFood).map(row => row.category))].sort();
export const categoryLabel = (category: string) => category.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
export function productEstimateDetails(snapshot: ReadinessSnapshot, key: string, value?: ProductPlanningContext) {
  const active = resolveProductPlanningContext(snapshot, key, value);
  const categoryConfirmed = !!active?.categoryConfirmed && !!active.category;
  const notFood = categoryConfirmed && (active?.isFood === false || active?.category === "non_food");
  const cost = estimatePurchaseCost(applyPlanningContexts(snapshot, { [key]: active }), key, 1);
  const mass = planningMass(snapshot, key, active, true), storage = planningStorageWindow(snapshot, active);
  const missing: PlanningDetail[] = [];
  if (!categoryConfirmed && active?.categorySource !== 'ai') missing.push("category");
  if (cost.state !== "estimated") missing.push("cost");
  if (!notFood && mass.state !== "available") missing.push("weight");
  return { active, categoryConfirmed, notFood, cost, mass, storage, missing };
}

export function suggestedCategoryRows(snapshot: ReadinessSnapshot, products: readonly PurchaseProduct[], contexts: PlanningContexts) {
  const evidenceKey = snapshot.evidenceKey;
  if (!evidenceKey) return [];
  return products.flatMap(product => {
    const active = activePlanningContext(snapshot, contexts[product.key]);
    if (product.issue || (active?.categoryConfirmed && active.category)) return [];
    const suggestion = suggestProductCategory(product.name);
    return suggestion.state === "suggested" && suggestion.category
      ? [{ product, category: suggestion.category, context: { ...active, evidenceKey, category: suggestion.category, categoryConfirmed: true, isFood: true } satisfies ProductPlanningContext }]
      : [];
  });
}
