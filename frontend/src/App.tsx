import { t, useLanguage } from "./i18n/index.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, type StepId } from "./components/AppShell.tsx";
import { SavedDataControls, SaveDatasetControls } from "./components/SavedDataControls.tsx";
import { UploadScreen } from "./screens/UploadScreen.tsx";
import { MappingScreen } from "./screens/MappingScreen.tsx";
import { ReadinessScreen, type ReadinessIssueFilter } from "./screens/ReadinessScreen.tsx";
import { PurchasePlanScreen } from "./screens/PurchasePlanScreen.tsx";
import { ImpactDashboard } from "./screens/ImpactDashboard.tsx";
import { evaluatePurchaseProduct, joinPurchaseEvidence, type PurchaseDrafts } from "./purchase-plan/model.ts";
import {
  MappingConflictError,
  READINESS_POLICY_VERSION,
  getReadinessBlockers,
  clearActiveSession,
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
  type DemandForecastReview,
  type MappingProposalResult,
  type MappingState,
  type ReadinessSnapshot,
  type SessionEnvelope,
  type SourceMode,
  evaluateProductPurchasePlan,
} from "./engine.ts";
import { replaceSessionSourceInWorker } from "./workers/import-session-client.ts";
import { runDemandForecastInWorker } from "./workers/forecast-client.ts";
import { runReadinessCheckInWorker } from "./workers/readiness-client.ts";
import { createLocalSemanticScorer } from "./workers/semantic-client.ts";
import { terminateStocklessWorkers } from "./workers/worker-registry.ts";
import { confirmCurrentMapping } from "./mapping-confirmation.ts";
import {
  clearEverything, createSavedDataset, findSavedDataset, getSavedDataset,
  listSavedDatasets, recordDecision, recordOutcome, removeSavedDataset,
  removeSavedDecision, removeSavedOutcome, removeSavedPlan,
  replaceSavedDataset, saveDatasetWork,
  type SavedDataset, type SavedDatasetSummary, type SavedWork,
} from "./storage/saved-datasets.ts";

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

interface AppProps {
  readonly initialDatasetId?: string;
  readonly updateDatasetId?: string;
}

export default function App({ initialDatasetId, updateDatasetId }: AppProps = {}) {
  useLanguage();
  const [envelope, setEnvelope] = useState<SessionEnvelope>(() => createEmptySession());
  const [proposals, setProposals] = useState<MappingProposalResult | null>(null);
  const [step, setStep] = useState<StepId>(1);
  const [showImpact, setShowImpact] = useState(false);
  const [reached, setReached] = useState<StepId>(1);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappingNotice, setMappingNotice] = useState<string | null>(null);
  const [issueFilter, setIssueFilter] = useState<ReadinessIssueFilter | null>(null);
  const [productKey, setProductKey] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReadinessSnapshot | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [purchaseDrafts, setPurchaseDrafts] = useState<PurchaseDrafts>({});
  const [forecast, setForecast] = useState<DemandForecastReview | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [dateConfirmations, setDateConfirmations] = useState<readonly DateFormatConfirmation[]>([]);
  const [analysisDate, setAnalysisDate] = useState(malaysiaDate);
  const [savedDatasets, setSavedDatasets] = useState<readonly SavedDatasetSummary[]>([]);
  const [selectedSaved, setSelectedSaved] = useState<SavedDataset | null>(null);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [updateTargetId, setUpdateTargetId] = useState<string | null>(updateDatasetId ?? null);
  const [openingDataset, setOpeningDataset] = useState(Boolean(initialDatasetId));
  const [saveError, setSaveError] = useState<string | null>(null);
  const retrySave = useRef<(() => Promise<void>) | null>(null);
  const lastSavedEnvelope = useRef<SessionEnvelope | null>(null);
  const readinessRun = useRef(0);
  const readinessAbort = useRef<AbortController | null>(null);
  const forecastRun = useRef(0);
  const forecastAbort = useRef<AbortController | null>(null);

  const dataset = envelope.session.dataset;

  const refreshSavedDatasets = useCallback(async () => {
    setSavedDatasets(await listSavedDatasets());
  }, []);

  const inspectSavedDataset = useCallback(async (id: string) => {
    setSelectedSaved((await getSavedDataset(id)) ?? null);
  }, []);

  useEffect(() => {
    void refreshSavedDatasets().catch(() => setSaveError("Saved information is unavailable here. You can still upload a file or use the sample."));
  }, [refreshSavedDatasets]);

  const persistWork = useCallback(async (id: string, work: Partial<SavedWork>) => {
    const retry = async () => {
      const saved = await saveDatasetWork(id, work);
      setSelectedSaved((current) => current?.id === id ? saved : current);
      setSaveError(null);
      retrySave.current = null;
      await refreshSavedDatasets();
    };
    try { await retry(); }
    catch {
      retrySave.current = retry;
      setSaveError("Your latest changes could not be saved. Your inputs are still here.");
    }
  }, [refreshSavedDatasets]);

  useEffect(() => {
    if (!activeSavedId || !dataset || lastSavedEnvelope.current === envelope) return;
    lastSavedEnvelope.current = envelope;
    void persistWork(activeSavedId, {
      envelope, analysisDate, dateConfirmations, readiness, forecast,
    });
  }, [activeSavedId, dataset, envelope, analysisDate, dateConfirmations, readiness, forecast, persistWork]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  const goTo = useCallback((next: StepId) => {
    setShowImpact(false);
    setStep(next);
    setReached((current) => (next > current ? next : current));
  }, []);

  const resetForecastEvidence = useCallback(() => {
    forecastAbort.current?.abort();
    forecastAbort.current = null;
    forecastRun.current += 1;
    setForecast(null);
    setForecastLoading(false);
    setForecastError(null);
  }, []);

  const resetReadinessEvidence = useCallback(() => {
    setPurchaseDrafts({});
    setProductKey(null);
    readinessAbort.current?.abort();
    readinessAbort.current = null;
    readinessRun.current += 1;
    setReadiness(null);
    setReadinessLoading(false);
    setReadinessError(null);
    setDateConfirmations([]);
    setIssueFilter(null);
    resetForecastEvidence();
    setReached((current) => current > 2 ? 2 : current);
  }, [resetForecastEvidence]);

  const executeReadiness = useCallback(async (
    confirmations: readonly DateFormatConfirmation[] = dateConfirmations,
    navigate = false,
    activeEnvelope = envelope,
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
      const snapshot = await runReadinessCheckInWorker(dataset, activeEnvelope.session.mapping, {
        analysisDate,
        dateConfirmations: confirmations,
      }, controller.signal);
      if (readinessRun.current !== runId) return;
      resetForecastEvidence();
      setReadiness(snapshot);
      if (activeSavedId) void persistWork(activeSavedId, {
        envelope: activeEnvelope, analysisDate, dateConfirmations: confirmations,
        readiness: snapshot, forecast: null,
      });
      if (navigate) goTo(3);
    } catch (error) {
      if (readinessRun.current !== runId) return;
      setReadinessError(error instanceof Error ? error.message : "The readiness check could not be completed.");
    } finally {
      if (readinessAbort.current === controller) readinessAbort.current = null;
      if (readinessRun.current === runId) setReadinessLoading(false);
    }
  }, [activeSavedId, analysisDate, dataset, dateConfirmations, envelope, goTo, persistWork, resetForecastEvidence]);

  const executeForecast = useCallback(async () => {
    if (!readiness) return;
    if (forecast?.snapshotId === readiness.id) {
      goTo(4);
      return;
    }
    forecastAbort.current?.abort();
    const controller = new AbortController();
    forecastAbort.current = controller;
    const runId = forecastRun.current + 1;
    forecastRun.current = runId;
    setForecastLoading(true);
    setForecastError(null);
    try {
      const review = await runDemandForecastInWorker(readiness, controller.signal);
      if (forecastRun.current !== runId) return;
      setForecast(review);
      if (activeSavedId) void persistWork(activeSavedId, { forecast: review });
      goTo(4);
    } catch (error) {
      if (forecastRun.current !== runId) return;
      setForecastError(error instanceof Error ? error.message : "Demand estimation could not be completed.");
    } finally {
      if (forecastAbort.current === controller) forecastAbort.current = null;
      if (forecastRun.current === runId) setForecastLoading(false);
    }
  }, [activeSavedId, forecast, goTo, persistWork, readiness]);

  const openSavedDataset = useCallback(async (id: string) => {
    const saved = await getSavedDataset(id);
    if (!saved) { window.location.hash = "returning"; return; }
    readinessAbort.current?.abort();
    forecastAbort.current?.abort();
    readinessAbort.current = null;
    forecastAbort.current = null;
    readinessRun.current += 1;
    forecastRun.current += 1;
    setReadinessLoading(false);
    setForecastLoading(false);
    setEnvelope(saved.envelope);
    lastSavedEnvelope.current = saved.envelope;
    setAnalysisDate(saved.analysisDate);
    setDateConfirmations(saved.dateConfirmations);
    const restoredReadiness = saved.readiness?.policyVersion === READINESS_POLICY_VERSION ? saved.readiness : null;
    setReadiness(restoredReadiness);
    setForecast(restoredReadiness ? saved.forecast : null);
    setPurchaseDrafts(saved.purchaseDrafts);
    setProposals(null);
    setProductKey(null);
    setShowImpact(false);
    setReadinessError(null);
    setForecastError(null);
    setActiveSavedId(id);
    const furthest: StepId = saved.forecast && restoredReadiness ? 4 : restoredReadiness ? 3 : 2;
    setReached(furthest);
    goTo(2);
    setSessionNotice(`${saved.shopName} / ${saved.datasetName} opened.`);
  }, [goTo]);

  useEffect(() => {
    if (initialDatasetId) void openSavedDataset(initialDatasetId)
      .catch(() => setSaveError("The dataset could not be opened."))
      .finally(() => setOpeningDataset(false));
  }, [initialDatasetId, openSavedDataset]);

  useEffect(() => {
    if (!updateDatasetId) return;
    setUpdateTargetId(updateDatasetId);
    setSessionNotice("Upload the replacement file for the selected dataset.");
  }, [updateDatasetId]);

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

    const target = updateTargetId ? await getSavedDataset(updateTargetId) : undefined;
    if (updateTargetId && !target) throw new Error("The dataset selected for update is no longer saved.");
    if (target && !window.confirm(`Replace ${target.shopName} / ${target.datasetName} with ${sourceName}? Earlier decisions and outcomes will remain.`)) {
      setUpdateTargetId(null);
      return;
    }
    const proposed = await proposeMappings(parsed, createLocalSemanticScorer(signal));
    const importedEnvelope = updateSessionMapping(next, seedFromProposals(next.session.mapping, proposed));
    if (target) await replaceSavedDataset(target.id, importedEnvelope, malaysiaDate());
    resetReadinessEvidence();
    setProposals(proposed);
    setEnvelope(importedEnvelope);
    lastSavedEnvelope.current = target ? importedEnvelope : null;
    setMappingError(null);
    setMappingNotice(null);
    setProductKey(null);
    setAnalysisDate(malaysiaDate());
    setActiveSavedId(target?.id ?? null);
    setUpdateTargetId(null);
    if (target) {
      window.history.replaceState(null, "", `#dataset/${encodeURIComponent(target.id)}`);
      setPurchaseDrafts(target.purchaseDrafts);
      await refreshSavedDatasets();
    }
    setSessionNotice(previousMode && previousMode !== sourceMode
      ? `${previousMode === "sample" ? "Sample data" : "The retailer file"} was replaced. Dataset-specific mappings and results were cleared.`
      : sourceMode === "sample" ? "Sample data loaded." : "Retailer file loaded locally.");
    goTo(2);
  }, [envelope, goTo, refreshSavedDatasets, resetReadinessEvidence, updateTargetId]);

  const handleSelectColumn = useCallback((field: CanonicalField, sourceColumnId: string | null) => {
    setMappingError(null);
    setMappingNotice(null);
    resetReadinessEvidence();
    setEnvelope((current) => {
      try {
        const mapping = sourceColumnId
          ? setMapping(current.session.mapping, field, sourceColumnId, false)
          : removeMapping(current.session.mapping, field);
        return updateSessionMapping(current, ["product_code", "product_name", "pack_variant"].includes(field)
          ? Object.freeze({ ...mapping, identityConfirmed: false }) : mapping);
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

  const handleSelectIdentity = useCallback((mode: "stable" | "composite") => {
    setMappingError(null);
    setMappingNotice(null);
    resetReadinessEvidence();
    setEnvelope((current) => updateSessionMapping(current, Object.freeze({
      ...current.session.mapping, identityMode: mode, identityConfirmed: false,
    })));
  }, [resetReadinessEvidence]);

  const handleConfirmDateFormat = useCallback((sourceColumnId: string, format: ConfirmedDateFormat) => {
    const next = Object.freeze([
      ...dateConfirmations.filter((confirmation) => confirmation.sourceColumnId !== sourceColumnId),
      Object.freeze({ sourceColumnId, format, confirmationId: globalThis.crypto.randomUUID() }),
    ]);
    setDateConfirmations(next);
    void executeReadiness(next);
  }, [dateConfirmations, executeReadiness]);

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
    setActiveSavedId(null);
    lastSavedEnvelope.current = null;
    setUpdateTargetId(null);
    setSessionNotice(cleared.message);
  }, [envelope, resetReadinessEvidence]);

  const handleSaveDataset = useCallback(async (shop: string, datasetName: string) => {
    try {
      const existing = await findSavedDataset(shop, datasetName);
      const saved = existing
        ? window.confirm(`Update ${existing.shopName} / ${existing.datasetName} with ${dataset?.sourceName}? Its earlier decisions and outcomes will remain.`)
          ? await replaceSavedDataset(existing.id, envelope, analysisDate) : null
        : await createSavedDataset(shop, datasetName, envelope, analysisDate);
      if (!saved) return;
      setActiveSavedId(saved.id);
      lastSavedEnvelope.current = saved.envelope;
      setSaveError(null);
      setSessionNotice(`${saved.shopName} / ${saved.datasetName} saved.`);
      await refreshSavedDatasets();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Dataset could not be saved.");
    }
  }, [analysisDate, dataset?.sourceName, envelope, refreshSavedDatasets]);

  const handleDeleteDataset = useCallback(async (id: string) => {
    const item = savedDatasets.find((entry) => entry.id === id);
    if (!item || !window.confirm(`Delete ${item.shopName} / ${item.datasetName}? Its ${item.rowCount} records, settings, ${item.planCount} plans, ${item.decisionCount} decisions and ${item.outcomeCount} outcomes will be removed. Other datasets remain available.`)) return;
    try {
      await removeSavedDataset(id);
      if (activeSavedId === id) handleClearSession();
      if (selectedSaved?.id === id) setSelectedSaved(null);
      await refreshSavedDatasets();
    } catch { setSaveError("The dataset could not be deleted. Retry the deletion."); }
  }, [activeSavedId, handleClearSession, refreshSavedDatasets, savedDatasets, selectedSaved?.id]);

  const handleClearEverything = useCallback(async () => {
    if (!window.confirm("Clear Everything? All saved datasets, records, settings, plans, decisions and outcomes will be removed. This cannot be undone.")) return;
    try {
      await clearEverything();
      try { localStorage.removeItem("stockless.language"); } catch { /* Browser preferences may be disabled. */ }
      handleClearSession();
      setSelectedSaved(null);
      await refreshSavedDatasets();
      setSessionNotice("Nothing saved. Start by uploading a dataset.");
    } catch { setSaveError("Saved information could not be cleared. Retry Clear Everything."); }
  }, [handleClearSession, refreshSavedDatasets]);

  const updateSelected = useCallback(async (operation: () => Promise<SavedDataset>) => {
    const retry = async () => {
      const saved = await operation();
      setSelectedSaved(saved);
      setSaveError(null);
      retrySave.current = null;
      await refreshSavedDatasets();
    };
    try {
      await retry();
      return true;
    } catch {
      retrySave.current = retry;
      setSaveError("The latest change could not be saved. Retry the action.");
      return false;
    }
  }, [refreshSavedDatasets]);

  const handleSaveDecision = useCallback(async () => {
    if (!activeSavedId || !readiness || !forecast) return;
    const products = joinPurchaseEvidence(readiness, forecast).map((product) => ({
      key: product.key, name: product.name,
      inputs: purchaseDrafts[product.key] ?? product.fileInputs,
      plan: evaluatePurchaseProduct(product, readiness.analysisDate,
        purchaseDrafts[product.key] ?? product.fileInputs, evaluateProductPurchasePlan, product.fileExpiry),
    }));
    const decision = {
      id: globalThis.crypto.randomUUID(), recordedAt: new Date().toISOString(),
      recommendation: { analysisDate: readiness.analysisDate, sourceSha256: readiness.sourceSha256, products },
      note: `Purchase plan for ${readiness.analysisDate}`,
    };
    const retry = async () => {
      const saved = await recordDecision(activeSavedId, decision);
      setSelectedSaved((current) => current?.id === activeSavedId ? saved : current);
      await refreshSavedDatasets();
      setSaveError(null);
      retrySave.current = null;
      setSessionNotice("Decision saved with its original recommendation and date.");
    };
    try { await retry(); } catch {
      retrySave.current = retry;
      setSaveError("The decision could not be saved. Your current plan is still here.");
    }
  }, [activeSavedId, forecast, purchaseDrafts, readiness, refreshSavedDatasets]);

  const mappingSubmit = useRef(false);
  const [mappingSubmitting, setMappingSubmitting] = useState(false);
  const handleMappingContinue = useCallback(async (activeEnvelope = envelope) => {
    if (mappingSubmit.current || getReadinessBlockers(activeEnvelope.session.mapping).length > 0) return;
    mappingSubmit.current = true;
    setMappingSubmitting(true);
    try {
      if (activeSavedId) await persistWork(activeSavedId, { envelope: activeEnvelope, analysisDate });
      await executeReadiness(dateConfirmations, true, activeEnvelope);
    } finally { mappingSubmit.current = false; setMappingSubmitting(false); }
  }, [activeSavedId, analysisDate, dateConfirmations, envelope, executeReadiness, persistWork]);

  const handleConfirmAllAndContinue = useCallback(async () => {
    if (mappingSubmit.current) return;
    const mapping = confirmCurrentMapping(envelope.session.mapping);
    if (!mapping || getReadinessBlockers(mapping).length > 0) return;
    let next = updateSessionMapping(envelope, mapping);
    if (!envelope.session.mapping.identityConfirmed) next = recordConfirmedIdentity(next);
    setEnvelope(next);
    setMappingError(null);
    setMappingNotice(null);
    await handleMappingContinue(next);
  }, [envelope, handleMappingContinue]);

  const reportMetadata = correctionReportMetadata(envelope.session, analysisDate);

  if (openingDataset) return <p role="status">Opening saved dataset…</p>;

  return (
    <AppShell
      current={step}
      reached={reached}
      onNavigate={goTo}
      sourceMode={envelope.session.sourceMode}
      sourceName={dataset?.sourceName}
      notice={step === 2 || step === 3 ? null : sessionNotice}
      onClear={dataset ? handleClearSession : undefined}
    >
      {saveError && <p role="alert">{saveError} {retrySave.current && <button type="button" onClick={() => void retrySave.current?.()}>Retry</button>}</p>}
      {step === 1 && savedDatasets.length > 0 && <details className="saved-management"><summary>Manage saved information</summary><SavedDataControls
        items={savedDatasets} activeId={activeSavedId} selected={selectedSaved}
        onInspect={(id) => void inspectSavedDataset(id).catch(() => setSaveError("Saved details could not be read."))}
        onOpen={(id) => void openSavedDataset(id).catch(() => setSaveError("The dataset could not be opened."))}
        onUpdate={(id) => { setUpdateTargetId(id); setSessionNotice("Upload the replacement file for the selected dataset."); }}
        onDelete={(id) => void handleDeleteDataset(id)}
        onClear={() => void handleClearEverything()}
        onDeletePlan={(key) => {
          if (!selectedSaved || !window.confirm(`Delete the plan for ${key} from ${selectedSaved.shopName} / ${selectedSaved.datasetName}?`)) return;
          void updateSelected(() => removeSavedPlan(selectedSaved.id, key));
          if (activeSavedId === selectedSaved.id) setPurchaseDrafts((current) => {
            const next = { ...current }; delete next[key]; return next;
          });
        }}
        onDeleteDecision={(id) => {
          const decision = selectedSaved?.decisions.find((item) => item.id === id);
          if (!selectedSaved || !decision || !window.confirm(`Delete ${decision.note ?? `decision from ${decision.recordedAt}`} and its linked outcomes from ${selectedSaved.shopName} / ${selectedSaved.datasetName}?`)) return;
          void updateSelected(() => removeSavedDecision(selectedSaved.id, id));
        }}
        onDeleteOutcome={(id) => {
          const outcome = selectedSaved?.outcomes.find((item) => item.id === id);
          if (!selectedSaved || !outcome || !window.confirm(`Delete outcome ${JSON.stringify(outcome.details)} from ${selectedSaved.shopName} / ${selectedSaved.datasetName}?`)) return;
          void updateSelected(() => removeSavedOutcome(selectedSaved.id, id));
        }}
        onSaveOutcome={async (description, decisionId) => {
          if (!selectedSaved) return false;
          const outcome = { id: globalThis.crypto.randomUUID(), recordedAt: new Date().toISOString(), decisionId, details: { description } };
          return updateSelected(() => recordOutcome(selectedSaved.id, {
            ...outcome,
          }));
        }}
        onSaveSupplierTerm={async (supplier, terms) => {
          if (!selectedSaved) return false;
          return updateSelected(() => saveDatasetWork(selectedSaved.id, {
            supplierTerms: { ...selectedSaved.supplierTerms, [supplier.trim()]: terms.trim() },
          }));
        }}
        onDeleteSupplierTerm={(supplier) => {
          if (!selectedSaved || !window.confirm(`Delete supplier terms for ${supplier} from ${selectedSaved.shopName} / ${selectedSaved.datasetName}?`)) return;
          const next = { ...selectedSaved.supplierTerms };
          delete next[supplier];
          void updateSelected(() => saveDatasetWork(selectedSaved.id, { supplierTerms: next }));
        }}
      /></details>}
      {t(step === 1 && (
        <UploadScreen
          onSource={handleSource}
          onCancel={handleClearSession}
        />
      ))}

      {t(step === 2 && dataset && (
        <MappingScreen
          dataset={dataset}
          mapping={envelope.session.mapping}
          proposals={proposals}
          error={mappingError}
          notice={mappingNotice}
          sessionNotice={sessionNotice}
          onClear={handleClearSession}
          onSelectColumn={handleSelectColumn}
          onSelectIdentity={handleSelectIdentity}
          onBack={() => setStep(1)}
          checking={readinessLoading || mappingSubmitting}
          onConfirmAllAndContinue={() => void handleConfirmAllAndContinue()}
        >
          {dataset.sourceMode === "user" && !activeSavedId && (
            <SaveDatasetControls key={envelope.session.id} defaultName={dataset.sourceName.replace(/\.[^.]+$/, "")}
              shops={[...new Set(savedDatasets.map((item) => item.shopName))]}
              onSave={handleSaveDataset} />
          )}
        </MappingScreen>
      ))}

      {t(step === 3 && dataset && readiness && (
        <ReadinessScreen
          dataset={dataset}
          mapping={envelope.session.mapping}
          snapshot={readiness}
          onClear={handleClearSession}
          dateConfirmations={dateConfirmations}
          checking={readinessLoading}
          error={readinessError}
          forecasting={forecastLoading}
          forecastError={forecastError}
          filter={issueFilter}
          onFilter={setIssueFilter}
          onConfirmDateFormat={handleConfirmDateFormat}
          onBack={() => setStep(2)}
          onContinue={() => void executeForecast()}
          reportFilename={reportMetadata.filename}
        />
      ))}

      {t(step === 3 && dataset && !readiness && (
        <section className="card pending">
          <h1 className="card-title">{t("Readiness evidence needs to be refreshed")}</h1>
          <p className="card-sub">{t("Run the check again after confirming the current mappings.")}</p>
          {t(readinessError && <p className="notice notice--error" role="alert">{t(readinessError)}</p>)}
          <button
            type="button"
            className="btn btn--primary"
            disabled={readinessLoading}
            onClick={() => void executeReadiness(dateConfirmations)}
            aria-busy={readinessLoading}
          >
            {t(readinessLoading && <span className="btn__spinner" aria-hidden="true" />)}
            {t(readinessLoading ? "Checking locally…" : "Run readiness check")}
          </button>
        </section>
      ))}

      {t(step === 4 && readiness && forecast && showImpact && (
        <ImpactDashboard
          snapshot={readiness}
          forecast={forecast}
          drafts={purchaseDrafts}
          onBack={() => setShowImpact(false)}
        />
      ))}

      {t(step === 4 && readiness && forecast && !showImpact && (
        <>
        {activeSavedId && <button type="button" onClick={() => void handleSaveDecision()}>Save current plan as decision</button>}
        <PurchasePlanScreen
          snapshot={readiness}
          forecast={forecast}
          drafts={purchaseDrafts}
          onDraftChange={(key, inputs) => {
            const next = { ...purchaseDrafts, [key]: inputs };
            setPurchaseDrafts(next);
            if (activeSavedId) void persistWork(activeSavedId, { purchaseDrafts: next });
          }}
          selectedKey={productKey}
          onSelect={setProductKey}
          onBack={() => setStep(3)}
          onImpact={() => { setProductKey(null); setShowImpact(true); }}
        />
        </>
      ))}
    </AppShell>
  );
}
