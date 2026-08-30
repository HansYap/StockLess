import { useCallback, useRef, useState } from "react";
import { AppShell, type StepId } from "./components/AppShell.tsx";
import { UploadScreen } from "./screens/UploadScreen.tsx";
import { MappingScreen } from "./screens/MappingScreen.tsx";
import { ReadinessScreen, type ReadinessIssueFilter } from "./screens/ReadinessScreen.tsx";
import { DemandScreen } from "./screens/DemandScreen.tsx";
import {
  MappingConflictError,
  FIELD_REGISTRY,
  clearActiveSession,
  confirmIdentityMode,
  confirmMappingWithRelease,
  createEmptySession,
  correctionReportMetadata,
  proposeMappings,
  recordConfirmedIdentity,
  removeMapping,
  setMapping,
  updateSessionMapping,
  type CanonicalField,
  type ConfirmedDateFormat,
  type CsvProgress,
  type DateFormatConfirmation,
  type DuplicateDecision,
  type MappingProposalResult,
  type MappingState,
  type ReadinessSnapshot,
  type SessionEnvelope,
  type SourceMode,
} from "./engine.ts";
import { replaceSessionSourceInWorker } from "./workers/import-session-client.ts";
import { runReadinessCheckInWorker } from "./workers/readiness-client.ts";
import { createLocalSemanticScorer } from "./workers/semantic-client.ts";
import { terminateStocklessWorkers } from "./workers/worker-registry.ts";

/** Seeds an unconfirmed mapping state from the engine's proposals. */
function seedFromProposals(base: MappingState, proposals: MappingProposalResult): MappingState {
  let next = base;
  for (const proposal of proposals.proposals) {
    if (!proposal.sourceColumnId) continue;
    try {
      next = setMapping(next, proposal.targetField, proposal.sourceColumnId, false);
    } catch (error) {
      if (!(error instanceof MappingConflictError)) throw error;
    }
  }
  return next;
}

/** Returns the retailer-facing calendar date in the specification's fixed zone. */
function malaysiaDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
}

export default function App() {
  const [envelope, setEnvelope] = useState<SessionEnvelope>(() => createEmptySession());
  const [proposals, setProposals] = useState<MappingProposalResult | null>(null);
  const [step, setStep] = useState<StepId>(1);
  const [reached, setReached] = useState<StepId>(1);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappingNotice, setMappingNotice] = useState<string | null>(null);
  const [issueFilter, setIssueFilter] = useState<ReadinessIssueFilter | null>(null);
  const [productKey, setProductKey] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReadinessSnapshot | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [dateConfirmations, setDateConfirmations] = useState<readonly DateFormatConfirmation[]>([]);
  const [duplicateDecisions, setDuplicateDecisions] = useState<Readonly<Record<string, DuplicateDecision>>>({});
  const [analysisDate, setAnalysisDate] = useState(malaysiaDate);
  const readinessRun = useRef(0);
  const readinessAbort = useRef<AbortController | null>(null);

  const dataset = envelope.session.dataset;

  const goTo = useCallback((next: StepId) => {
    setStep(next);
    setReached((current) => (next > current ? next : current));
  }, []);

  const resetReadinessEvidence = useCallback(() => {
    readinessAbort.current?.abort();
    readinessAbort.current = null;
    readinessRun.current += 1;
    setReadiness(null);
    setReadinessLoading(false);
    setReadinessError(null);
    setDateConfirmations([]);
    setDuplicateDecisions({});
    setIssueFilter(null);
    setReached((current) => current > 2 ? 2 : current);
  }, []);

  const executeReadiness = useCallback(async (
    confirmations: readonly DateFormatConfirmation[] = dateConfirmations,
    decisions: Readonly<Record<string, DuplicateDecision>> = duplicateDecisions,
    navigate = false,
  ) => {
    if (!dataset) return;
    readinessAbort.current?.abort();
    const controller = new AbortController();
    readinessAbort.current = controller;
    const runId = readinessRun.current + 1;
    readinessRun.current = runId;
    setReadinessLoading(true);
    setReadinessError(null);
    try {
      const snapshot = await runReadinessCheckInWorker(dataset, envelope.session.mapping, {
        analysisDate,
        dateConfirmations: confirmations,
        duplicateDecisions: decisions,
      }, controller.signal);
      if (readinessRun.current !== runId) return;
      setReadiness(snapshot);
      if (navigate) goTo(3);
    } catch (error) {
      if (readinessRun.current !== runId) return;
      setReadinessError(error instanceof Error ? error.message : "The readiness check could not be completed.");
    } finally {
      if (readinessAbort.current === controller) readinessAbort.current = null;
      if (readinessRun.current === runId) setReadinessLoading(false);
    }
  }, [analysisDate, dataset, dateConfirmations, duplicateDecisions, envelope.session.mapping, goTo]);

  const handleSource = useCallback(async (
    bytes: Uint8Array,
    sourceName: string,
    sourceMode: SourceMode,
    mimeType: string | undefined,
    onProgress: (progress: CsvProgress) => void,
    signal: AbortSignal,
  ) => {
    const previousMode = envelope.session.sourceMode;
    const next = await replaceSessionSourceInWorker(envelope, bytes, {
      sourceMode,
      sourceName,
      mimeType,
      onProgress,
      signal,
    });
    const parsed = next.session.dataset;
    if (!parsed) throw new Error("The parsed dataset is missing from the session.");

    const proposed = await proposeMappings(parsed, createLocalSemanticScorer(signal));
    resetReadinessEvidence();
    setProposals(proposed);
    setEnvelope(updateSessionMapping(next, seedFromProposals(next.session.mapping, proposed)));
    setMappingError(null);
    setMappingNotice(null);
    setProductKey(null);
    setAnalysisDate(malaysiaDate());
    setSessionNotice(previousMode && previousMode !== sourceMode
      ? `${previousMode === "sample" ? "Sample data" : "The retailer file"} was replaced. Dataset-specific mappings and results were cleared.`
      : sourceMode === "sample" ? "Sample data loaded." : "Retailer file loaded locally.");
    goTo(2);
  }, [envelope, goTo, resetReadinessEvidence]);

  const handleSelectColumn = useCallback((field: CanonicalField, sourceColumnId: string | null) => {
    setMappingError(null);
    setMappingNotice(null);
    resetReadinessEvidence();
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
            : error instanceof Error ? error.message : "The mapping could not be updated.",
        );
        return current;
      }
    });
  }, [resetReadinessEvidence]);

  const handleConfirmField = useCallback((field: CanonicalField) => {
    setMappingError(null);
    setMappingNotice(null);
    resetReadinessEvidence();
    setEnvelope((current) => {
      try {
        const result = confirmMappingWithRelease(current.session.mapping, field);
        if (result.releasedFields.length > 0) {
          const released = result.releasedFields.map((releasedField) => FIELD_REGISTRY[releasedField].label);
          setMappingNotice(
            `${released.join(" and ")} ${released.length === 1 ? "was" : "were"} released and ${released.length === 1 ? "is" : "are"} now Not matched yet.`,
          );
        }
        return updateSessionMapping(current, result.state);
      } catch (error) {
        setMappingError(error instanceof Error ? error.message : "The field could not be confirmed.");
        return current;
      }
    });
  }, [resetReadinessEvidence]);

  const handleConfirmIdentity = useCallback((mode: "stable" | "composite") => {
    setMappingError(null);
    setMappingNotice(null);
    resetReadinessEvidence();
    setEnvelope((current) => {
      try {
        const withMode = updateSessionMapping(current, confirmIdentityMode(current.session.mapping, mode));
        return recordConfirmedIdentity(withMode);
      } catch (error) {
        setMappingError(error instanceof Error ? error.message : "The identity could not be confirmed.");
        return current;
      }
    });
  }, [resetReadinessEvidence]);

  const handleConfirmDateFormat = useCallback((sourceColumnId: string, format: ConfirmedDateFormat) => {
    const next = Object.freeze([
      ...dateConfirmations.filter((confirmation) => confirmation.sourceColumnId !== sourceColumnId),
      Object.freeze({ sourceColumnId, format, confirmationId: globalThis.crypto.randomUUID() }),
    ]);
    setDateConfirmations(next);
    setDuplicateDecisions({});
    void executeReadiness(next, {});
  }, [dateConfirmations, executeReadiness]);

  const handleDuplicateDecision = useCallback((fingerprint: string, decision: DuplicateDecision) => {
    const next = Object.freeze({ ...duplicateDecisions, [fingerprint]: decision });
    setDuplicateDecisions(next);
    void executeReadiness(dateConfirmations, next);
  }, [dateConfirmations, duplicateDecisions, executeReadiness]);

  const handleClearSession = useCallback(() => {
    terminateStocklessWorkers();
    const cleared = clearActiveSession(envelope);
    resetReadinessEvidence();
    setEnvelope(cleared.envelope);
    setProposals(null);
    setMappingError(null);
    setMappingNotice(null);
    setProductKey(null);
    setReached(1);
    setStep(1);
    setSessionNotice(cleared.message);
  }, [envelope, resetReadinessEvidence]);

  const reportMetadata = correctionReportMetadata(envelope.session, analysisDate);

  return (
    <AppShell
      current={step}
      reached={reached}
      onNavigate={goTo}
      sourceMode={envelope.session.sourceMode}
      sourceName={dataset?.sourceName}
      notice={sessionNotice}
      onClear={dataset ? handleClearSession : undefined}
    >
      {step === 1 && <UploadScreen onSource={handleSource} onCancel={handleClearSession} />}

      {step === 2 && dataset && (
        <MappingScreen
          dataset={dataset}
          mapping={envelope.session.mapping}
          proposals={proposals}
          error={mappingError}
          notice={mappingNotice}
          onSelectColumn={handleSelectColumn}
          onConfirmField={handleConfirmField}
          onConfirmIdentity={handleConfirmIdentity}
          onBack={() => setStep(1)}
          onContinue={() => void executeReadiness(dateConfirmations, duplicateDecisions, true)}
          checking={readinessLoading}
        />
      )}

      {step === 3 && dataset && readiness && (
        <ReadinessScreen
          dataset={dataset}
          mapping={envelope.session.mapping}
          snapshot={readiness}
          dateConfirmations={dateConfirmations}
          checking={readinessLoading}
          error={readinessError}
          filter={issueFilter}
          onFilter={setIssueFilter}
          onConfirmDateFormat={handleConfirmDateFormat}
          onDuplicateDecision={handleDuplicateDecision}
          onBack={() => setStep(2)}
          onContinue={() => goTo(4)}
          reportFilename={reportMetadata.filename}
        />
      )}

      {step === 3 && dataset && !readiness && (
        <section className="card pending">
          <h1 className="card-title">Readiness evidence needs to be refreshed</h1>
          <p className="card-sub">Run the check again after confirming the current mappings.</p>
          {readinessError && <p className="notice notice--error" role="alert">{readinessError}</p>}
          <button
            type="button"
            className="btn btn--primary"
            disabled={readinessLoading}
            onClick={() => void executeReadiness(dateConfirmations, duplicateDecisions)}
            aria-busy={readinessLoading}
          >
            {readinessLoading && <span className="btn__spinner" aria-hidden="true" />}
            {readinessLoading ? "Checking locally…" : "Run readiness check"}
          </button>
        </section>
      )}

      {step === 4 && readiness && (
        <DemandScreen
          snapshot={readiness}
          selectedKey={productKey}
          onSelect={setProductKey}
          onBack={() => setStep(3)}
        />
      )}
    </AppShell>
  );
}
