import type { DemandForecastReview, ProductPurchaseInputs, ProductPurchasePlan, ReadinessSnapshot } from './contracts.ts';
import { buildPurchasePlanReview } from './purchase-plan.ts';
import { estimatePurchaseCost } from './product-values.ts';
import type { PlanningContexts } from './planning-context.ts';

export type MonetaryFigure = ReturnType<typeof estimatePurchaseCost>;
export function estimatePurchaseCommitments(snapshot: ReadinessSnapshot, productKey: string, inputs: ProductPurchaseInputs) {
  const incoming = inputs.incomingStock.state === 'value' ? inputs.incomingStock.value : undefined;
  const planned = inputs.plannedOrder.state === 'value' ? inputs.plannedOrder.value : undefined;
  return { incoming: estimatePurchaseCost(snapshot, productKey, incoming), planned: estimatePurchaseCost(snapshot, productKey, planned),
    combined: estimatePurchaseCost(snapshot, productKey, planned === undefined || incoming === undefined ? undefined : planned + incoming) };
}
export interface ImpactProduct {
  readonly productKey: string; readonly name: string; readonly code?: string; readonly pack?: string;
  readonly plan: ProductPurchasePlan; readonly plannedQuantity?: number; readonly available?: number; readonly demandHigh?: number;
  readonly excessUnits?: number; readonly shortfallUnits?: number; readonly scenarioQuantity?: number;
  readonly plannedSpend: MonetaryFigure; readonly incomingSpend: MonetaryFigure; readonly combinedCommitment: MonetaryFigure;
  readonly excessCost: MonetaryFigure; readonly scenarioSpend: MonetaryFigure; readonly spendDifference: MonetaryFigure;
  readonly exclusionReason?: string;
}
export type MonetaryTotal = { readonly state: 'estimated'; readonly amount: number; readonly currency: 'MYR'; readonly includedCount: number; readonly excludedCount: number; readonly label: string }
  | { readonly state: 'unavailable'; readonly includedCount: 0; readonly excludedCount: number; readonly reason: string; readonly label: string };
export function sumMonetaryFigures(figures: readonly MonetaryFigure[], label: string): MonetaryTotal {
  const included = figures.filter((f): f is Extract<MonetaryFigure, {state:'estimated'}> => f.state === 'estimated');
  if (!included.length) return { state: 'unavailable', includedCount: 0, excludedCount: figures.length, reason: 'No eligible product with a validated seller unit cost.', label };
  const amount = included.reduce((sum,f) => sum + Math.round(f.amount * 100), 0) / 100;
  if (!Number.isFinite(amount) || Math.abs(amount) > Number.MAX_SAFE_INTEGER / 100) return { state: 'unavailable', includedCount: 0, excludedCount: figures.length, reason: 'Total exceeds the supported numeric range.', label };
  return { state: 'estimated', amount, currency: 'MYR', includedCount: included.length, excludedCount: figures.length - included.length, label };
}

/** Planning, impact, risk ranking and export consume these same product amounts. */
export function buildImpactReview(snapshot: ReadinessSnapshot, forecast: DemandForecastReview, inputsByProduct: Readonly<Record<string, ProductPurchaseInputs | undefined>> = {}, suppliedPlans?: readonly ProductPurchasePlan[], contexts: PlanningContexts = {}) {
  const review = buildPurchasePlanReview(snapshot, forecast, { inputsByProduct, contexts });
  const plans = new Map((suppliedPlans ?? review.products).map(p => [p.productKey, p]));
  if (suppliedPlans) for (const current of review.products) {
    const supplied = plans.get(current.productKey);
    if (!supplied || supplied.purchasePolicyVersion !== current.purchasePolicyVersion || supplied.analysisDate !== snapshot.analysisDate
      || JSON.stringify(supplied.inputs) !== JSON.stringify(current.inputs)
      || JSON.stringify(supplied.audit) !== JSON.stringify(current.audit)
      || JSON.stringify(supplied.expiryRisk) !== JSON.stringify(current.expiryRisk)
      || JSON.stringify(supplied.estimatedRestock) !== JSON.stringify(current.estimatedRestock)) throw new Error('Impact requires current purchase plans with matching inputs, date and policy.');
  }
  const products: ImpactProduct[] = review.products.map(defaultPlan => {
    const plan = plans.get(defaultPlan.productKey) ?? defaultPlan, productKey = plan.productKey;
    const identity = snapshot.rows.find(row => row.productKey === productKey)?.interpretedValues;
    const plannedQuantity = plan.inputs.plannedOrder.state === 'value' ? plan.inputs.plannedOrder.value : undefined;
    const eligible = plannedQuantity !== undefined && plan.audit.state === 'verdict';
    const figures = plan.audit.state === 'verdict' ? plan.audit.figures : undefined;
    const excessUnits = eligible ? Math.max(0, figures!.availableAfterOrder.value - figures!.demandHigh.value) : undefined;
    const shortfallUnits = eligible ? Math.max(0, figures!.demandLow.value - figures!.availableAfterOrder.value) : undefined;
    const scenarioQuantity = plan.estimatedRestock.state === 'available' && !plan.estimatedRestock.afterUnavailableReason ? plan.estimatedRestock.quantity.value : undefined;
    const commitments = estimatePurchaseCommitments(snapshot, productKey, plan.inputs);
    const cost = (q: number | undefined) => estimatePurchaseCost(snapshot, productKey, eligible ? q : undefined);
    const plannedSpend = commitments.planned, scenarioSpend = cost(scenarioQuantity);
    const spendDifference: MonetaryFigure = plannedSpend.state === 'estimated' && scenarioSpend.state === 'estimated'
      ? { ...plannedSpend, amount: Math.round((plannedSpend.amount - scenarioSpend.amount) * 100) / 100, quantity: plannedQuantity! - scenarioQuantity! }
      : { state: 'unavailable', reason: 'Both current plan and restock scenario need an eligible quantity and seller cost.', correctiveAction: 'Enter your planned order and cost; check the restock evidence.' };
    return { productKey, name: identity?.productName ?? identity?.productCode ?? productKey, code: identity?.productCode, pack: identity?.packVariant,
      plan, plannedQuantity, available: eligible ? figures?.availableAfterOrder.value : undefined, demandHigh: eligible ? figures?.demandHigh.value : undefined,
      excessUnits, shortfallUnits, scenarioQuantity, plannedSpend, incomingSpend: commitments.incoming, combinedCommitment: commitments.combined,
      excessCost: cost(excessUnits), scenarioSpend, spendDifference,
      exclusionReason: plannedQuantity === undefined ? 'No planned order entered.' : !eligible ? plan.audit.state === 'cannot_judge' ? plan.audit.reason : 'No usable purchase check.' : undefined };
  });
  return Object.freeze({ snapshotId: snapshot.id, sourceMode: snapshot.sourceMode, sourceName: snapshot.sourceName, sourceSha256: snapshot.sourceSha256,
    analysisDate: snapshot.analysisDate, currency: 'MYR' as const, baseline: 'Current planned order', scenario: 'Restock recommendation', products,
    totals: { plannedSpend: sumMonetaryFigures(products.map(p => p.plannedSpend), 'Estimated planned purchase spend'), excessCost: sumMonetaryFigures(products.map(p => p.excessCost), 'Estimated excess-stock cost'),
      comparisonPlannedSpend: sumMonetaryFigures(products.map(p => p.spendDifference.state === 'estimated' ? p.plannedSpend : p.spendDifference), 'Current planned spend for comparable products'),
      scenarioSpend: sumMonetaryFigures(products.map(p => p.scenarioSpend), 'Estimated restock-scenario spend'), spendDifference: sumMonetaryFigures(products.map(p => p.spendDifference), 'Estimated purchase-spend difference') },
    assessedCount: products.filter(p => p.excessUnits !== undefined).length, excludedCount: products.filter(p => p.excessUnits === undefined).length });
}
export type ImpactReview = ReturnType<typeof buildImpactReview>;

/** Reference retail prices rank requests only; they never become a seller cost. */
export function rankMissingCostRequests(products: readonly ImpactProduct[], references: Readonly<Record<string, {price: number; source: string} | undefined>> = {}) {
  const missing = products.filter(p => p.plannedQuantity !== undefined && p.plannedSpend.state !== 'estimated');
  const ranked = missing.flatMap(p => {
    const ref = references[p.productKey];
    return p.excessUnits !== undefined && ref && Number.isFinite(ref.price) && ref.price >= 0 && ref.source.trim()
      ? [{ productKey: p.productKey, referenceRisk: p.excessUnits * ref.price, source: ref.source, referenceOnly: true as const }] : [];
  }).sort((a,b) => b.referenceRisk - a.referenceRisk || a.productKey.localeCompare(b.productKey));
  return { top10: ranked.slice(0,10), remaining: ranked.slice(10), unranked: missing.filter(p => !ranked.some(r => r.productKey === p.productKey)).map(p => ({ productKey: p.productKey, reason: 'No verified PriceCatcher reference-price mapping; add seller cost manually.' })) };
}
export function sortFinancialRisk(products: readonly ImpactProduct[]) {
  return [...products].sort((a,b) => (b.excessCost.state === 'estimated' ? b.excessCost.amount : -1) - (a.excessCost.state === 'estimated' ? a.excessCost.amount : -1) || a.productKey.localeCompare(b.productKey));
}
