import type { CapabilityId, CapabilityResult, ProductAssessment, ProductTimeline, ReadinessSnapshot } from "./contracts.ts";
import { CAPABILITY_LABELS } from "./capabilities.ts";
import { buildDemandForecastReview } from "./forecast.ts";
import { buildDemandReview } from "./demand.ts";
import { buildProductTimelines } from "./timeline.ts";

function capability(id: CapabilityId, state: CapabilityResult["state"], messages: readonly string[] = []): CapabilityResult {
  return Object.freeze({ capability: id, label: CAPABILITY_LABELS[id], state, iterationEnabled: true,
    reasons: Object.freeze(messages.map(message => Object.freeze({ code: "PRODUCT_EVIDENCE", message }))) });
}

/** Authoritative product-level states. Missing optional data limits only dependent analyses. */
export function buildProductAssessments(snapshot: ReadinessSnapshot, timelines: readonly ProductTimeline[] = buildProductTimelines(snapshot)): readonly ProductAssessment[] {
  const forecasts = buildDemandForecastReview(snapshot, timelines);
  const descriptive = new Map(buildDemandReview(snapshot).products.map(item => [item.productKey, item]));
  const used = new Set(snapshot.rows.filter(row => row.useState === "used").map(row => row.productKey));
  const stocks = new Map(snapshot.productStock.map(item => [item.productKey, item]));
  const costs = new Map(snapshot.productCosts?.map(item => [item.productKey, item]) ?? []);
  const issuesByProduct = new Map<string, string[]>();
  for (const issue of snapshot.issues) if (issue.productKey && issue.resolutionState === "unresolved") {
    const reasons = issuesByProduct.get(issue.productKey) ?? []; reasons.push(issue.reason); issuesByProduct.set(issue.productKey, reasons);
  }
  return Object.freeze(forecasts.products.map(forecast => {
    const key = forecast.productKey, stock = stocks.get(key), cost = costs.get(key), description = descriptive.get(key);
    const forecastReasons = forecast.labelReason ? [forecast.labelReason.message, forecast.historyEvidence?.correctiveAction ?? "Rerun Step 3."] : [];
    const stockReasons = stock?.usableForCover ? stock.freshness.state === "limited" ? ["The stock count is getting old. Count stock again and rerun Step 3."] : []
      : ["Stock evidence is incomplete or cannot be relied on. Add a valid stock count and date, then rerun Step 3."];
    const history = capability("weekly_history", used.has(key) ? "available" : "needs_information", used.has(key) ? [] : forecastReasons);
    const demand = capability("demand_range", forecast.label === "Ready" ? "available" : forecast.label === "Limited" ? "limited" : "needs_information", forecastReasons);
    const stockCover = capability("weeks_of_cover", description?.cover.state === "standard" ? "available" : description?.cover.state === "limited" ? "limited" : "needs_information",
      description?.cover.state === "cannot_calculate" ? [...stockReasons, ...description.cover.reasonCodes.map(code => code.replace(/_/g, " ").toLowerCase())] : stockReasons);
    const purchase = capability("purchase_audit", demand.state === "needs_information" || !stock?.usableForCover ? "needs_information"
      : demand.state === "limited" || stock.freshness.state === "limited" ? "limited" : "available", [...forecastReasons, ...stockReasons]);
    const costBlocked = forecast.labelReason?.code === "IDENTITY_CONFLICT";
    const money = capability("purchase_cost", cost?.state === "usable" && !costBlocked ? "available" : "needs_information",
      costBlocked ? forecastReasons : cost && cost.state !== "usable" ? [cost.reason, cost.correctiveAction] : cost ? [] : ["Map Unit cost in Step 2, then rerun Step 3."]);
    const reasons = [...new Set([...issuesByProduct.get(key) ?? [], ...forecastReasons, ...stockReasons])];
    const status = demand.state === "needs_information" ? "missing" : reasons.length || demand.state === "limited" ? "review" : "ready";
    return Object.freeze({ productKey: key, status, history, demand, stockCover, purchase, cost: money, reasons: Object.freeze(reasons) });
  }));
}
