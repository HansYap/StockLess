import { confirmIdentityMode, confirmMapping, type CanonicalField, type MappingState } from "./engine.ts";

/** Preview the current selections without mutating the session or resolving duplicate columns. */
export function confirmCurrentMapping(mapping: MappingState): MappingState | null {
  const matches = Object.values(mapping.mappings).filter((match) => match !== undefined);
  if (new Set(matches.map((match) => match.sourceColumnId)).size !== matches.length) return null;
  let next = mapping;
  for (const field of Object.keys(next.mappings) as CanonicalField[]) {
    if (next.mappings[field]?.confirmed === false) next = confirmMapping(next, field);
  }
  if (!next.identityConfirmed) {
    const mode = next.identityMode ?? (next.mappings.product_code?.confirmed ? "stable"
      : next.mappings.product_name?.confirmed && next.mappings.pack_variant?.confirmed ? "composite" : undefined);
    if (mode) {
      try {
        next = confirmIdentityMode(next, mode);
      } catch {
        // An incomplete selected identity remains unconfirmed and blocks continuation.
      }
    }
  }
  return next;
}
