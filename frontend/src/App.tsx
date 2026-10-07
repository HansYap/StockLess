import { t, useLanguage } from "./i18n/index.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, type StepId } from "./components/AppShell.tsx";
import { SaveDatasetControls } from "./components/SavedDataControls.tsx";
import { StorageExplanation } from "./components/StorageExplanation.tsx";
import { UploadScreen } from "./screens/UploadScreen.tsx";
import { MappingScreen } from "./screens/MappingScreen.tsx";
import { ReadinessScreen, type ReadinessIssueFilter } from "./screens/ReadinessScreen.tsx";
import { PurchasePlanScreen, type SupplierDrafts } from "./screens/PurchasePlanScreen.tsx";
import { ImpactDashboard } from "./screens/ImpactDashboard.tsx";
import { evaluatePurchaseProduct, joinPurchaseEvidence, type PurchaseDrafts } from "./purchase-plan/model.ts";
import {
  MappingConflictError,
  READINESS_POLICY_VERSION,
  readinessEvidenceKey,
  EPIC3_POLICY_VERSION,
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
  type ImportSourceMetadata,
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
  createSavedDataset, getSavedDataset,
  listSavedDatasets, recordDecision,
  replaceSavedDataset, saveDatasetWork, summarizeSavedDataset,
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
  const [mappingUndo, setMappingUndo] = useState<MappingState | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappingNotice, setMappingNotice] = useState<string | null>(null);
  const [issueFilter, setIssueFilter] = useState<ReadinessIssueFilter | null>(null);
  const [productKey, setProductKey] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReadinessSnapshot | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [purchaseDrafts, setPurchaseDrafts] = useState<PurchaseDrafts>({});
  const [supplierOrderDrafts, setSupplierOrderDrafts] = useState<SupplierDrafts>({});
  const [forecast, setForecast] = useState<DemandForecastReview | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [dateConfirmations, setDateConfirmations] = useState<readonly DateFormatConfirmation[]>([]);
  const [analysisDate, setAnalysisDate] = useState(malaysiaDate);
  const [savedDatasets, setSavedDatasets] = useState<readonly SavedDatasetSummary[]>([]);
  const [selectedSaved, setSelectedSaved] = useState<SavedDataset | null>(null);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [updateTargetId, setUpdateTargetId] = useState<string | null>(updateDatasetId ?? null);
  const [uploadTarget, setUploadTarget] = useState<SavedDatasetSummary | null>(null);
  const [workspaceActive, setWorkspaceActive] = useState(Boolean(initialDatasetId || updateDatasetId));
  const [workspaceInfo, setWorkspaceInfo] = useState<{ datasetName: string; shopName: string; rowCount: number } | null>(null);
  const [openingDataset, setOpeningDataset] = useState(Boolean(initialDatasetId || updateDatasetId));
  const [saveError, setSaveError] = useState<string | null>(null);
  const retrySave = useRef<(() => Promise<void>) | null>(null);
  const lastSavedEnvelope = useRef<SessionEnvelope | null>(null);
  const readinessRun = useRef(0);
  const readinessAbort = useRef<AbortController | null>(null);
  const forecastRun = useRef(0);
  const forecastAbort = useRef<AbortController | null>(null);

  const dataset = envelope.session.dataset;
  const workspaceDataset = (activeSavedId && savedDatasets.find(item => item.id === activeSavedId)) || uploadTarget || workspaceInfo || {
    datasetName: dataset?.sourceName ?? t("New file"), shopName: "", rowCount: dataset?.rows.length ?? 0,
  };

  const refreshSavedDatasets = useCallback(async () => {
    setSavedDatasets(await listSavedDatasets());
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
    setSupplierOrderDrafts({});
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
      return snapshot;
    } catch (error) {
      if (readinessRun.current !== runId) return;
      setReadinessError(error instanceof Error ? error.message : "The readiness check could not be completed.");
    } finally {
      if (readinessAbort.current === controller) readinessAbort.current = null;
      if (readinessRun.current === runId) setReadinessLoading(false);
    }
  }, [activeSavedId, analysisDate, dataset, dateConfirmations, envelope, goTo, persistWork, resetForecastEvidence]);

  const executeForecast = useCallback(async (snapshot = readiness, destination: "purchase" | "impact" = "purchase") => {
    if (!snapshot) return;
    const enterResults = () => {
      setWorkspaceActive(true);
      if (activeSavedId) window.history.replaceState(null, "", `#dataset/${encodeURIComponent(activeSavedId)}`);
      goTo(4);
      setShowImpact(destination === "impact");
    };
    if (forecast?.snapshotId === snapshot.id && forecast.policyVersion === EPIC3_POLICY_VERSION && forecast.analysisDate === snapshot.analysisDate) {
      enterResults();
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
      const review = await runDemandForecastInWorker(snapshot, controller.signal);
      if (forecastRun.current !== runId) return;
      setForecast(review);
      if (activeSavedId) await persistWork(activeSavedId, { forecast: review });
      if (forecastRun.current !== runId) return;
      enterResults();
    } catch (error) {
      if (forecastRun.current !== runId) return;
      setForecastError(error instanceof Error ? error.message : "Demand estimation could not be completed.");
    } finally {
      if (forecastAbort.current === controller) forecastAbort.current = null;
      if (forecastRun.current === runId) setForecastLoading(false);
    }
  }, [activeSavedId, forecast, goTo, persistWork, readiness]);

  const openSavedDataset = useCallback(async (id: string, destination: "purchase" | "impact" = "purchase") => {
    const saved = await getSavedDataset(id);
    if (!saved) { window.location.hash = "history"; return; }
    window.history.replaceState(null, "", `#dataset/${encodeURIComponent(id)}`);
    readinessAbort.current?.abort();
    forecastAbort.current?.abort();
    readinessAbort.current = null;
    forecastAbort.current = null;
    readinessRun.current += 1;
    forecastRun.current += 1;
    setReadinessLoading(false);
    setForecastLoading(false);
    setMappingUndo(null);
    setEnvelope(saved.envelope);
    lastSavedEnvelope.current = saved.envelope;
    setAnalysisDate(saved.analysisDate);
    setDateConfirmations(saved.dateConfirmations);
    let restoredReadiness = saved.readiness?.policyVersion === READINESS_POLICY_VERSION
      && saved.readiness.sourceSha256 === saved.envelope.session.dataset?.sourceSha256
      && saved.readiness.analysisDate === saved.analysisDate
      && saved.envelope.session.dataset
      && saved.readiness.evidenceKey === readinessEvidenceKey(saved.envelope.session.dataset, saved.envelope.session.mapping, { analysisDate: saved.analysisDate, dateConfirmations: saved.dateConfirmations }) ? saved.readiness : null;
    let restoredForecast = restoredReadiness && saved.forecast?.snapshotId === restoredReadiness.id
      && saved.forecast.policyVersion === EPIC3_POLICY_VERSION
      && saved.forecast.analysisDate === restoredReadiness.analysisDate ? saved.forecast : null;
    setReadiness(restoredReadiness);
    setForecast(restoredForecast);
    setPurchaseDrafts(saved.purchaseDrafts);
    setSupplierOrderDrafts(saved.supplierOrderDrafts ?? {});
    setProposals(null);
    setProductKey(null);
    setShowImpact(false);
    setReadinessError(null);
    setForecastError(null);
    setActiveSavedId(id);
    setUploadTarget(summarizeSavedDataset(saved));
    setWorkspaceActive(true);
    const furthest: StepId = restoredForecast ? 4 : restoredReadiness ? 3 : 2;
    setReached(furthest);
    setUpdateTargetId(null);
    setSessionNotice(null);
    if (restoredReadiness && restoredForecast) {
      goTo(4);
      setShowImpact(destination === "impact");
      return;
    }
    if (!saved.envelope.session.dataset) {
      setUpdateTargetId(id);
      window.history.replaceState(null, "", `#update/${encodeURIComponent(id)}`);
      goTo(1);
      return;
    }
    if (getReadinessBlockers(saved.envelope.session.mapping).length > 0) {
      goTo(2);
      setMappingNotice("Confirm your columns to finish preparing this dataset.");
      return;
    }
    // Older completed datasets can refresh their evidence without replaying preparation.
    goTo(3);
    const controller = new AbortController();
    readinessAbort.current = controller;
    forecastAbort.current = controller;
    const readinessId = readinessRun.current;
    const forecastId = forecastRun.current;
    setReadinessLoading(!restoredReadiness);
    setForecastLoading(true);
    try {
      restoredReadiness ??= await runReadinessCheckInWorker(saved.envelope.session.dataset, saved.envelope.session.mapping, {
        analysisDate: saved.analysisDate, dateConfirmations: saved.dateConfirmations,
      }, controller.signal);
      if (controller.signal.aborted || readinessRun.current !== readinessId) return;
      setReadiness(restoredReadiness);
      setReadinessLoading(false);
      restoredForecast = await runDemandForecastInWorker(restoredReadiness, controller.signal);
      if (controller.signal.aborted || forecastRun.current !== forecastId) return;
      setForecast(restoredForecast);
      await persistWork(id, { readiness: restoredReadiness, forecast: restoredForecast });
      if (controller.signal.aborted || forecastRun.current !== forecastId) return;
      goTo(4);
      setShowImpact(destination === "impact");
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : "The saved results could not be refreshed.";
        if (restoredReadiness) setForecastError(message); else setReadinessError(message);
      }
    } finally {
      if (readinessAbort.current === controller) { readinessAbort.current = null; setReadinessLoading(false); }
      if (forecastAbort.current === controller) { forecastAbort.current = null; setForecastLoading(false); }
    }
  }, [goTo, persistWork]);

  useEffect(() => {
    if (initialDatasetId) void openSavedDataset(initialDatasetId)
      .catch(() => setSaveError("The dataset could not be opened."))
      .finally(() => setOpeningDataset(false));
  }, [initialDatasetId, openSavedDataset]);

  useEffect(() => {
    if (!updateTargetId) return;
    let cancelled = false;
    void getSavedDataset(updateTargetId).then(saved => {
      if (cancelled) return;
      if (!saved) { window.location.hash = "history"; return; }
      setUploadTarget(summarizeSavedDataset(saved));
      setWorkspaceActive(true);
      setSessionNotice("Upload the replacement file for the selected dataset.");
    }).catch(() => { if (!cancelled) setSaveError("The dataset could not be opened."); })
      .finally(() => { if (!cancelled) setOpeningDataset(false); });
    return () => { cancelled = true; };
  }, [updateTargetId]);

  useEffect(() => () => {
    readinessAbort.current?.abort();
    forecastAbort.current?.abort();
  }, []);

  const handleSource = useCallback(async (
    bytes: Uint8Array,
    sourceName: string,
    sourceMode: SourceMode,
    mimeType: string | undefined,
    onProgress: (progress: CsvProgress) => void,
    signal: AbortSignal,
    sourceMetadata?: ImportSourceMetadata,
  ) => {
    const previousMode = envelope.session.sourceMode;
    const next = await replaceSessionSourceInWorker(envelope, bytes, {
      sourceMode,
      sourceName,
      mimeType,
      sourceMetadata,
      onProgress,
      signal,
    });
    const parsed = next.session.dataset;
    if (!parsed) throw new Error("The parsed dataset is missing from the session.");

    const target = updateTargetId ? await getSavedDataset(updateTargetId) : undefined;
    if (updateTargetId && !target) throw new Error("The dataset selected for update is no longer saved.");
    if (target && !window.confirm(`Use ${sourceName} as your current sales file? The previous upload will stay in Upload History (up to 12 uploads).`)) {
      return;
    }
    const proposed = await proposeMappings(parsed, createLocalSemanticScorer(signal));
    const importedEnvelope = updateSessionMapping(next, seedFromProposals(next.session.mapping, proposed));
    const uploaded = target ? await replaceSavedDataset(target.id, importedEnvelope, malaysiaDate()) : undefined;
    resetReadinessEvidence();
    setProposals(proposed);
    setMappingUndo(null);
    setEnvelope(importedEnvelope);
    lastSavedEnvelope.current = target ? importedEnvelope : null;
    setMappingError(null);
    setMappingNotice(null);
    setProductKey(null);
    setAnalysisDate(malaysiaDate());
    setActiveSavedId(target?.id ?? null);
    setWorkspaceInfo({ datasetName: uploaded?.datasetName ?? parsed.sourceName, shopName: target?.shopName ?? "", rowCount: parsed.rows.length });
    setUpdateTargetId(null);
    if (target) {
      setUploadTarget(summarizeSavedDataset(uploaded!));
      window.history.replaceState(null, "", `#dataset/${encodeURIComponent(target.id)}`);
      setPurchaseDrafts(target.purchaseDrafts);
      setSupplierOrderDrafts(target.supplierOrderDrafts ?? {});
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
        setMappingUndo(current.session.mapping);
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

  const handleUndoMapping = useCallback(() => {
    if (!mappingUndo) return;
    resetReadinessEvidence();
    setEnvelope(current => updateSessionMapping(current, mappingUndo));
    setMappingUndo(null); setMappingError(null); setMappingNotice(null);
  }, [mappingUndo, resetReadinessEvidence]);

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
    setUploadTarget(null);
    setWorkspaceActive(false);
    setWorkspaceInfo(null);
  }, [envelope, resetReadinessEvidence]);

  const handleSaveDataset = useCallback(async (shop: string, datasetName: string) => {
    try {
      const latest = (await listSavedDatasets())[0];
      const existing = latest ? await getSavedDataset(latest.id) : undefined;
      const saved = existing
        ? window.confirm(`Use ${dataset?.sourceName} as your current sales file? The previous upload will stay in Upload History (up to 12 uploads).`)
          ? await replaceSavedDataset(existing.id, envelope, analysisDate, datasetName) : null
        : await createSavedDataset(shop, datasetName, envelope, analysisDate);
      if (!saved) return;
      await saveDatasetWork(saved.id, { envelope, analysisDate, dateConfirmations, readiness, forecast, purchaseDrafts, supplierOrderDrafts });
      setActiveSavedId(saved.id);
      if (step === 4) window.history.replaceState(null, "", `#dataset/${encodeURIComponent(saved.id)}`);
      setWorkspaceInfo(summarizeSavedDataset(saved));
      lastSavedEnvelope.current = saved.envelope;
      setSaveError(null);
      setSessionNotice(`${saved.shopName} / ${saved.datasetName} saved.`);
      await refreshSavedDatasets();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Dataset could not be saved.");
    }
  }, [analysisDate, dataset?.sourceName, envelope, refreshSavedDatasets, dateConfirmations, readiness, forecast, purchaseDrafts, supplierOrderDrafts, step]);

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

  const beginReupload = () => {
    const id = savedDatasets[0]?.id ?? activeSavedId ?? uploadTarget?.id ?? null;
    const target = savedDatasets.find(item => item.id === id) ?? uploadTarget ?? null;
    const info = target ?? workspaceDataset;
    readinessAbort.current?.abort();
    forecastAbort.current?.abort();
    readinessRun.current += 1;
    forecastRun.current += 1;
    setReadinessLoading(false);
    setForecastLoading(false);
    setSessionNotice(null);
    setReached(1);
    goTo(1);
    setWorkspaceActive(true);
    setWorkspaceInfo(info);
    setUploadTarget(target);
    setUpdateTargetId(id);
    if (id) window.history.replaceState(null, "", `#update/${encodeURIComponent(id)}`);
  };

  const navigateResults = async (destination: "purchase" | "impact") => {
    if (!dataset || updateTargetId) {
      const id = updateTargetId ?? activeSavedId ?? uploadTarget?.id;
      if (id) await openSavedDataset(id, destination);
      return;
    }
    if (getReadinessBlockers(envelope.session.mapping).length > 0) {
      setMappingNotice("Confirm your columns to finish preparing this dataset.");
      goTo(2);
      return;
    }
    const snapshot = readiness ?? await executeReadiness();
    if (snapshot) await executeForecast(snapshot, destination);
  };

  if (openingDataset) return <p role="status">Opening saved dataset…</p>;

  return (
    <AppShell
      i3Typography={!showImpact}
      current={step}
      reached={reached}
      onNavigate={next => { if (next === 1 && workspaceActive) beginReupload(); else goTo(next); }}
      sourceMode={envelope.session.sourceMode}
      sourceName={dataset?.sourceName}
      notice={updateTargetId || step === 2 || step === 3 || (step === 4 && !showImpact) ? null : sessionNotice}
      workflowStyle={workspaceActive || step !== 4 || !showImpact}
      onClear={dataset ? workspaceActive ? beginReupload : handleClearSession : undefined}
      workspaceSidebar={workspaceActive ? {
        dataset: workspaceDataset,
        saved: Boolean(activeSavedId || updateTargetId || uploadTarget),
        currentSection: step <= 3 ? "reupload" : showImpact ? "impact" : "purchase",
        onReupload: () => { if (step !== 1) beginReupload(); },
        onPurchasePlan: () => void navigateResults("purchase").catch(() => setSaveError("The dataset could not be opened.")),
        onImpact: () => void navigateResults("impact").catch(() => setSaveError("The dataset could not be opened.")),
      } : undefined}
    >
      {saveError && <p role="alert">{saveError} {retrySave.current && <button type="button" onClick={() => void retrySave.current?.()}>Retry</button>}</p>}
      {!showImpact && <StorageExplanation />}
      {t(step === 1 && (
        <UploadScreen
          onSource={handleSource}
          onCancel={workspaceActive ? () => setSessionNotice(null) : handleClearSession}
          updating={workspaceActive}
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
          onUndo={mappingUndo ? handleUndoMapping : undefined}
          onSelectIdentity={handleSelectIdentity}
          onBack={() => workspaceActive ? beginReupload() : setStep(1)}
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
          onNew={beginReupload}
        />
      ))}

      {t(step === 4 && readiness && forecast && !showImpact && (
        <>
        {dataset?.sourceMode === "user" && !activeSavedId && <div className="workspace-save">
          <p>{t("Save this upload to reopen your purchase plan on your next visit.")}</p>
          <SaveDatasetControls defaultName={dataset.sourceName.replace(/\.[^.]+$/, "")}
            shops={[...new Set(savedDatasets.map(item => item.shopName))]} onSave={handleSaveDataset} />
        </div>}
        {activeSavedId && <div className="workspace-plan-actions"><button type="button" className="btn btn--small btn--ghost" onClick={() => void handleSaveDecision()}>{t("Save current plan as decision")}</button></div>}
        <PurchasePlanScreen
          snapshot={readiness}
          forecast={forecast}
          drafts={purchaseDrafts}
          onDraftChange={(key, inputs) => {
            const next = { ...purchaseDrafts, [key]: inputs };
            setPurchaseDrafts(next);
            if (activeSavedId) void persistWork(activeSavedId, { purchaseDrafts: next });
          }}
          supplierDrafts={supplierOrderDrafts}
          onSupplierChange={(key, terms) => {
            const next = { ...supplierOrderDrafts, [key]: terms };
            setSupplierOrderDrafts(next);
            if (activeSavedId) void persistWork(activeSavedId, { supplierOrderDrafts: next });
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
