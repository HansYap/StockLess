import { M12_METADATA, M12_WEIGHTS_BASE64, M12_PARENT_CATEGORIES, M12_DEV_NAMES, M12_PREPARED_FOOD_MARKERS } from "./reference-data/cp3-m12-model.ts";
import { CP3_CATEGORY_DICTIONARY } from './reference-data/cp3-category-dictionary.ts';

export interface CategoryKeywordDefinition {
  readonly category: string;
  readonly keywords: readonly string[];
  /** Where the keyword/category link came from; never inferred from the model. */
  readonly provenance: string;
  readonly isFood?: boolean;
}
export interface CategoryKeywordHit {
  readonly keyword: string;
  readonly category: string;
  readonly matchedToken: string;
  readonly match: "exact" | "spelling_tolerance";
  readonly provenance: string;
}
export interface CategorySuggestion {
  readonly state: "suggested" | "needs_category";
  readonly category?: string;
  readonly modelCategory?: string;
  readonly requiresConfirmation: true;
  readonly reasonCode?: "empty_name" | "keyword_table_missing" | "prepared_food" | "no_keyword" | "ambiguous_keywords" | "not_food" | "methods_disagree" | "model_unsure";
  readonly reason?: string;
  readonly evidence: {
    readonly modelVersion: "CP3-v2-M12-P0";
    readonly keywordHits: readonly CategoryKeywordHit[];
    readonly dictionaryProvenance: readonly string[];
    readonly closestKnownItem?: { readonly name: string; readonly category: string; readonly source: "CP3 experiment DEV names (AI labels, not human checked)" };
  };
}

const THRESHOLD = 0.41; // results/e1_results_round2.csv: DEV-tuned M12 threshold.
const NON_FOOD_LABELS = new Set(["NOMATCH", "NONFOOD", "non_food", "water", "tea"]);
const VOCAB: Readonly<Record<string, number>> = M12_METADATA.vocab;
const PARENTS: Readonly<Record<string, readonly string[]>> = M12_PARENT_CATEGORIES;
const PACK = /\b\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?\s*)?(kg|g|gm|gram|ml|l|liter|litre|ltr|s|'s|biji|keping|pcs|roll|batang|uncang|ikat|sikat|bungkus|ekor)?\b|%/g;
let weights: Float32Array | undefined;
type Feature = readonly [number, number];

/** Same normalization and TF-IDF features as the supplied browser M12 implementation. */
export function normalizeM12Name(value: string): string {
  return String(value).toLowerCase().replace(PACK, " ").replace(/[^a-z&' ]/g, " ").replace(/\s+/g, " ").trim();
}
function features(text: string): readonly Feature[] {
  const counts = new Map<number, number>();
  for (const word of normalizeM12Name(text).split(" ")) {
    if (!word) continue;
    const w = ` ${word} `;
    for (let n = 2; n <= 4; n++) {
      let offset = 0;
      const add = (gram: string) => { const index = VOCAB[gram]; if (index !== undefined) counts.set(index, (counts.get(index) ?? 0) + 1); };
      add(w.slice(0, n));
      while (offset + n < w.length) { offset++; add(w.slice(offset, offset + n)); }
      if (offset === 0) break;
    }
  }
  const values: Feature[] = []; let ss = 0;
  for (const [index, count] of counts) {
    const value = (1 + Math.log(count)) * M12_METADATA.idf[index];
    values.push([index, value]); ss += value * value;
  }
  const length = Math.sqrt(ss) || 1;
  return values.map(([index, value]) => [index, value / length]);
}
function modelWeights(): Float32Array {
  if (weights) return weights;
  const raw = atob(M12_WEIGHTS_BASE64);
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  // The export is little-endian; decoding explicitly is portable across Workers and Node.
  weights = new Float32Array(bytes.length / 4);
  for (let i = 0; i < weights.length; i++) weights[i] = view.getFloat32(i * 4, true);
  return weights;
}
/** Internal model scores are used only for a refusal gate, never advertised as accuracy/probability. */
export function predictM12CategoryModel(name: string): { readonly category: string; readonly passesThreshold: boolean } {
  const vector = features(name), data = modelWeights();
  const f = M12_METADATA.n_features, k = M12_METADATA.classes.length;
  const logits = new Float64Array(k);
  let best = 0;
  for (let c = 0; c < k; c++) {
    let value = data[k * f + c];
    for (const [index, weight] of vector) value += data[c * f + index] * weight;
    logits[c] = value;
    if (value > logits[best]) best = c;
  }
  let sum = 0;
  for (const value of logits) sum += Math.exp(value - logits[best]);
  return Object.freeze({ category: M12_METADATA.classes[best], passesThreshold: vector.length > 0 && 1 / sum >= THRESHOLD });
}

let devVectors: readonly ReadonlyMap<number, number>[] | undefined;
function closestDevName(name: string): CategorySuggestion["evidence"]["closestKnownItem"] {
  const vector = features(name);
  if (!vector.length) return undefined;
  devVectors ??= M12_DEV_NAMES.map(item => new Map(features(item.name)));
  let best = -1, bestIndex = -1;
  for (let i = 0; i < devVectors.length; i++) {
    let similarity = 0;
    for (const [index, value] of vector) similarity += value * (devVectors[i].get(index) ?? 0);
    if (similarity > best) { best = similarity; bestIndex = i; }
  }
  if (bestIndex < 0 || best <= 0) return undefined;
  return Object.freeze({ ...M12_DEV_NAMES[bestIndex], source: "CP3 experiment DEV names (AI labels, not human checked)" as const });
}
function keywordNorm(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9&']+/g, " ").trim().replace(/\s+/g, " ");
}
function containsPhrase(name: string, keyword: string): boolean { return ` ${name} `.includes(` ${keyword} `); }
/** One insertion/deletion/substitution or adjacent transposition, as M9's lev1. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const positions: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) positions.push(i);
    return positions.length === 1 || (positions.length === 2 && positions[1] === positions[0] + 1 && a[positions[0]] === b[positions[1]] && a[positions[1]] === b[positions[0]]);
  }
  if (a.length > b.length) [a, b] = [b, a];
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return a.slice(i) === b.slice(i + 1);
}
function sameKind(a: string, b: string): boolean { return a === b || !!PARENTS[a]?.includes(b) || !!PARENTS[b]?.includes(a); }

/**
 * M12: M9 spelling-tolerant keywords AND the supplied P0 character model must agree.
 * The authorised Cleaned_Dataset supplies category_map.csv. An absent keyword table asks the user;
 * the model alone is never substituted for the specified M12 ensemble.
 * Every automatic suggestion remains unconfirmed until a user acts (CP3 V1 pending).
 */
export function suggestProductCategory(name: string, options: {
  readonly keywordDefinitions?: readonly CategoryKeywordDefinition[];
  readonly preparedFoodMarkers?: readonly string[];
} = {}): CategorySuggestion {
  const normalized = keywordNorm(name), model = normalized ? predictM12CategoryModel(name) : undefined;
  const definitions = (options.keywordDefinitions ?? CP3_CATEGORY_DICTIONARY).filter(item => item.provenance.trim() && item.keywords.length);
  const evidence = { modelVersion: "CP3-v2-M12-P0" as const, keywordHits: [] as CategoryKeywordHit[],
    dictionaryProvenance: Object.freeze([...new Set(definitions.map(item => item.provenance))]), closestKnownItem: normalized ? closestDevName(name) : undefined };
  const refuse = (reasonCode: CategorySuggestion["reasonCode"], reason: string): CategorySuggestion => Object.freeze({ state: "needs_category", modelCategory: model?.category,
    requiresConfirmation: true, reasonCode, reason, evidence: Object.freeze({ ...evidence, keywordHits: Object.freeze(evidence.keywordHits) }) });
  if (!normalized) return refuse("empty_name", "Add a product name, then choose its category.");
  if (!definitions.length) return refuse("keyword_table_missing", "The original M9 category keyword table was not supplied. Choose and confirm a category; the model alone cannot confirm one.");
  const tokens = normalized.split(" ");
  if ((options.preparedFoodMarkers ?? M12_PREPARED_FOOD_MARKERS).some(item => tokens.includes(keywordNorm(item))))
    return refuse("prepared_food", "A prepared-food marker was found. Choose and confirm a category.");
  const entries = definitions.flatMap(definition => definition.keywords.map(keyword => ({ keyword: keywordNorm(keyword), definition }))).filter(item => item.keyword);
  const exact = entries.filter(item => containsPhrase(normalized, item.keyword));
  const hits = exact.length ? exact.map(item => ({ keyword: item.keyword, category: item.definition.category, matchedToken: item.keyword, match: "exact" as const, provenance: item.definition.provenance }))
    : entries.filter(item => !item.keyword.includes(" ") && item.keyword.length >= 5).flatMap(item => tokens.filter(token => token.length >= 5 && withinOneEdit(token, item.keyword))
      .map(token => ({ keyword: item.keyword, category: item.definition.category, matchedToken: token, match: "spelling_tolerance" as const, provenance: item.definition.provenance })));
  // Nested exact keywords resolve to the longest; non-nested cross-category hits refuse.
  const remaining = hits.filter(hit => !hits.some(other => hit.keyword !== other.keyword && containsPhrase(other.keyword, hit.keyword)));
  evidence.keywordHits.push(...remaining.map(hit => Object.freeze(hit)));
  const categories = [...new Set(remaining.map(hit => hit.category))];
  if (!categories.length) return refuse("no_keyword", "No supported keyword matched. Choose and confirm a category.");
  if (categories.length > 1) return refuse("ambiguous_keywords", "Keywords matched different categories. Choose and confirm the correct category.");
  const category = categories[0];
  if (NON_FOOD_LABELS.has(category) || definitions.some(item => item.category === category && item.isFood === false)) return refuse("not_food", "This match has no supported food factor. Confirm the item's type manually.");
  if (!model || !sameKind(category, model.category)) return refuse("methods_disagree", "Keyword rules and the character model disagree. Choose and confirm a category.");
  if (!model.passesThreshold) return refuse("model_unsure", "The character model is below the DEV-tuned threshold. Choose and confirm a category.");
  return Object.freeze({ state: "suggested", category, modelCategory: model.category, requiresConfirmation: true,
    evidence: Object.freeze({ ...evidence, keywordHits: Object.freeze(evidence.keywordHits) }) });
}

/** Record an explicit user decision separately from the automatic suggestion. */
export function confirmProductCategory(productName: string, category: string, context: { readonly productKey?: string; readonly evidenceKey?: string } = {}) {
  if (!productName.trim() || !category.trim()) throw new Error("A product name and a category are required for confirmation.");
  return Object.freeze({ state: "confirmed" as const, category: category.trim(), productName, ...context, provenance: "user confirmed" as const, method: "manual" as const });
}
