import {
  buildDemandReview,
  evaluateProductPurchasePlan,
  emptyProductPurchaseInputs,
  type DemandForecastReview,
  type DemandProductEvidence,
  type ProductDemandEstimate,
  type ProductStockEvidence,
  type ReadinessSnapshot,
  type ProductPurchaseInputs,
  type ExpiryCheckInput,
} from "../engine.ts";

export type PurchaseDrafts = Readonly<
  Record<string, ProductPurchaseInputs | undefined>
>;
export type PurchaseEvaluator = typeof evaluateProductPurchasePlan;
export const EMPTY_INPUTS = emptyProductPurchaseInputs();

export interface PurchaseProduct {
  readonly key: string;
  readonly name: string;
  readonly sku?: string;
  readonly evidence?: DemandProductEvidence;
  readonly stock?: ProductStockEvidence;
  readonly demand?: ProductDemandEstimate;
  readonly issue?: string;
}

/** Presentation join only. All calculations stay behind engine.ts. Never join by display name. */
export function joinPurchaseEvidence(
  snapshot: ReadinessSnapshot,
  forecast: DemandForecastReview,
): PurchaseProduct[] {
  const evidence = new Map(
    buildDemandReview(snapshot).products.map((p) => [p.productKey, p]),
  );
  const stocks = new Map(snapshot.productStock.map((p) => [p.productKey, p]));
  const identities = new Map<string, ReadinessSnapshot["rows"][number]>();
  for (const row of snapshot.rows) {
    if (
      row.productKey &&
      (!identities.has(row.productKey) || row.useState === "used")
    )
      identities.set(row.productKey, row);
  }
  const demands = new Map<string, ProductDemandEstimate>();
  const duplicates = new Set<string>();
  for (const demand of forecast.products) {
    if (demands.has(demand.productKey)) duplicates.add(demand.productKey);
    demands.set(demand.productKey, demand);
  }
  const keys = new Set([
    ...identities.keys(),
    ...stocks.keys(),
    ...demands.keys(),
  ]);
  const mismatch =
    snapshot.id !== forecast.snapshotId ||
    snapshot.analysisDate !== forecast.analysisDate;
  return [...keys].map((key) => {
    const row = identities.get(key)?.interpretedValues;
    const demand = demands.get(key);
    const issue = mismatch
      ? "Forecast and readiness do not match. Return to readiness and run the forecast again."
      : duplicates.has(key)
        ? "More than one forecast was supplied for this product. Refresh the forecast."
        : !identities.has(key)
          ? "Readiness evidence is missing for this forecast product. Refresh readiness."
          : !demand
            ? "Forecast evidence is missing for this product. Refresh the forecast."
            : demand.label !== "Cannot assess" && !demand.range
              ? "The forecast range is missing. Refresh the forecast."
              : undefined;
    return {
      key,
      name:
        evidence.get(key)?.displayName ||
        [row?.productName, row?.packVariant].filter(Boolean).join(" · ") ||
        row?.productCode ||
        key,
      sku: row?.productCode,
      evidence: evidence.get(key),
      stock: stocks.get(key),
      demand,
      issue,
    };
  });
}

export function evaluatePurchaseProduct(
  product: PurchaseProduct,
  analysisDate: string,
  inputs: ProductPurchaseInputs,
  evaluate: PurchaseEvaluator,
  expiry?: ExpiryCheckInput,
) {
  if (product.issue || !product.demand) return undefined;
  return evaluate(product.demand, {
    analysisDate,
    stock: product.stock,
    inputs,
    expiry,
  });
}
