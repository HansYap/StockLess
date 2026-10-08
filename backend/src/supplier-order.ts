import type { RestockEstimate } from "./contracts.ts";
import { addCalendarDays, parseIsoDate } from "./dates.ts";
import { EPIC5_POLICY } from "./purchase-plan.ts";

/** Optional product-level terms entered for the current planning visit. */
export interface SupplierOrderTerms {
  readonly caseSize?: number;
  readonly minimumOrder?: number;
  readonly leadTimeDays?: number;
}

export type SupplierOrderSuggestion =
  | { readonly state: "unavailable"; readonly reason: string }
  | { readonly state: "available"; readonly quantity: number; readonly cases?: number; readonly arrivalDate?: string; readonly beyondPlanningWindow: boolean };

export interface SupplierScenario {
  readonly id: string;
  readonly name: string;
  readonly terms: SupplierOrderTerms;
}

/** Compares quantities and dates against one unchanged restock target, without invented prices. */
export function compareSupplierOrders(estimate: RestockEstimate | undefined, scenarios: readonly SupplierScenario[], analysisDate: string) {
  if (!parseIsoDate(analysisDate)) throw new Error("A valid analysis date is required.");
  const counts = new Map<string, number>();
  for (const scenario of scenarios) counts.set(scenario.id, (counts.get(scenario.id) ?? 0) + 1);
  return scenarios.map(scenario => {
    let result: SupplierOrderSuggestion;
    if (!scenario.id.trim() || !scenario.name.trim() || counts.get(scenario.id) !== 1) {
      result = { state: "unavailable", reason: "Give each supplier a name and a unique identifier." };
    } else if (scenario.terms.caseSize === undefined || scenario.terms.minimumOrder === undefined || scenario.terms.leadTimeDays === undefined) {
      result = { state: "unavailable", reason: "Enter case size, minimum order and lead time for this supplier." };
    } else result = suggestSupplierOrder(estimate, scenario.terms, analysisDate);
    return { id: scenario.id, name: scenario.name.trim(), terms: scenario.terms, result,
      extraUnits: result.state === "available" && estimate?.state === "available" ? result.quantity - estimate.quantity.value : undefined };
  });
}

/** Adjusts the existing restock target; delivery time never changes the demand forecast. */
export function suggestSupplierOrder(estimate: RestockEstimate | undefined, terms: SupplierOrderTerms, analysisDate: string): SupplierOrderSuggestion {
  if (!parseIsoDate(analysisDate)) throw new Error("A valid analysis date is required.");
  if (!estimate || estimate.state !== "available") return { state: "unavailable", reason: "A reliable restock estimate is required first." };
  if (estimate.afterUnavailableReason) return { state: "unavailable", reason: estimate.afterUnavailableReason };
  const valid = (value: number | undefined, minimum: number, maximum: number) => value === undefined || (Number.isSafeInteger(value) && value >= minimum && value <= maximum);
  if (!valid(terms.caseSize, 1, EPIC5_POLICY.maximumQuantity) || !valid(terms.minimumOrder, 0, EPIC5_POLICY.maximumQuantity) || !valid(terms.leadTimeDays, 0, 3650)) {
    return { state: "unavailable", reason: "Enter valid whole-number supplier terms." };
  }
  const target = estimate.quantity.value;
  const size = terms.caseSize ?? 1;
  const quantity = target === 0 ? 0 : Math.ceil(Math.max(target, terms.minimumOrder ?? 0) / size) * size;
  if (quantity > EPIC5_POLICY.maximumQuantity) return { state: "unavailable", reason: "The supplier-adjusted quantity is above the supported order limit." };
  return {
    state: "available", quantity,
    cases: terms.caseSize === undefined ? undefined : quantity / size,
    arrivalDate: terms.leadTimeDays === undefined ? undefined : addCalendarDays(analysisDate, terms.leadTimeDays),
    beyondPlanningWindow: (terms.leadTimeDays ?? 0) >= 28,
  };
}
