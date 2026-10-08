import { CP3_DENSITY_REFERENCE } from './reference-data/cp3-density.ts';
export interface MassUnavailable {
  readonly state: "unavailable";
  readonly reasonCode: "missing_pack" | "range_or_size_list" | "count_unit" | "ambiguous_pack" | "invalid_mass" | "category_unconfirmed" | "density_missing";
  readonly reason: string;
  readonly correctiveAction: string;
}
export interface ParsedPackQuantity {
  readonly state: "available";
  readonly quantity: number;
  readonly dimension: "kg" | "l";
  readonly sourceText: string;
  readonly matchedText: string;
  readonly approximate: boolean;
  readonly method: "CP3 parse_C";
}
export interface ResolvedProductMass {
  readonly state: "available";
  readonly kgPerUnit: number;
  readonly method: "pack_parser" | "fao_density" | "manual" | "estimated_density" | "piece_estimate";
  readonly label: "Your weight" | "Pack size" | "Estimated (FAO generic-food density)" | "Estimated (1 kg/L assumption)" | "Estimated (PriceCatcher piece size)";
  readonly provenance: string;
  readonly sourceText?: string;
  readonly approximate: boolean;
  readonly litres?: number;
  readonly densityKgPerLitre?: number;
  readonly densityFood?: string;
  readonly category?: string;
}

const UNITS: Readonly<Record<string, readonly [number, "kg" | "l"]>> = Object.freeze({
  kg: [1, "kg"], kilo: [1, "kg"], g: [.001, "kg"], gm: [.001, "kg"], gr: [.001, "kg"], gram: [.001, "kg"], grams: [.001, "kg"],
  mg: [.000001, "kg"], lb: [.4536, "kg"], oz: [.02835, "kg"], kati: [.6, "kg"],
  ml: [.001, "l"], l: [1, "l"], lt: [1, "l"], ltr: [1, "l"], litre: [1, "l"], liter: [1, "l"],
});
const UNIT = "(kg|kilo|grams|gram|gm|gr|g|mg|lb|oz|kati|ml|ltr|lt|litre|liter|l)";
const NUMBER = "(\\d+(?:\\.\\d+)?(?:\\s*/\\s*\\d+(?:\\.\\d+)?)?)";
const FAO_DENSITIES: Readonly<Record<string, { readonly value: number; readonly food: string; readonly provenance: string }>> = Object.freeze(Object.fromEntries(CP3_DENSITY_REFERENCE.map(r=>[r.category,Object.freeze({value:r.kgPerLitre,food:r.faoEntry,provenance:r.provenance})])));

function unavailable(reasonCode: MassUnavailable["reasonCode"], reason: string): MassUnavailable {
  return Object.freeze({ state: "unavailable", reasonCode, reason, correctiveAction: "Enter the measured kilograms for one sales/stock unit, or correct and confirm the pack size." });
}
function number(value: string): number {
  const parts = value.split("/").map(item => Number(item.trim()));
  return parts.length === 2 ? parts[0] / parts[1] : parts[0];
}
interface Candidate { readonly start: number; readonly end: number; readonly quantity: number; readonly dimension: "kg" | "l"; readonly text: string }
function validQuantity(value: number) { return Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER; }

/**
 * CP3 parse_C, including decimal commas, fractions and either multipack order.
 * Ranges, size lists and count-only units refuse; never attach a generic piece weight.
 * Additional contradictory quantities are refused rather than selecting the first.
 */
export function parsePackQuantity(sourceText: string): ParsedPackQuantity | MassUnavailable {
  const t = String(sourceText).toLowerCase().replace(/±/g, "+-").replace(/×/g, "x").replace(/(\d),(\d)/g, "$1.$2").trim();
  if (!t) return unavailable("missing_pack", "No pack size was provided.");
  if (/\d\s*[-–—]\s*\d|\d\s+to\s+\d|\b[smlx]{1,2}l?\d{2}\b.*,|\/\s*seekor|per\s+ekor/.test(t))
    return unavailable("range_or_size_list", "A range, size list or animal-dependent weight has no single reliable mass.");
  if (/(?:^|[\s(])-\s*\d/.test(t)) return unavailable("invalid_mass", "A negative pack weight cannot be used.");
  const approximate = /\+-|\bapprox(?:imately)?\b|\babout\b/.test(t);
  const candidates: Candidate[] = [];
  const add = (m: RegExpExecArray, quantity: number, unit: string) => {
    const [factor, dimension] = UNITS[unit];
    candidates.push({ start: m.index, end: m.index + m[0].length, quantity: quantity * factor, dimension, text: m[0] });
  };
  // Nested multipacks are outside the supplied parser; refusing avoids dropping a multiplier.
  if (new RegExp(`${NUMBER}\\s*x\\s*${NUMBER}\\s*x\\s*${NUMBER}`).test(t))
    return unavailable("ambiguous_pack", "Nested multipacks require an explicit measured weight per sales unit.");
  const before = new RegExp(`${NUMBER}\\s*x\\s*${NUMBER}\\s*${UNIT}\\b`, "g");
  let match: RegExpExecArray | null;
  while ((match = before.exec(t))) add(match, number(match[1]) * number(match[2]), match[3]);
  const after = new RegExp(`${NUMBER}\\s*${UNIT}\\s*x\\s*${NUMBER}\\b`, "g");
  while ((match = after.exec(t))) {
    if (!candidates.some(item => match!.index < item.end && match!.index + match![0].length > item.start)) add(match, number(match[1]) * number(match[3]), match[2]);
  }
  const single = new RegExp(`${NUMBER}\\s*${UNIT}\\b`, "g");
  while ((match = single.exec(t))) {
    if (!candidates.some(item => match!.index >= item.start && match!.index < item.end)) add(match, number(match[1]), match[2]);
  }
  for (const [pattern, quantity] of [[/\bsekilo\b/g, 1], [/\bsetengah\s+kilo\b/g, .5]] as const) {
    while ((match = pattern.exec(t))) candidates.push({ start: match.index, end: match.index + match[0].length, quantity, dimension: "kg", text: match[0] });
  }
  if (!candidates.length) return unavailable("count_unit", "The pack is sold by count or has no readable mass/volume. No per-piece weight is assumed.");
  if (candidates.some(item => !validQuantity(item.quantity))) return unavailable("invalid_mass", "Pack mass/volume must be a positive finite number.");
  const first = candidates[0];
  if (candidates.some(item => item.dimension !== first.dimension || Math.abs(item.quantity - first.quantity) > Math.max(first.quantity, item.quantity) * 1e-9))
    return unavailable("ambiguous_pack", "The pack states different mass/volume quantities. Confirm the mass for one sales unit.");
  return Object.freeze({ state: "available", quantity: first.quantity, dimension: first.dimension, sourceText, matchedText: first.text,
    approximate, method: "CP3 parse_C" });
}

/**
 * Convert exactly one inventory/sales unit to kg. An explicit measured/manual kg
 * wins; litres use only the four measured FAO entries from CP3 E3b. Corn-syrup as
 * cordial is deliberately excluded. The proposal's optional 1 kg/L assumption
 * is opt-in and always labelled; CP3 defaults refuse unsupported liquids.
 */
export function resolveProductMass(input: {
  readonly packText: string;
  readonly productName?: string;
  /** Pass only a category explicitly confirmed by the user. */
  readonly confirmedCategory?: string;
  readonly manualKgPerUnit?: number;
  readonly allowEstimatedDensity?: boolean;
}): ResolvedProductMass | MassUnavailable {
  if (input.manualKgPerUnit !== undefined) {
    if (!validQuantity(input.manualKgPerUnit)) return unavailable("invalid_mass", "Your weight must be a positive finite number of kg per sales/stock unit.");
    return Object.freeze({ state: "available", kgPerUnit: input.manualKgPerUnit, method: "manual", label: "Your weight", provenance: "User-provided kilograms per sales/stock unit", approximate: false });
  }
  const pack = parsePackQuantity(input.packText);
  if (pack.state !== "available") return pack;
  if (pack.dimension === "kg") return Object.freeze({ state: "available", kgPerUnit: pack.quantity, method: "pack_parser", label: "Pack size",
    provenance: "CP3 v2 parse_C: stated pack mass; same unit as sales and stock", sourceText: input.packText, approximate: pack.approximate });
  if (!input.confirmedCategory) return unavailable("category_unconfirmed", "Confirm the food category before converting litres to kilograms.");
  const density = FAO_DENSITIES[input.confirmedCategory];
  if (density) return Object.freeze({ state: "available", kgPerUnit: pack.quantity * density.value, method: "fao_density", label: "Estimated (FAO generic-food density)",
    provenance: `FAO/INFOODS Density Database v2.0, CC BY 4.0; ${density.food}; ${density.provenance}; generic food, not a measured brand`,
    sourceText: input.packText, approximate: pack.approximate, litres: pack.quantity, densityKgPerLitre: density.value, densityFood: density.food, category: input.confirmedCategory });
  if (input.allowEstimatedDensity) return Object.freeze({ state: "available", kgPerUnit: pack.quantity, method: "estimated_density", label: "Estimated (1 kg/L assumption)",
    provenance: "Explicit CO2e change-proposal option: assumed 1 kg/L, not a measured density", sourceText: input.packText, approximate: true,
    litres: pack.quantity, densityKgPerLitre: 1, category: input.confirmedCategory });
  return unavailable("density_missing", `No measured FAO/INFOODS density is supplied for ${input.confirmedCategory}. Litres are not silently treated as kilograms.`);
}

export function listMeasuredFaoDensities() { return FAO_DENSITIES; }
