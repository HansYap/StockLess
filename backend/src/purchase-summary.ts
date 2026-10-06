import type { ProductPurchaseInputs, ProductPurchasePlan } from "./contracts.ts";

export type PurchaseExcessSummary =
  | { readonly state: "not_entered" | "unavailable"; readonly reason: string; readonly correctiveAction: string }
  | { readonly state: "assessed"; readonly quantity: number; readonly assessedCount: number; readonly excludedCount: number; readonly excessOrderCount: number };

/** Missing/unassessable orders never become an assessed zero. */
export function summarizePurchaseExcess(entries: readonly { inputs: ProductPurchaseInputs; plan?: ProductPurchasePlan }[]): PurchaseExcessSummary {
  const entered = entries.filter(entry => entry.inputs.plannedOrder.state === "value");
  if (!entered.length) return { state: "not_entered", reason: "No planned order has been entered.", correctiveAction: "Enter an order quantity to assess potential excess." };
  let quantity = 0, assessedCount = 0, excessOrderCount = 0;
  for (const entry of entered) {
    if (entry.plan?.audit.state !== "verdict") continue;
    assessedCount += 1;
    const excess = Math.max(0, entry.plan.audit.figures.availableAfterOrder.value - entry.plan.audit.figures.demandHigh.value);
    quantity += excess;
    if (excess > 0) excessOrderCount += 1;
  }
  return assessedCount ? { state: "assessed", quantity, assessedCount, excludedCount: entered.length - assessedCount, excessOrderCount }
    : { state: "unavailable", reason: "Entered orders do not have enough checked evidence.", correctiveAction: "Review demand, stock and product identity in Step 3." };
}
