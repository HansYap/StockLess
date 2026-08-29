import { useCallback, useState } from "react";
import { AppShell, type StepId } from "./components/AppShell.tsx";
import { UploadScreen } from "./screens/UploadScreen.tsx";
import { MappingScreen } from "./screens/MappingScreen.tsx";
import { ReadinessScreen } from "./screens/ReadinessScreen.tsx";
import { DemandScreen } from "./screens/DemandScreen.tsx";
import type { IssueKind } from "./mock-analysis.ts";
import {
  MappingConflictError,
  confirmIdentityMode,
  confirmMapping,
  createEmptySession,
  proposeMappings,
  recordConfirmedIdentity,
  removeMapping,
  replaceSessionSource,
  setMapping,
  updateSessionMapping,
  type CanonicalField,
  type CsvProgress,
  type MappingProposalResult,
  type MappingState,
  type SessionEnvelope,
  type SourceMode,
} from "./engine.ts";

/** Seeds an unconfirmed mapping state from the engine's proposals. */
function seedFromProposals(
  base: MappingState,
  proposals: MappingProposalResult,
): MappingState {
  let next = base;
  for (const proposal of proposals.proposals) {
    if (!proposal.sourceColumnId) continue;
    try {
      next = setMapping(next, proposal.targetField, proposal.sourceColumnId, false);
    } catch (error) {
      // A proposal that collides with an earlier one is skipped rather than
      // overwriting it; the retailer resolves it manually.
      if (!(error instanceof MappingConflictError)) throw error;
    }
  }
  return next;
}

export default function App() {
  const [envelope, setEnvelope] = useState<SessionEnvelope>(() => createEmptySession());
  const [proposals, setProposals] = useState<MappingProposalResult | null>(null);
  const [step, setStep] = useState<StepId>(1);
  const [reached, setReached] = useState<StepId>(1);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [issueFilter, setIssueFilter] = useState<IssueKind | null>(null);
  const [productKey, setProductKey] = useState<string | null>(null);

  const dataset = envelope.session.dataset;

  const goTo = useCallback((next: StepId) => {
    setStep(next);
    setReached((current) => (next > current ? next : current));
  }, []);

  const handleSource = useCallback(
    async (
      bytes: Uint8Array,
      sourceName: string,
      sourceMode: SourceMode,
      mimeType: string | undefined,
      onProgress: (progress: CsvProgress) => void,
    ) => {
      // replaceSessionSource throws CsvImportError, which UploadScreen renders.
      const next = await replaceSessionSource(envelope, bytes, {
        sourceMode,
        sourceName,
        mimeType,
        onProgress,
      });
      const parsed = next.session.dataset;
      if (!parsed) throw new Error("The parsed dataset is missing from the session.");

      // No semantic scorer yet: the engine falls back to alias, lexical and type gates.
      const proposed = await proposeMappings(parsed);
      setProposals(proposed);
      setEnvelope(updateSessionMapping(next, seedFromProposals(next.session.mapping, proposed)));
      setMappingError(null);
      goTo(2);
    },
    [envelope, goTo],
  );

  const handleSelectColumn = useCallback(
    (field: CanonicalField, sourceColumnId: string | null) => {
      setMappingError(null);
      setEnvelope((current) => {
        try {
          const mapping = sourceColumnId
            ? setMapping(current.session.mapping, field, sourceColumnId, false)
            : removeMapping(current.session.mapping, field);
          return updateSessionMapping(current, mapping);
        } catch (error) {
          setMappingError(
            error instanceof MappingConflictError
              ? `That column is already used for ${error.existingTarget.replace(/_/g, " ")}. Clear it there first.`
              : error instanceof Error
                ? error.message
                : "The mapping could not be updated.",
          );
          return current;
        }
      });
    },
    [],
  );

  const handleConfirmField = useCallback((field: CanonicalField) => {
    setMappingError(null);
    setEnvelope((current) => {
      try {
        return updateSessionMapping(current, confirmMapping(current.session.mapping, field));
      } catch (error) {
        setMappingError(error instanceof Error ? error.message : "The field could not be confirmed.");
        return current;
      }
    });
  }, []);

  const handleConfirmIdentity = useCallback((mode: "stable" | "composite") => {
    setMappingError(null);
    setEnvelope((current) => {
      try {
        const withMode = updateSessionMapping(
          current,
          confirmIdentityMode(current.session.mapping, mode),
        );
        return recordConfirmedIdentity(withMode);
      } catch (error) {
        setMappingError(error instanceof Error ? error.message : "The identity could not be confirmed.");
        return current;
      }
    });
  }, []);

  return (
    <AppShell current={step} reached={reached} onNavigate={goTo}>
      {step === 1 && <UploadScreen onSource={handleSource} />}

      {step === 2 && dataset && (
        <MappingScreen
          dataset={dataset}
          mapping={envelope.session.mapping}
          proposals={proposals}
          error={mappingError}
          onSelectColumn={handleSelectColumn}
          onConfirmField={handleConfirmField}
          onConfirmIdentity={handleConfirmIdentity}
          onBack={() => {
            setEnvelope(createEmptySession(envelope.preferences));
            setProposals(null);
            setReached(1);
            setStep(1);
          }}
          onContinue={() => goTo(3)}
        />
      )}

      {step === 3 && dataset && (
        <ReadinessScreen
          dataset={dataset}
          mapping={envelope.session.mapping}
          filter={issueFilter}
          onFilter={setIssueFilter}
          onBack={() => setStep(2)}
          onContinue={() => goTo(4)}
        />
      )}

      {step === 4 && dataset && (
        <DemandScreen
          dataset={dataset}
          mapping={envelope.session.mapping}
          selectedKey={productKey}
          onSelect={setProductKey}
          onBack={() => setStep(3)}
        />
      )}

    </AppShell>
  );
}
