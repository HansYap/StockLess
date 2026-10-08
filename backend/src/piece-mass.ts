/** Piece-mass estimates use only explicitly stated PriceCatcher size evidence.
 * This API returns one piece, not one tray, pack or inventory unit. Callers must
 * confirm the inventory unit and multiply by the stated pack count themselves.
 */
export type PriceCatcherPieceMass =
  | { readonly state: "available"; readonly kgPerUnit: number; readonly low: number; readonly high: number;
      readonly estimated: true; readonly unitBasis: "one_piece";
      readonly method: "egg_grade_midpoint" | "inverse_count_midpoint" | "explicit_piece_weight" | "explicit_piece_weight_midpoint";
      readonly provenance: string; readonly sourceText: string; readonly calculation: string;
      readonly countPerKilogram?: { readonly low: number; readonly high: number } }
  | { readonly state: "unavailable"; readonly reasonCode: "category_unconfirmed" | "no_piece_evidence" | "open_range" | "conflicting_evidence" | "invalid_piece_evidence";
      readonly reason: string; readonly correctiveAction: string };

const EGG_GRADES = Object.freeze({ A: [65.0, 69.9], B: [60.0, 64.9], C: [55.0, 59.9] } as const);
const SEAFOOD_CATEGORIES = new Set(["fresh_fish_wild", "fresh_fish_farmed", "fresh_fish", "prawns", "shellfish_other", "shellfish"]);
const NUM = "(\\d+(?:\\.\\d+)?)";
const BETWEEN = "(?:HINGGA|DAN|TO|AND|[-–—])";
const PER_PIECE = "(?:SEBIJI|PER\\s+(?:BIJI|PIECE|EGG|FISH)|SETIAP\\s+(?:BIJI|EKOR)|SEEKOR)";

function unavailable(reasonCode: Extract<PriceCatcherPieceMass, { state: "unavailable" }>['reasonCode'], reason: string): PriceCatcherPieceMass {
  return Object.freeze({ state: "unavailable", reasonCode, reason,
    correctiveAction: "Record the measured kilograms for one piece, or confirm a source name with a supported egg grade or bounded piece-weight/count-per-kg evidence." });
}

/**
 * Egg grade bounds are from CP3 v2 D3, citing PriceCatcher item names: A 65–69.9 g,
 * B 60–64.9 g and C 55–59.9 g. No generic egg, kampung, quail or fruit weight is used.
 * Fish count ranges use 1 / midpoint(count-per-kg), with reciprocal mass bounds.
 * The midpoint is a transparent estimate, not a measured piece or validated mean.
 */
export function parsePriceCatcherPieceMass(name: string, confirmedCategory: string | undefined): PriceCatcherPieceMass {
  if (!confirmedCategory?.trim()) return unavailable("category_unconfirmed", "Confirm the food category before applying a PriceCatcher piece-size estimate.");
  const t = String(name).normalize("NFKC").toUpperCase().replace(/\s+/g, " ").trim();
  const categoryGrade = confirmedCategory.match(/^eggs_chicken_grade_([abc])$/)?.[1].toUpperCase();
  const eggCategory = confirmedCategory === 'eggs' || !!categoryGrade;
  if (categoryGrade && [...t.matchAll(/\bGRED\s*([ABC])\b/g)].some(m=>m[1]!==categoryGrade))
    return unavailable('conflicting_evidence','The confirmed egg-grade category conflicts with the grade in the source name.');
  if (/(?:^|[\s(])-\s*\d/.test(t)) return unavailable("invalid_piece_evidence", "Negative piece-size evidence cannot be used.");
  if (/[<>≤≥]/.test(t) && new RegExp(`(?:G|GRAM)\\s*${PER_PIECE}\\b`).test(t))
    return unavailable("open_range", "An open-ended grams-per-piece statement has no bounded midpoint.");
  const finish = (kgPerUnit: number, low: number, high: number,
    method: Extract<PriceCatcherPieceMass, { state: "available" }>['method'], provenance: string, calculation: string,
    countPerKilogram?: { readonly low: number; readonly high: number }): PriceCatcherPieceMass => {
    if (![kgPerUnit, low, high].every(value => Number.isFinite(value) && value > 0) || low > high || kgPerUnit < low || kgPerUnit > high)
      return unavailable("invalid_piece_evidence", "Piece-size bounds must be finite, positive and consistently ordered.");
    return Object.freeze({ state: "available", kgPerUnit, low, high, estimated: true, unitBasis: "one_piece", method, provenance,
      sourceText: name, calculation, ...(countPerKilogram ? { countPerKilogram: Object.freeze(countPerKilogram) } : {}) });
  };
  const explicitRanges = [...t.matchAll(new RegExp(`(?:ANTARA\\s+)?${NUM}\\s*${BETWEEN}\\s*${NUM}\\s*(?:G|GRAM)\\s*${PER_PIECE}\\b`, "g"))];
  const explicitSingles = [...t.matchAll(new RegExp(`${NUM}\\s*(?:G|GRAM)\\s*${PER_PIECE}\\b`, "g"))]
    .filter(match => !explicitRanges.some(candidate => match.index! >= candidate.index! && match.index! < candidate.index! + candidate[0].length));
  if (explicitRanges.length + explicitSingles.length > 1) return unavailable("conflicting_evidence", "More than one piece-weight statement appears in the source name.");
  const explicit = explicitRanges[0] ?? explicitSingles[0];
  if (explicit) {
    const low = Number(explicit[1]) / 1000, high = explicitRanges.length ? Number(explicit[2]) / 1000 : low;
    const grade = eggCategory && /\b(?:TELUR|TELOR)\s+AYAM\b/.test(t) ? (categoryGrade ?? t.match(/\bGRED\s*([ABC])\b/)?.[1]) as keyof typeof EGG_GRADES | undefined : undefined;
    if (grade && (low < EGG_GRADES[grade][0] / 1000 || high > EGG_GRADES[grade][1] / 1000))
      return unavailable("conflicting_evidence", "The stated per-egg weight conflicts with the source's chicken-egg grade bounds.");
    return finish((low + high) / 2, low, high, explicitRanges.length ? "explicit_piece_weight_midpoint" : "explicit_piece_weight",
      "Explicit grams-per-piece statement in the supplied PriceCatcher-style product name; retained as a reference estimate rather than an individual measurement.",
      explicitRanges.length ? `(${explicit[1]} + ${explicit[2]}) / 2 / 1000 kg per piece` : `${explicit[1]} / 1000 kg per piece`);
  }
  if (eggCategory) {
    // Only chicken eggs have these Malaysian grade bounds in the supplied report.
    if (!/\b(?:TELUR|TELOR)\s+AYAM\b/.test(t) || /\b(?:KAMPUNG|PUYUH|MASIN|REBUS|ITIK)\b/.test(t))
      return unavailable("no_piece_evidence", "The supplied source has no supported chicken-egg grade bounds for this egg type.");
    const grades = [...t.matchAll(/\bGRED\s*([ABC])\b/g)].map(match => match[1] as keyof typeof EGG_GRADES);
    if (grades.length !== 1) return unavailable(grades.length ? "conflicting_evidence" : "no_piece_evidence", "A single supported chicken-egg grade A, B or C is required; no generic 50 g egg is assumed.");
    const [lowGrams, highGrams] = EGG_GRADES[grades[0]], kg = (lowGrams + highGrams) / 2 / 1000;
    return finish(kg, lowGrams / 1000, highGrams / 1000, "egg_grade_midpoint",
      `KPDN PriceCatcher egg grade ${grades[0]} bounds, as quoted in StockLess I3 Checkpoint 3 Specification v2 D3 (${lowGrams}–${highGrams} g per egg); midpoint selected under the CO2e change proposal D3.`,
      `(${lowGrams} + ${highGrams}) / 2 / 1000 kg per chicken egg`);
  }
  if (SEAFOOD_CATEGORIES.has(confirmedCategory) && /\b(?:IKAN|UDANG|KETAM)\b/.test(t)) {
    if (/[<>≤≥]|\b(?:LEBIH|KURANG|AT\s+LEAST|AT\s+MOST)\b/.test(t))
      return unavailable("open_range", "An open-ended fish count per kilogram has no bounded midpoint; no piece weight is inferred.");
    const matches = [...t.matchAll(new RegExp(`(?:ANTARA\\s+)?${NUM}\\s*${BETWEEN}\\s*${NUM}\\s*EKOR\\s+(?:SEKILOGRAM|PER\\s*(?:KG|KILOGRAM))\\b`, "g"))];
    const fixed = [...t.matchAll(new RegExp(`${NUM}\\s*EKOR\\s+(?:SEKILOGRAM|PER\\s*(?:KG|KILOGRAM))\\b`, "g"))]
      .filter(match => !matches.some(candidate => match.index! >= candidate.index! && match.index! < candidate.index! + candidate[0].length));
    if (matches.length + fixed.length > 1) return unavailable("conflicting_evidence", "More than one count-per-kilogram statement appears in the source name.");
    const count = matches[0] ?? fixed[0];
    if (count) {
      const lowCount = Number(count[1]), highCount = matches.length ? Number(count[2]) : lowCount;
      if (!Number.isSafeInteger(lowCount) || !Number.isSafeInteger(highCount) || lowCount <= 0 || highCount < lowCount)
        return unavailable("invalid_piece_evidence", "Counts per kilogram require positive whole numbers with the lower count no greater than the upper count.");
      return finish(1 / ((lowCount + highCount) / 2), 1 / highCount, 1 / lowCount, "inverse_count_midpoint",
        "Count-per-kilogram bounds encoded in the PriceCatcher item name (supplied CP3 e1_gold_all.csv examples). The reciprocal of the count midpoint is an explicitly labelled size estimate; it is not a species-average measured weight.",
        `1 / ((${lowCount} + ${highCount}) / 2) kg per piece; mass bounds 1/${highCount} to 1/${lowCount} kg`, { low: lowCount, high: highCount });
    }
  }
  return unavailable("no_piece_evidence", "No sourced bounded mass for one piece can be derived from this product name; count-only pack sizes are insufficient.");
}
