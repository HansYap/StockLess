import type {
  CsvParseOptions,
  MappingState,
  SessionEnvelope,
  SessionPreferences,
  StocklessSession,
} from "./contracts.ts";
import { parseCsvBytes } from "./csv.ts";
import { createIdentityEvidence } from "./identity.ts";
import { createMappingState } from "./mapping.ts";

/** Documents which content may and may not be stored persistently. */
export const PERSISTENCE_POLICY = Object.freeze({
  retailerDataStores: Object.freeze([] as string[]),
  allowedPersistentContent: Object.freeze(["static application assets", "local AI model assets"]),
  prohibitedPersistentContent: Object.freeze([
    "raw CSV rows",
    "CSV headings and previews",
    "confirmed mappings",
    "derived series",
    "product identifiers",
  ]),
});

/** Creates a unique identifier for an in-memory session. */
function newSessionId(): string {
  return globalThis.crypto.randomUUID();
}

/** Creates a new empty session while preserving optional application preferences. */
export function createEmptySession(
  preferences: SessionPreferences = {},
  now = new Date().toISOString(),
): SessionEnvelope {
  return Object.freeze({
    preferences: Object.freeze({ ...preferences }),
    session: Object.freeze({
      id: newSessionId(),
      mapping: createMappingState(),
      identityEvidence: Object.freeze([]),
      createdAt: now,
    }),
  });
}

/** Replaces the active source atomically and clears dataset-specific state. */
export async function replaceSessionSource(
  envelope: SessionEnvelope,
  bytes: Uint8Array,
  input: CsvParseOptions,
  now = new Date().toISOString(),
): Promise<SessionEnvelope> {
  const dataset = await parseCsvBytes(bytes, input);
  const session: StocklessSession = Object.freeze({
    id: newSessionId(),
    sourceMode: input.sourceMode,
    dataset,
    mapping: createMappingState(),
    identityEvidence: Object.freeze([]),
    createdAt: now,
  });
  return Object.freeze({ preferences: envelope.preferences, session });
}

/** Appends retailer-confirmed product identity evidence to the active session. */
export function recordConfirmedIdentity(
  envelope: SessionEnvelope,
  occurredAt = new Date().toISOString(),
): SessionEnvelope {
  const event = createIdentityEvidence(envelope.session.mapping, occurredAt);
  return Object.freeze({
    preferences: envelope.preferences,
    session: Object.freeze({
      ...envelope.session,
      identityEvidence: Object.freeze([...envelope.session.identityEvidence, event]),
    }),
  });
}

/** Replaces the session's mapping state without changing the parsed dataset. */
export function updateSessionMapping(
  envelope: SessionEnvelope,
  mapping: MappingState,
): SessionEnvelope {
  return Object.freeze({
    preferences: envelope.preferences,
    session: Object.freeze({ ...envelope.session, mapping }),
  });
}

/** Clears active retailer data and returns a fresh in-memory session. */
export function clearActiveSession(
  envelope: SessionEnvelope,
  now = new Date().toISOString(),
): Readonly<{ envelope: SessionEnvelope; cleared: true; message: string }> {
  const empty = createEmptySession(envelope.preferences, now);
  const clearedSession: StocklessSession = Object.freeze({ ...empty.session, clearedAt: now });
  return Object.freeze({
    envelope: Object.freeze({ preferences: empty.preferences, session: clearedSession }),
    cleared: true,
    message: "The active in-memory dataset, mappings, derived references, and identity evidence were cleared.",
  });
}

/** Builds correction-report labels from the active source mode. */
export function correctionReportMetadata(
  session: StocklessSession,
  date: string,
): Readonly<{ filename: string; sourceMode: "Sample data" | "Retailer file" }> {
  const sample = session.sourceMode === "sample";
  return Object.freeze({
    filename: sample
      ? `StockLess_SAMPLE_correction_report_${date}.csv`
      : `StockLess_correction_report_${date}.csv`,
    sourceMode: sample ? "Sample data" : "Retailer file",
  });
}
