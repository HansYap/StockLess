import { createPurchaseQuantity, suggestSupplierOrder, type ExpiryCheckInput, type ProductPurchaseInputs, type ProductPurchasePlan, type SupplierOrderTerms } from "../engine.ts";
import { evaluatePurchaseProduct, type PurchaseDrafts, type PurchaseEvaluator, type PurchaseProduct } from "./model.ts";

export interface SuggestedOrder {
  readonly product: PurchaseProduct;
  readonly inputs: ProductPurchaseInputs;
  readonly quantity: number;
  readonly originalQuantity: number;
  readonly terms: SupplierOrderTerms;
  readonly plan: ProductPurchasePlan;
  readonly selectedByDefault: boolean;
}
export interface SkippedSuggestion { readonly product: PurchaseProduct; readonly reason: string }
export interface SuggestedOrderReview {
  readonly suggestions: readonly SuggestedOrder[];
  readonly preserved: readonly PurchaseProduct[];
  readonly skipped: readonly SkippedSuggestion[];
}

/** Prepares a review only. The shared engines own all quantity and supplier rules. */
export function prepareSuggestedOrders(
  products: readonly PurchaseProduct[], plans: ReadonlyMap<string, ProductPurchasePlan | undefined>,
  drafts: PurchaseDrafts, terms: Readonly<Record<string, SupplierOrderTerms | undefined>>,
  analysisDate: string, evaluate: PurchaseEvaluator,
  expiryByProduct?: Readonly<Record<string, ExpiryCheckInput | undefined>>,
): SuggestedOrderReview {
  const suggestions: SuggestedOrder[] = [], preserved: PurchaseProduct[] = [], skipped: SkippedSuggestion[] = [];
  for (const product of products) {
    const inputs = drafts[product.key] ?? product.fileInputs;
    // A confirmed file quantity and an explicit zero are both existing orders.
    if (inputs.plannedOrder.state === "value") { preserved.push(product); continue; }
    const restock = plans.get(product.key)?.estimatedRestock;
    const supplierTerms = terms[product.key] ?? {};
    const supplier = suggestSupplierOrder(restock, supplierTerms, analysisDate);
    const skip = (reason: string) => skipped.push({ product, reason });
    if (supplier.state === "unavailable") {
      skip(product.issue ?? (restock?.state === "unavailable" ? restock.reason : supplier.reason)); continue;
    }
    if (supplier.beyondPlanningWindow && supplier.quantity > 0) {
      skip("Delivery falls outside the next 4 weeks. Review this product individually."); continue;
    }
    if (restock?.state !== "available") continue;
    if (restock.shelfLifeCap !== undefined && supplier.quantity > restock.shelfLifeCap) {
      skip("The supplier quantity exceeds the storage limit. Review this product individually."); continue;
    }
    const nextInputs = { ...inputs, plannedOrder: createPurchaseQuantity(supplier.quantity, "input by you") };
    const plan = evaluatePurchaseProduct(product, analysisDate, nextInputs, evaluate, expiryByProduct?.[product.key] ?? product.fileExpiry);
    if (plan?.audit.state !== "verdict") {
      skip(product.issue ?? (plan?.audit.state === "cannot_judge" ? plan.audit.reason : "A reliable purchase check is required first.")); continue;
    }
    suggestions.push({ product, inputs: nextInputs, quantity: supplier.quantity, originalQuantity: restock.quantity.value,
      terms: supplierTerms, plan, selectedByDefault: !plan.audit.gettingOld && (supplier.quantity === 0 || plan.audit.verdict === "Looks balanced") });
  }
  return { suggestions, preserved, skipped };
}
