import { CARBON_REFERENCE_ROWS, CARBON_REFERENCE_VERSION, CARBON_SOURCE_METADATA, type CarbonSourceId } from "./reference-carbon-data.ts";

/** User confirmed CP3 v2 on 8 October 2026, replacing the earlier Option A selection. */
export type CarbonPolicy = "bounded_cp3" | "median_estimate" | "poore_estimate";
export const DEFAULT_CARBON_POLICY: CarbonPolicy = "bounded_cp3";
export const CARBON_POLICY_DECISION = "User-confirmed CP3 v2: agreeing-group mean; otherwise median only within a factor of two of every source. Single-source and unsupported categories remain excluded. Supersedes earlier Option A selection.";
export type CarbonFactorLabel = "sources_agree" | "estimate";
export interface CarbonSourceValue {
  readonly id: CarbonSourceId;
  readonly name: string;
  readonly value: number;
  readonly version: string;
  readonly boundary: string;
}
export interface CarbonRange { readonly low: number; readonly high: number }
interface FactorBase {
  readonly category: string;
  readonly policy: CarbonPolicy;
  readonly referenceVersion: string;
  readonly sources: readonly CarbonSourceValue[];
  /** Range of all available source values, including sources outside an agreeing group. */
  readonly sourceRange?: CarbonRange;
}
export type CarbonFactorResult = FactorBase & (
  | { readonly state: "available"; readonly factorKgCO2ePerKg: number; readonly label: CarbonFactorLabel;
      readonly method: "agreeing_group_mean" | "bounded_median" | "all_source_median" | "poore_main" | "single_source";
      readonly selectedSources: readonly CarbonSourceId[]; readonly groupRange: CarbonRange; readonly explanation: string }
  | { readonly state: "unavailable"; readonly code: "NO_EMISSION_FACTOR" | "ONLY_ONE_SOURCE" | "SOURCES_DISAGREE" | "NO_POORE_FACTOR";
      readonly reason: string; readonly correctiveAction: string }
);

const references = new Map(CARBON_REFERENCE_ROWS.map(row => [row.category, row]));
const range = (values: readonly number[]): CarbonRange => Object.freeze({ low: Math.min(...values), high: Math.max(...values) });
const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Exact, order-independent implementation of the experiment's largest-group/union rule. */
function agreeingGroup(sources: readonly CarbonSourceValue[]): readonly CarbonSourceValue[] | undefined {
  let largestSize = 0;
  const members = new Set<number>();
  for (let mask = 1; mask < 2 ** sources.length; mask += 1) {
    const group = sources.filter((_, index) => (mask & (1 << index)) !== 0);
    if (group.length < 2 || group.length < largestSize) continue;
    const bounds = range(group.map(source => source.value));
    if (bounds.high / bounds.low > 2) continue;
    if (group.length > largestSize) { largestSize = group.length; members.clear(); }
    sources.forEach((_, index) => { if ((mask & (1 << index)) !== 0) members.add(index); });
  }
  if (!largestSize) return undefined;
  const group = sources.filter((_, index) => members.has(index));
  const bounds = range(group.map(source => source.value));
  return bounds.high / bounds.low <= 2 ? group : undefined;
}

/** Source values, rather than a stored status label, determine every factor and provenance range. */
export function combineCarbonSources(
  category: string,
  values: Readonly<Partial<Record<CarbonSourceId, number>>>,
  policy: CarbonPolicy = DEFAULT_CARBON_POLICY,
): CarbonFactorResult {
  if (!["bounded_cp3", "median_estimate", "poore_estimate"].includes(policy)) throw new Error("Unknown CO2e factor policy.");
  const sources = Object.freeze((Object.keys(CARBON_SOURCE_METADATA) as CarbonSourceId[]).flatMap(id => {
    const value = values[id];
    if (value === undefined) return [];
    if (!Number.isFinite(value) || value <= 0) throw new Error("Emission factors must be finite positive numbers.");
    const metadata = CARBON_SOURCE_METADATA[id];
    return [Object.freeze({ id, value, name: metadata.name, version: metadata.version, boundary: metadata.boundary })];
  }));
  const xs = sources.map(source => source.value);
  const base: FactorBase = Object.freeze({ category, policy, referenceVersion: CARBON_REFERENCE_VERSION, sources,
    ...(xs.length ? { sourceRange: range(xs) } : {}) });
  const unavailable = (code: "NO_EMISSION_FACTOR" | "ONLY_ONE_SOURCE" | "SOURCES_DISAGREE" | "NO_POORE_FACTOR", reason: string, correctiveAction: string): CarbonFactorResult => Object.freeze({ ...base, state: "unavailable", code, reason, correctiveAction });
  if (!sources.length) return unavailable("NO_EMISSION_FACTOR", "No sourced emission factor is available for this category. No verified food-group fallback mapping was supplied.", "Choose a supported food category or add a reviewed, sourced conversion table.");
  const available = (factor: number, label: CarbonFactorLabel, method: "agreeing_group_mean" | "bounded_median" | "all_source_median" | "poore_main" | "single_source", selected: readonly CarbonSourceValue[], explanation: string): CarbonFactorResult => Object.freeze({
    ...base, state: "available", factorKgCO2ePerKg: factor, label, method,
    selectedSources: Object.freeze(selected.map(source => source.id)), groupRange: range(selected.map(source => source.value)), explanation,
  });
  const group = agreeingGroup(sources);
  if (group) return available(group.reduce((sum, source) => sum + source.value, 0) / group.length,
    "sources_agree", "agreeing_group_mean", group, "Mean of the largest agreeing source group; every value in that group lies within a factor of two. Agreement is not ground-truth validation.");
  if (policy === "median_estimate") return available(median(xs), "estimate", sources.length === 1 ? "single_source" : "all_source_median", sources,
    sources.length === 1 ? "Estimated from one available source; cross-source agreement cannot be checked." : "Estimated using the median of all available sources because the source groups disagree; this value may be more than a factor of two from a source.");
  if (policy === "poore_estimate") {
    const poore = sources.find(source => source.id === "Poore");
    return poore ? available(poore.value, "estimate", "poore_main", [poore], "Estimated using Poore & Nemecek's global farm-to-retail figure. Other sources remain visible as a comparison range.")
      : unavailable("NO_POORE_FACTOR", "The selected Poore estimate policy has no Poore factor for this category.", "Choose a category with a sourced Poore factor or select a different explicit factor policy.");
  }
  if (sources.length === 1) return unavailable("ONLY_ONE_SOURCE", "Only one source covers this category; the bounded CP3 rule requires at least two.", "Keep the item excluded or explicitly select an approved estimate policy.");
  const middle = median(xs);
  if (xs.every(value => Math.max(middle, value) / Math.min(middle, value) <= 2)) {
    return available(middle, "estimate", "bounded_median", sources, "Sources disagree; the median of all sources is within a factor of two of every source, so it is shown as a bounded estimate.");
  }
  return unavailable("SOURCES_DISAGREE", "Sources disagree and no median lies within a factor of two of every source.", "Keep the item excluded or explicitly select an approved estimate policy.");
}

export function resolveCarbonFactor(category: string, policy: CarbonPolicy = DEFAULT_CARBON_POLICY): CarbonFactorResult {
  return combineCarbonSources(category, references.get(category)?.sources ?? {}, policy);
}

export type CarbonImpactKind = "recorded_waste" | "potential_excess" | "scenario_difference";
export interface CarbonImpactInput {
  readonly productKey: string;
  readonly productName?: string;
  readonly kind: CarbonImpactKind;
  readonly isFood: boolean;
  readonly category?: string;
  readonly categoryConfirmed: boolean;
  readonly categorySource?: 'ai' | 'manual';
  readonly categoryProvenance?: string;
  readonly quantity?: number;
  readonly quantityUnit?: string;
  /** A directly recorded kg amount bypasses per-unit mass conversion. */
  readonly measuredMassKg?: number;
  readonly massKgPerUnit?: number;
  readonly conversionSource?: string;
  readonly massEstimated?: boolean;
  readonly baseline?: string;
}
interface ImpactBase {
  readonly productKey: string;
  readonly productName?: string;
  readonly kind: CarbonImpactKind;
  readonly quantity?: number;
  readonly quantityUnit?: string;
  readonly category?: string;
  readonly baseline?: string;
  readonly categorySource?: 'ai' | 'manual';
  readonly categoryProvenance?: string;
}
export type CarbonImpactResult = ImpactBase & (
  | { readonly state: "estimated"; readonly massKg: number; readonly massBasis: "measured" | "converted" | "estimated";
      readonly conversionSource: string; readonly kgCO2e: number; readonly kgCO2eRange: CarbonRange;
      readonly factor: Extract<CarbonFactorResult, { state: "available" }>; readonly calculation: string;
      readonly limitation: string }
  | { readonly state: "unavailable" | "no_record" | "not_entered"; readonly code: string; readonly reason: string;
      readonly correctiveAction: string; readonly factor?: CarbonFactorResult; readonly kgAtRisk?: number }
);

/** The same conversion applies to three separate measures; actual records are never inferred from a scenario. */
export function estimateCarbonImpact(input: CarbonImpactInput, policy: CarbonPolicy = DEFAULT_CARBON_POLICY): CarbonImpactResult {
  const base: ImpactBase = Object.freeze({ productKey: input.productKey, productName: input.productName, kind: input.kind,
    quantity: input.quantity, quantityUnit: input.quantityUnit, category: input.category, baseline: input.baseline,
    categorySource: input.categorySource, categoryProvenance: input.categoryProvenance });
  const unavailable = (code: string, reason: string, correctiveAction: string, extra: { readonly factor?: CarbonFactorResult; readonly kgAtRisk?: number } = {}): CarbonImpactResult => Object.freeze({ ...base, state: "unavailable", code, reason, correctiveAction, ...extra });
  if (input.measuredMassKg === undefined && input.quantity === undefined) return Object.freeze({ ...base,
    state: input.kind === "recorded_waste" ? "no_record" : "not_entered", code: input.kind === "recorded_waste" ? "NO_WASTE_RECORD" : "QUANTITY_NOT_ENTERED",
    reason: input.kind === "recorded_waste" ? "No waste record." : "No quantity entered.", correctiveAction: input.kind === "recorded_waste" ? "Record actual discarded or expired stock for this period." : "Enter a quantity for this analysis." });
  const signed = input.kind === "scenario_difference";
  for (const value of [input.quantity, input.measuredMassKg]) if (value !== undefined && (!Number.isFinite(value) || (!signed && value < 0))) return unavailable("INVALID_QUANTITY", "Quantity must be finite and non-negative; only a scenario difference may be signed.", "Correct the quantity.");
  if (!input.isFood) return unavailable("NOT_FOOD", "This product is marked as non-food.", "No food CO2e estimate applies to this product.");
  let massKg: number | undefined, massBasis: "measured" | "converted" | "estimated" = "converted", conversionSource = input.conversionSource ?? "";
  if (input.measuredMassKg !== undefined) { massKg = input.measuredMassKg; massBasis = "measured"; conversionSource = "Recorded waste mass in kilograms"; }
  else if (input.quantityUnit?.toLowerCase() === "kg") { massKg = input.quantity; massBasis = input.kind === "recorded_waste" ? "measured" : "converted"; conversionSource ||= "Quantity recorded in kilograms"; }
  else if (input.massKgPerUnit !== undefined) {
    if (!Number.isFinite(input.massKgPerUnit) || input.massKgPerUnit <= 0) return unavailable("INVALID_MASS", "Mass per quantity unit must be a finite positive number.", "Correct the unit weight or density conversion.");
    if (!conversionSource) return unavailable("MISSING_CONVERSION_SOURCE", "The unit-to-kg conversion has no source.", "Confirm a file weight, parsed pack size or sourced density conversion.");
    massKg = input.quantity! * input.massKgPerUnit; massBasis = input.massEstimated ? "estimated" : "converted";
  }
  if (!input.category || !(input.categoryConfirmed || input.categorySource === 'ai' && input.categoryProvenance)) return unavailable("CATEGORY_NOT_CONFIRMED", "No supported automatic or confirmed food category is available.", "This product is left out of CO2e; other stock and financial results remain available.", massKg !== undefined ? { kgAtRisk: Math.abs(massKg) } : {});
  if (massKg === undefined) return unavailable("NO_WEIGHT", "No usable mass conversion is available for the quantity unit.", "This product is left out of CO2e. A measured weight can be added as an optional correction.");
  if (!Number.isFinite(massKg) || Math.abs(massKg) > Number.MAX_SAFE_INTEGER) return unavailable("NUMERIC_RANGE", "The converted mass is outside the supported numeric range.", "Check the quantity and unit weight.");
  if (signed && !input.baseline?.trim()) return unavailable("MISSING_BASELINE", "A scenario difference needs a named comparison baseline.", "Choose and name the two compared scenarios.");
  const factor = resolveCarbonFactor(input.category, policy);
  if (factor.state === "unavailable") return unavailable(factor.code, factor.reason, factor.correctiveAction, { factor, kgAtRisk: Math.abs(massKg) });
  const kgCO2e = massKg * factor.factorKgCO2ePerKg;
  if (!Number.isFinite(kgCO2e) || Math.abs(kgCO2e) > Number.MAX_SAFE_INTEGER) return unavailable("NUMERIC_RANGE", "The CO2e estimate is outside the supported numeric range.", "Check the quantity and conversion values.");
  const extremes = [massKg * factor.groupRange.low, massKg * factor.groupRange.high];
  return Object.freeze({ ...base, state: "estimated", massKg, massBasis, conversionSource, kgCO2e, kgCO2eRange: range(extremes), factor,
    calculation: `${massKg} kg × ${factor.factorKgCO2ePerKg} kg CO2e/kg = ${kgCO2e} kg CO2e`,
    limitation: (input.categorySource === 'ai' ? `AI-assigned food category, not manually confirmed. ${input.categoryProvenance}. ` : '') + (signed ? "Estimated scenario difference; it does not change recorded waste or establish achieved emissions reductions."
      : input.kind === "potential_excess" ? "Estimated impact of potential excess; this is not recorded waste or an achieved reduction."
        : "CO2e is estimated from recorded waste; source agreement does not validate a measured emissions outcome.") });
}

export interface CarbonImpactSummary {
  readonly kind?: CarbonImpactKind;
  readonly state: "estimated" | "unavailable" | "no_records";
  readonly totalProductCount: number;
  readonly includedProductCount: number;
  readonly excludedProductCount: number;
  readonly kgCO2e?: number;
  readonly massKg?: number;
  readonly kgCO2eRange?: CarbonRange;
  readonly massKgSourcesAgree: number;
  readonly massKgEstimate: number;
  readonly massShareSourcesAgree?: number;
  readonly massShareEstimate?: number;
  readonly included: readonly Extract<CarbonImpactResult, { state: "estimated" }>[];
  readonly excluded: readonly Exclude<CarbonImpactResult, { state: "estimated" }>[];
  readonly confirmationQueue: readonly Exclude<CarbonImpactResult, { state: "estimated" }>[];
  readonly reason?: string;
}

/** One summary cannot combine recorded waste, potential stock and signed scenario differences. */
export function summarizeCarbonImpact(results: readonly CarbonImpactResult[]): CarbonImpactSummary {
  const kinds = new Set(results.map(result => result.kind));
  if (kinds.size > 1) throw new Error("Summarize recorded waste, potential excess and scenario differences separately.");
  const included = results.filter((result): result is Extract<CarbonImpactResult, { state: "estimated" }> => result.state === "estimated");
  const excluded = results.filter((result): result is Exclude<CarbonImpactResult, { state: "estimated" }> => result.state !== "estimated");
  const allProducts = new Set(results.map(result => result.productKey)), contributing = new Set(included.map(result => result.productKey));
  const massKgSourcesAgree = included.filter(result => result.factor.label === "sources_agree").reduce((sum, result) => sum + Math.abs(result.massKg), 0);
  const massKgEstimate = included.filter(result => result.factor.label === "estimate").reduce((sum, result) => sum + Math.abs(result.massKg), 0);
  const absoluteMass = massKgSourcesAgree + massKgEstimate;
  const totals = included.length ? {
    kgCO2e: included.reduce((sum, result) => sum + result.kgCO2e, 0), massKg: included.reduce((sum, result) => sum + result.massKg, 0),
    kgCO2eRange: Object.freeze({ low: included.reduce((sum, result) => sum + result.kgCO2eRange.low, 0), high: included.reduce((sum, result) => sum + result.kgCO2eRange.high, 0) }),
  } : {};
  if (totals.kgCO2e !== undefined && (!Number.isFinite(totals.kgCO2e) || Math.abs(totals.kgCO2e) > Number.MAX_SAFE_INTEGER)) throw new Error("CO2e summary exceeds the supported numeric range.");
  return Object.freeze({ kind: results[0]?.kind, state: included.length ? "estimated" : results.length > 0 && results.every(result => result.state === "no_record") ? "no_records" : "unavailable",
    totalProductCount: allProducts.size, includedProductCount: contributing.size, excludedProductCount: allProducts.size - contributing.size,
    ...totals, massKgSourcesAgree, massKgEstimate,
    ...(absoluteMass ? { massShareSourcesAgree: massKgSourcesAgree / absoluteMass, massShareEstimate: massKgEstimate / absoluteMass } : {}),
    included: Object.freeze(included), excluded: Object.freeze(excluded),
    confirmationQueue: Object.freeze(excluded.filter(result => result.code === "CATEGORY_NOT_CONFIRMED").sort((a, b) => (b.kgAtRisk ?? -1) - (a.kgAtRisk ?? -1) || a.productKey.localeCompare(b.productKey))),
    ...(included.length ? {} : { reason: results.length > 0 && results.every(result => result.state === "no_record") ? "No waste records for the selected period." : "No products have a supported category, quantity and weight conversion with an available emission factor." }),
  });
}

export const CARBON_MALAYSIA_ILLUSTRATION = Object.freeze({
  kgCO2ePerPersonPerDay: 29.95, country: "Malaysia", year: 2024,
  source: "Jones et al. (2025) via Our World in Data, as supplied in StockLess I3 CP3 v2 §1",
  scope: "All sectors; illustrative comparison, not a food-waste baseline or a measured reduction.",
});
