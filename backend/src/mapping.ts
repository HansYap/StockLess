import type {
  CandidateScore,
  CanonicalField,
  FieldMapping,
  MappingProposal,
  MappingProposalResult,
  MappingState,
  ParsedDataset,
  SemanticScoreRequest,
  SemanticScorer,
  SourceColumn,
  ValueKind,
} from "./contracts.ts";
import { CANONICAL_FIELDS, FIELD_REGISTRY } from "./field-registry.ts";

const SUGGESTION_THRESHOLD = 0.78;
const SUGGESTION_MARGIN = 0.08;
const TYPE_GATE = 0.8;

/** Raised when one source column is assigned to multiple target fields. */
export class MappingConflictError extends Error {
  readonly sourceColumnId: string;
  readonly existingTarget: CanonicalField;

  /** Creates an error that identifies the conflicting source and existing target. */
  constructor(sourceColumnId: string, existingTarget: CanonicalField) {
    super(`Source column ${sourceColumnId} is already mapped to ${existingTarget}.`);
    this.name = "MappingConflictError";
    this.sourceColumnId = sourceColumnId;
    this.existingTarget = existingTarget;
  }
}

/** Normalizes a header for comparison without changing the source column name. */
export function normalizeHeader(header: string): string {
  return header
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[_\-./\\]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Measures how many normalized words two strings have in common. */
function tokenJaccard(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (leftTokens.size === 0 && rightTokens.size === 0) return 1;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Calculates the minimum character edits needed to change one string into another. */
function levenshtein(left: string, right: string): number {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

/** Returns the stronger of token overlap and edit-distance similarity. */
function lexicalSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeHeader(left);
  const normalizedRight = normalizeHeader(right);
  const maxLength = Math.max(normalizedLeft.length, normalizedRight.length);
  const editSimilarity = maxLength === 0 ? 1 : 1 - levenshtein(normalizedLeft, normalizedRight) / maxLength;
  return Math.max(tokenJaccard(normalizedLeft, normalizedRight), editSimilarity);
}

/** Checks that year, month, and day form a real calendar date. */
function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day;
}

/** Recognizes supported date-shaped preview values for mapping type checks. */
function looksLikeDate(value: string): boolean {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return isValidCalendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const separated = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(value);
  if (!separated) return false;
  const first = Number(separated[1]);
  const second = Number(separated[2]);
  const year = Number(separated[3]);
  return isValidCalendarDate(year, second, first) || isValidCalendarDate(year, first, second);
}

/** Checks that a value is a strict finite decimal without locale guessing. */
function isFiniteDecimal(value: string): boolean {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return false;
  return Number.isFinite(Number(value));
}

/** Checks whether a preview value matches a canonical field's expected type. */
function valueMatchesKind(value: string, kind: ValueKind): boolean {
  switch (kind) {
    case "date":
      return looksLikeDate(value);
    case "decimal":
      return isFiniteDecimal(value);
    case "non_negative_decimal":
      return isFiniteDecimal(value) && Number(value) >= 0;
    case "non_negative_integer":
      return /^\+?\d+$/.test(value);
    case "text":
      return value.trim() !== "";
  }
}

/** Calculates the proportion of nonblank previews matching the expected type. */
function typeScore(column: SourceColumn, kind: ValueKind): number {
  const values = column.previewValues.filter((value) => value.trim() !== "");
  if (values.length === 0) return 0;
  return values.filter((value) => valueMatchesKind(value, kind)).length / values.length;
}

/** Collects the canonical label, description, and aliases used for matching. */
function targetPrompts(field: CanonicalField): readonly string[] {
  const definition = FIELD_REGISTRY[field];
  return [definition.field, definition.label, definition.description, ...definition.aliases];
}

/** Finds the best lexical match between a source header and a target field. */
function bestLexicalScore(sourceHeader: string, field: CanonicalField): number {
  return Math.max(...targetPrompts(field).map((prompt) => lexicalSimilarity(sourceHeader, prompt)));
}

/** Checks that a normalized header is an alias for exactly one target field. */
function uniqueExactAlias(sourceHeader: string, targetField: CanonicalField): boolean {
  const normalized = normalizeHeader(sourceHeader);
  const matches = CANONICAL_FIELDS.filter((field) =>
    [FIELD_REGISTRY[field].field, FIELD_REGISTRY[field].label, ...FIELD_REGISTRY[field].aliases]
      .map(normalizeHeader)
      .includes(normalized),
  );
  return matches.length === 1 && matches[0] === targetField;
}

/** Converts an accepted candidate into the score band shown by the interface. */
function scoreBand(exactAlias: boolean): "exact_alias" | "high" {
  return exactAlias ? "exact_alias" : "high";
}

/** Runs the optional local scorer and returns safe zero scores on failure. */
async function semanticScores(
  dataset: ParsedDataset,
  scorer?: SemanticScorer,
): Promise<{ scores: readonly number[]; requests: readonly SemanticScoreRequest[]; usedModel: boolean; notice?: string }> {
  const requests: SemanticScoreRequest[] = [];
  for (const field of CANONICAL_FIELDS) {
    for (const column of dataset.columns) {
      requests.push({
        sourceHeader: normalizeHeader(column.header),
        targetField: field,
        targetPrompts: targetPrompts(field),
      });
    }
  }

  if (!scorer) {
    return {
      scores: Object.freeze(requests.map(() => 0)),
      requests: Object.freeze(requests),
      usedModel: false,
      notice: "The local AI model could not load. Suggestions may be less complete, but your file is still loaded and every attribute can be matched by hand.",
    };
  }

  try {
    const scores = await scorer.score(requests);
    if (scores.length !== requests.length || scores.some((score) => !Number.isFinite(score) || score < 0 || score > 1)) {
      throw new Error("The semantic scorer returned an invalid score collection.");
    }
    return { scores: Object.freeze([...scores]), requests: Object.freeze(requests), usedModel: true };
  } catch {
    return {
      scores: Object.freeze(requests.map(() => 0)),
      requests: Object.freeze(requests),
      usedModel: false,
      notice: "The local AI model could not load. Suggestions may be less complete, but your file is still loaded and every attribute can be matched by hand.",
    };
  }
}

/** Proposes safe one-to-one column matches without confirming any mapping. */
export async function proposeMappings(
  dataset: ParsedDataset,
  scorer?: SemanticScorer,
): Promise<MappingProposalResult> {
  const semantic = await semanticScores(dataset, scorer);
  const candidateByField = new Map<CanonicalField, CandidateScore[]>();
  let semanticIndex = 0;

  for (const field of CANONICAL_FIELDS) {
    const definition = FIELD_REGISTRY[field];
    const fieldCandidates: CandidateScore[] = [];
    for (const column of dataset.columns) {
      const semanticScore = semantic.scores[semanticIndex] ?? 0;
      semanticIndex += 1;
      const lexicalScore = bestLexicalScore(column.header, field);
      const profiledTypeScore = typeScore(column, definition.valueKind);
      const exactAlias = uniqueExactAlias(column.header, field) && profiledTypeScore >= TYPE_GATE;
      const combinedScore = exactAlias
        ? 1
        : semantic.usedModel
          ? 0.55 * semanticScore + 0.3 * lexicalScore + 0.15 * profiledTypeScore
          : (2 / 3) * lexicalScore + (1 / 3) * profiledTypeScore;

      fieldCandidates.push(Object.freeze({
        targetField: field,
        sourceColumnId: column.id,
        sourceHeader: column.header,
        semanticScore,
        lexicalScore,
        typeScore: profiledTypeScore,
        combinedScore,
        exactAlias,
      }));
    }
    fieldCandidates.sort((left, right) => right.combinedScore - left.combinedScore || left.sourceColumnId.localeCompare(right.sourceColumnId));
    candidateByField.set(field, fieldCandidates);
  }

  const eligible = CANONICAL_FIELDS.map((field) => {
    const candidates = candidateByField.get(field) ?? [];
    const best = candidates[0];
    const runnerUp = candidates[1];
    if (!best) return undefined;
    const needsStrictTypeGate = FIELD_REGISTRY[field].valueKind !== "text";
    const passesTypeGate = !needsStrictTypeGate || best.typeScore >= TYPE_GATE;
    const passesScore = best.exactAlias || best.combinedScore >= SUGGESTION_THRESHOLD;
    const passesMargin = best.exactAlias || best.combinedScore - (runnerUp?.combinedScore ?? 0) >= SUGGESTION_MARGIN;
    return passesTypeGate && passesScore && passesMargin ? best : undefined;
  }).filter((candidate): candidate is CandidateScore => candidate !== undefined)
    .sort((left, right) => right.combinedScore - left.combinedScore || left.targetField.localeCompare(right.targetField));

  // Each eligible target contributes only its safe top candidate. Selecting in
  // descending weight is the maximum-weight one-to-one set for these gated edges.
  const assignedByTarget = new Map<CanonicalField, CandidateScore>();
  const claimedSourceColumns = new Set<string>();
  for (const candidate of eligible) {
    if (!claimedSourceColumns.has(candidate.sourceColumnId)) {
      assignedByTarget.set(candidate.targetField, candidate);
      claimedSourceColumns.add(candidate.sourceColumnId);
    }
  }

  const proposals: MappingProposal[] = CANONICAL_FIELDS.map((field) => {
    const candidate = assignedByTarget.get(field);
    const candidates = Object.freeze((candidateByField.get(field) ?? []).slice(0, 5));
    if (!candidate) {
      return Object.freeze({
        targetField: field,
        previewValues: Object.freeze([]),
        scoreBand: "unconfirmed" as const,
        reason: "No candidate passed the safety score, margin, type, and one-to-one mapping gates. Choose a source column manually.",
        confirmed: false as const,
        candidates,
      });
    }

    const column = dataset.columns.find((value) => value.id === candidate.sourceColumnId)!;
    return Object.freeze({
      targetField: field,
      sourceColumnId: candidate.sourceColumnId,
      sourceHeader: candidate.sourceHeader,
      previewValues: column.previewValues,
      score: candidate.combinedScore,
      scoreBand: scoreBand(candidate.exactAlias),
      reason: candidate.exactAlias
        ? "Unique approved alias with a compatible preview-value type. Retailer confirmation is still required."
        : "Candidate passed the score, margin, type, and one-to-one mapping gates. Retailer confirmation is still required.",
      confirmed: false as const,
      candidates,
    });
  });

  return Object.freeze({
    proposals: Object.freeze(proposals),
    usedSemanticModel: semantic.usedModel,
    fallbackNotice: semantic.notice,
  });
}

/** Creates an empty mapping state with no confirmed product identity. */
export function createMappingState(): MappingState {
  return Object.freeze({ mappings: Object.freeze({}), identityConfirmed: false });
}

/** Assigns a source column to a target; unconfirmed choices may temporarily overlap. */
export function setMapping(
  state: MappingState,
  targetField: CanonicalField,
  sourceColumnId: string,
  confirmed = false,
): MappingState {
  const mappings = { ...state.mappings };
  if (confirmed) {
    for (const [existingTarget, mapping] of Object.entries(mappings) as [CanonicalField, FieldMapping][]) {
      if (existingTarget !== targetField && mapping.sourceColumnId === sourceColumnId) delete mappings[existingTarget];
    }
  }

  return Object.freeze({
    ...state,
    mappings: Object.freeze({
      ...mappings,
      [targetField]: Object.freeze({
        targetField,
        sourceColumnId,
        confirmed,
        confirmationSource: confirmed ? "retailer" : undefined,
      }),
    }),
  });
}

/** Removes one target mapping and returns a new immutable state. */
export function removeMapping(state: MappingState, targetField: CanonicalField): MappingState {
  const mappings = { ...state.mappings };
  delete mappings[targetField];
  const removedIdentityField = state.identityMode === "stable"
    ? targetField === "product_code"
    : state.identityMode === "composite" && (targetField === "product_name" || targetField === "pack_variant");
  return Object.freeze({
    ...state,
    mappings: Object.freeze(mappings),
    identityConfirmed: removedIdentityField ? false : state.identityConfirmed,
  });
}

export interface ConfirmMappingResult {
  readonly state: MappingState;
  readonly releasedFields: readonly CanonicalField[];
}

/** Confirms a mapping and releases any other attribute using the same column. */
export function confirmMappingWithRelease(state: MappingState, targetField: CanonicalField): ConfirmMappingResult {
  const mapping = state.mappings[targetField];
  if (!mapping) throw new Error(`Cannot confirm ${targetField}: no source column is selected.`);

  const releasedFields = (Object.entries(state.mappings) as [CanonicalField, FieldMapping][])
    .filter(([existingTarget, existing]) =>
      existingTarget !== targetField && existing.sourceColumnId === mapping.sourceColumnId)
    .map(([existingTarget]) => existingTarget);
  const confirmed = setMapping(state, targetField, mapping.sourceColumnId, true);
  const releasedIdentityField = releasedFields.some((field) =>
    state.identityMode === "stable"
      ? field === "product_code"
      : state.identityMode === "composite" && (field === "product_name" || field === "pack_variant"));

  return Object.freeze({
    state: releasedIdentityField
      ? Object.freeze({ ...confirmed, identityConfirmed: false })
      : confirmed,
    releasedFields: Object.freeze(releasedFields),
  });
}

/** Marks an existing field mapping as retailer-confirmed. */
export function confirmMapping(state: MappingState, targetField: CanonicalField): MappingState {
  return confirmMappingWithRelease(state, targetField).state;
}

/** Confirms a valid stable-code or composite product identity path. */
export function confirmIdentityMode(state: MappingState, mode: "stable" | "composite"): MappingState {
  const required = mode === "stable" ? ["product_code"] : ["product_name", "pack_variant"];
  const missing = required.filter((field) => !state.mappings[field as CanonicalField]?.confirmed);
  if (missing.length > 0) {
    throw new Error(`Cannot confirm ${mode} identity until these mappings are confirmed: ${missing.join(", ")}.`);
  }
  return Object.freeze({ ...state, identityMode: mode, identityConfirmed: true });
}

/** Lists the unresolved core mappings that prevent readiness processing. */
export function getReadinessBlockers(state: MappingState): readonly string[] {
  const blockers: string[] = [];
  if (!state.mappings.transaction_date?.confirmed) blockers.push(FIELD_REGISTRY.transaction_date.label);
  if (!state.mappings.quantity_sold?.confirmed) blockers.push(FIELD_REGISTRY.quantity_sold.label);

  const stableReady = state.identityMode === "stable" && state.identityConfirmed && state.mappings.product_code?.confirmed;
  const compositeReady = state.identityMode === "composite"
    && state.identityConfirmed
    && state.mappings.product_name?.confirmed
    && state.mappings.pack_variant?.confirmed;
  if (!stableReady && !compositeReady) {
    blockers.push("How your products are named or coded");
  }
  return Object.freeze(blockers);
}
