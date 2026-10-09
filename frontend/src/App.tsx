import { t, useLanguage } from "./i18n/index.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell, type StepId } from "./components/AppShell.tsx";
import { UploadScreen } from "./screens/UploadScreen.tsx";
import { MappingScreen } from "./screens/MappingScreen.tsx";
import { ReadinessScreen, type ReadinessIssueFilter } from "./screens/ReadinessScreen.tsx";
import { PurchasePlanScreen, type PurchasePlanView, type SupplierDrafts } from "./screens/PurchasePlanScreen.tsx";
import { ImpactDashboard, type ImpactSection } from "./screens/ImpactDashboard.tsx";
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
  applyPlanningContexts, type PlanningContexts,
} from "./engine.ts";
import { replaceSessionSourceInWorker } from "./workers/import-session-client.ts";
import { runDemandForecastInWorker } from "./workers/forecast-client.ts";
import { runReadinessCheckInWorker } from "./workers/readiness-client.ts";
import { createLocalSemanticScorer } from "./workers/semantic-client.ts";
import { terminateStocklessWorkers } from "./workers/worker-registry.ts";
import { confirmCurrentMapping } from "./mapping-confirmation.ts";
import { useGuidePage, useOnboarding } from "./onboarding/Onboarding.tsx";
import {
  getSavedDataset, listSavedDatasets,
  saveGeneratedPurchasePlan, saveDatasetWork, summarizeSavedDataset,
  rememberUploadVisit,
  type SavedDataset, type SavedDatasetSummary, type SavedDecision, type SavedWork,
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
  readonly guidedImport?: boolean;
  readonly guideReturnId?: string;
}

export default function App({ initialDatasetId, updateDatasetId, guidedImport = false, guideReturnId }: AppProps = {}) {
  useLanguage();
  const onboarding = useOnboarding();
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [returnPlanId, setReturnPlanId] = useState<string | undefined>(guideReturnId);
  const [envelope, setEnvelope] = useState<SessionEnvelope>(() => createEmptySession());
  const [proposals, setProposals] = useState<MappingProposalResult | null>(null);
  const [step, setStep] = useState<StepId>(1);
  const [showImpact, setShowImpact] = useState(false);
  const [reached, setReached] = useState<StepId>(1);
  const [mappingUndo, setMappingUndo] = useState<MappingState | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappingNotice, setMappingNotice] = useState<string | null>(null);
  const [issueFilter, setIssueFilter] = useState<ReadinessIssueFilter | null>(null);
  const [readinessFocus, setReadinessFocus] = useState<string | null>(null);
  const [productKey, setProductKey] = useState<string | null>(null);
  const [purchaseView, setPurchaseView] = useState<PurchasePlanView>();
  const [decisionFocus, setDecisionFocus] = useState<{productKey:string;revision:number}>();
  const [impactFocus, setImpactFocus] = useState<{section:ImpactSection;revision:number}>();
  const openImpact = (section?: ImpactSection) => { setDecisionFocus(undefined); setImpactFocus(previous=>section?{section,revision:(previous?.revision??0)+1}:undefined); setShowImpact(true); };
  const openDecision = (key:string) => { setProductKey(key); setImpactFocus(undefined); setDecisionFocus(previous=>({productKey:key,revision:(previous?.revision??0)+1})); setShowImpact(false); };
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReadinessSnapshot | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [cp3Inputs, setCp3Inputs] = useState<PlanningContexts>({});
  const effectiveReadiness = useMemo(() => readiness ? applyPlanningContexts(readiness, cp3Inputs) : null, [readiness, cp3Inputs]);
  const [purchaseDrafts, setPurchaseDrafts] = useState<PurchaseDrafts>({});
  const [supplierOrderDrafts, setSupplierOrderDrafts] = useState<SupplierDrafts>({});
  const [forecast, setForecast] = useState<DemandForecastReview | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [dateConfirmations, setDateConfirmations] = useState<readonly DateFormatConfirmation[]>([]);
  const [analysisDate, setAnalysisDate] = useState(malaysiaDate);
  const [savedDatasets, setSavedDatasets] = useState<readonly SavedDatasetSummary[]>([]);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [updateTargetId, setUpdateTargetId] = useState<string | null>(updateDatasetId ?? null);
  const [uploadTarget, setUploadTarget] = useState<SavedDatasetSummary | null>(null);
  const [workspaceActive, setWorkspaceActive] = useState(!guidedImport && Boolean(initialDatasetId || updateDatasetId));
  const [workspaceInfo, setWorkspaceInfo] = useState<{ datasetName: string; shopName: string; rowCount: number } | null>(null);
  const [openingDataset, setOpeningDataset] = useState(Boolean(initialDatasetId || updateDatasetId));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retrySaves = useRef(new Map<string, () => Promise<unknown>>());
  const pendingWork = useRef(new Map<string, Partial<SavedWork>>());
  const generatedSaves = useRef(new Map<string, Promise<SavedDataset | undefined>>());
  const pendingUploadTarget = useRef<string | undefined>(undefined);
  const uploadToken = useRef(globalThis.crypto.randomUUID());
  const mounted = useRef(true);
  const latestDrafts = useRef(purchaseDrafts);
  const latestSupplierDrafts = useRef(supplierOrderDrafts);
  const latestContexts = useRef(cp3Inputs);
  latestDrafts.current = purchaseDrafts;
  latestSupplierDrafts.current = supplierOrderDrafts;
  latestContexts.current = cp3Inputs;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; retrySaves.current.clear(); };
  }, []);
  const lastSavedEnvelope = useRef<SessionEnvelope | null>(null);
  const readinessRun = useRef(0);
  const readinessAbort = useRef<AbortController | null>(null);
  const forecastRun = useRef(0);
  const forecastAbort = useRef<AbortController | null>(null);

  const dataset = envelope.session.dataset;
  useGuidePage(workspaceActive ? "sidebar" : step === 1 ? "upload" : step === 2 ? "mapping" : null,
    historyLoaded && !guidedImport && !workspaceActive && step === 1 && savedDatasets.length === 0);
  const workspaceDataset = (activeSavedId && savedDatasets.find(item => item.id === activeSavedId)) || workspaceInfo || uploadTarget || {
    datasetName: dataset?.sourceName ?? t("New file"), shopName: "", rowCount: dataset?.rows.length ?? 0,
  };

  const refreshSavedDatasets = useCallback(async () => {
    const items = await listSavedDatasets();
    setSavedDatasets(items);
    return items;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void refreshSavedDatasets().then(items => {
      if (cancelled || !items[0]) return;
      if (guidedImport) { setReturnPlanId(guideReturnId ?? items[0].id); return; }
      rememberUploadVisit();
      if (initialDatasetId || updateDatasetId) return;
      setWorkspaceActive(true);
      setUploadTarget(items[0]);
      setUpdateTargetId(items[0].id);
      window.history.replaceState(null, "", `#update/${encodeURIComponent(items[0].id)}`);
    }).catch(() => { if (!cancelled) setSaveError("Saved information is unavailable here. You can still upload a file or use the sample."); })
      .finally(() => { if (!cancelled) setHistoryLoaded(true); });
    return () => { cancelled = true; };
  }, [initialDatasetId, updateDatasetId, refreshSavedDatasets, guidedImport, guideReturnId]);

  const persistWork = useCallback(async (id: string, work: Partial<SavedWork>) => {
    pendingWork.current.set(id, { ...pendingWork.current.get(id), ...work });
    const flush = async () => {
      const pending = pendingWork.current.get(id);
      if (!pending) return;
      setSaveState("saving");
      try {
        await saveDatasetWork(id, pending);
        if (pendingWork.current.get(id) === pending) {
          pendingWork.current.delete(id);
          retrySaves.current.delete(`work:${id}`);
        }
        if (mounted.current && retrySaves.current.size === 0 && pendingWork.current.size === 0) { setSaveError(null); setSaveState("saved"); }
      } catch {
        if (!mounted.current || !pendingWork.current.has(id)) return;
        retrySaves.current.set(`work:${id}`, flush);
        setSaveState("error");
        setSaveError("Your changes are still here. Saving on this device failed; we will try again automatically. Keep this page open.");
      }
    };
    await flush();
  }, []);
  const updateContexts = (updates: PlanningContexts) => {
    const next = { ...latestContexts.current, ...updates };
    latestContexts.current = next; setCp3Inputs(next);
    if (activeSavedId) void persistWork(activeSavedId, { cp3Inputs: next });
  };

  useEffect(() => {
    if (!saveError || retrySaves.current.size === 0) return;
    let cancelled = false;
    let running = false;
    const retry = async () => {
      if (running || cancelled) return;
      running = true;
      await Promise.allSettled([...retrySaves.current.values()].map(save => save()));
      if (!cancelled) setRetryAttempt(value => value + 1);
      running = false;
    };
    const timer = window.setTimeout(() => void retry(), Math.min(2000 * 2 ** Math.min(retryAttempt, 4), 30000));
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => { cancelled = true; window.clearTimeout(timer); window.removeEventListener("online", retry); window.removeEventListener("focus", retry); };
  }, [saveError, retryAttempt]);

  const saveCompletedPlan = useCallback(async (snapshot: ReadinessSnapshot, review: DemandForecastReview) => {
    if (envelope.session.dataset?.sourceMode !== "user") return;
    const key = `${uploadToken.current}:${snapshot.id}`;
    const token = uploadToken.current;
    const existingOperation = generatedSaves.current.get(key);
    if (existingOperation) return existingOperation;
    const targetId = activeSavedId ?? pendingUploadTarget.current;
    const newUpload = !activeSavedId;
    const plan: SavedDecision = {
      id: `generated:${newUpload ? key : snapshot.id}`, recordedAt: new Date().toISOString(),
      recommendation: {
        analysisDate: snapshot.analysisDate, sourceSha256: snapshot.sourceSha256,
        products: joinPurchaseEvidence(snapshot, review).map(product => ({
          key: product.key, name: product.name,
          inputs: latestDrafts.current[product.key] ?? product.fileInputs,
          plan: evaluatePurchaseProduct(product, snapshot.analysisDate,
            latestDrafts.current[product.key] ?? product.fileInputs, evaluateProductPurchasePlan, product.fileExpiry),
        })),
      },
      note: `Generated purchase plan for ${snapshot.analysisDate}`,
    };
    const operation = (async () => {
      setSaveState("saving");
      try {
        // Finish outstanding edits to the old plan before freezing its history entry.
        for (const [id, work] of pendingWork.current) await persistWork(id, work);
        if (pendingWork.current.size > 0) throw new Error("Earlier edits are still waiting to save.");
        const saved = await saveGeneratedPurchasePlan({
          envelope, analysisDate, dateConfirmations, readiness: snapshot, forecast: review,
          purchaseDrafts: latestDrafts.current, supplierOrderDrafts: latestSupplierDrafts.current, supplierTerms: {}, cp3Inputs,
        }, plan, targetId, newUpload);
        if (!mounted.current || uploadToken.current !== token) return saved;
        pendingUploadTarget.current = undefined;
        lastSavedEnvelope.current = envelope;
        setActiveSavedId(saved.id);
        setUploadTarget(summarizeSavedDataset(saved));
        setWorkspaceInfo(summarizeSavedDataset(saved));
        // Include edits made while the initial write was in progress.
        await persistWork(saved.id, { purchaseDrafts: latestDrafts.current, supplierOrderDrafts: latestSupplierDrafts.current });
        retrySaves.current.delete(`plan:${key}`);
        if (retrySaves.current.size === 0 && pendingWork.current.size === 0) { setSaveError(null); setSaveState("saved"); }
        window.history.replaceState(null, "", `#dataset/${encodeURIComponent(saved.id)}`);
        void refreshSavedDatasets().catch(() => undefined);
        return saved;
      } catch {
        generatedSaves.current.delete(key);
        if (!mounted.current || uploadToken.current !== token) return undefined;
        retrySaves.current.set(`plan:${key}`, () => saveCompletedPlan(snapshot, review));
        setSaveState("error");
        setSaveError("Your plan is ready. Saving on this device failed; we will try again automatically. Keep this page open.");
        return undefined;
      }
    })();
    generatedSaves.current.set(key, operation);
    return operation;
  }, [activeSavedId, analysisDate, dateConfirmations, envelope, persistWork, refreshSavedDatasets, cp3Inputs]);

  useEffect(() => {
    if (!activeSavedId || !dataset || lastSavedEnvelope.current === envelope) return;
    lastSavedEnvelope.current = envelope;
    void persistWork(activeSavedId, {
      envelope, analysisDate, dateConfirmations, readiness, forecast,
    });
  }, [activeSavedId, dataset, envelope, analysisDate, dateConfirmations, readiness, forecast, persistWork]);

  useEffect(() => {
    if (step === 4 && (showImpact ? impactFocus : decisionFocus)) return;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [step, showImpact, impactFocus, decisionFocus]);

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
    setProductKey(null); setPurchaseView(undefined); setDecisionFocus(undefined); setImpactFocus(undefined);
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
      if (!activeSavedId) await saveCompletedPlan(snapshot, forecast);
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
      await saveCompletedPlan(snapshot, review);
      if (forecastRun.current !== runId) return;
      enterResults();
    } catch (error) {
      if (forecastRun.current !== runId) return;
      setForecastError(error instanceof Error ? error.message : "Demand estimation could not be completed.");
    } finally {
      if (forecastAbort.current === controller) forecastAbort.current = null;
      if (forecastRun.current === runId) setForecastLoading(false);
    }
  }, [activeSavedId, forecast, goTo, readiness, saveCompletedPlan]);

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
    setCp3Inputs(saved.cp3Inputs ?? {});
    setSupplierOrderDrafts(saved.supplierOrderDrafts ?? {});
    setProposals(null);
    setProductKey(null); setPurchaseView(undefined); setDecisionFocus(undefined); setImpactFocus(undefined);
    setShowImpact(false);
    setReadinessError(null);
    setForecastError(null);
    pendingUploadTarget.current = undefined;
    setActiveSavedId(id);
    setSaveState("saved");
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

    const targetId = sourceMode === "user" ? guidedImport ? returnPlanId : updateTargetId : undefined;
    const target = targetId ? await getSavedDataset(targetId) : undefined;
    if (targetId && !target) throw new Error("The dataset selected for update is no longer saved.");
    const proposed = await proposeMappings(parsed, createLocalSemanticScorer(signal));
    const importedEnvelope = updateSessionMapping(next, seedFromProposals(next.session.mapping, proposed));
    if (sourceMode === "user") rememberUploadVisit();
    pendingUploadTarget.current = target?.id;
    uploadToken.current = globalThis.crypto.randomUUID();
    for (const key of retrySaves.current.keys()) if (key.startsWith("plan:")) retrySaves.current.delete(key);
    generatedSaves.current.clear();
    setSaveError(null);
    setSaveState("idle");
    resetReadinessEvidence();
    setProposals(proposed);
    setCp3Inputs({});
    setMappingUndo(null);
    setEnvelope(importedEnvelope);
    lastSavedEnvelope.current = null;
    setMappingError(null);
    setMappingNotice(null);
    setProductKey(null); setPurchaseView(undefined); setDecisionFocus(undefined); setImpactFocus(undefined);
    setAnalysisDate(malaysiaDate());
    setActiveSavedId(null);
    setWorkspaceInfo({ datasetName: parsed.sourceName.replace(/\.[^.]+$/, ""), shopName: target?.shopName ?? "", rowCount: parsed.rows.length });
    setUpdateTargetId(null);
    if (target) {
      setUploadTarget(summarizeSavedDataset(target));
      if (!guidedImport) window.history.replaceState(null, "", `#dataset/${encodeURIComponent(target.id)}`);
      setPurchaseDrafts(target.purchaseDrafts);
      setSupplierOrderDrafts(target.supplierOrderDrafts ?? {});
    }
    setSessionNotice(previousMode && previousMode !== sourceMode
      ? `${previousMode === "sample" ? "Sample data" : "The retailer file"} was replaced. Dataset-specific mappings and results were cleared.`
      : sourceMode === "sample" ? "Sample data loaded." : "Retailer file loaded locally.");
    goTo(2);
    onboarding.emit("import:complete");
  }, [envelope, goTo, refreshSavedDatasets, resetReadinessEvidence, updateTargetId, guidedImport, returnPlanId, onboarding.emit]);

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
    const target = savedDatasets[0] ?? uploadTarget;
    const keepSidebar = Boolean(target);
    terminateStocklessWorkers();
    const cleared = clearActiveSession(envelope);
    resetReadinessEvidence();
    setEnvelope(cleared.envelope);
    setProposals(null);
    setMappingError(null);
    setMappingNotice(null);
    setProductKey(null); setPurchaseView(undefined); setDecisionFocus(undefined); setImpactFocus(undefined);
    setReached(1);
    setStep(1);
    setShowImpact(false);
    setCp3Inputs({});
    setActiveSavedId(null);
    pendingUploadTarget.current = undefined;
    uploadToken.current = globalThis.crypto.randomUUID();
    for (const key of retrySaves.current.keys()) if (key.startsWith("plan:")) retrySaves.current.delete(key);
    generatedSaves.current.clear();
    if (retrySaves.current.size === 0) { setSaveError(null); setSaveState("idle"); }
    lastSavedEnvelope.current = null;
    setUpdateTargetId(guidedImport ? null : target?.id ?? null);
    setSessionNotice(null);
    setUploadTarget(target ?? null);
    setWorkspaceActive(guidedImport ? false : keepSidebar);
    setWorkspaceInfo(null);
    setMappingUndo(null);
    if (!guidedImport) window.history.replaceState(null, "", target ? `#update/${encodeURIComponent(target.id)}` : "#workspace");
  }, [envelope, resetReadinessEvidence, savedDatasets, uploadTarget, guidedImport]);

  const mappingSubmit = useRef(false);
  const [mappingSubmitting, setMappingSubmitting] = useState(false);
  const handleMappingContinue = useCallback(async (activeEnvelope = envelope) => {
    if (mappingSubmit.current || getReadinessBlockers(activeEnvelope.session.mapping).length > 0) return;
    mappingSubmit.current = true;
    setMappingSubmitting(true);
    try {
      if (activeSavedId) await persistWork(activeSavedId, { envelope: activeEnvelope, analysisDate });
      const checked = await executeReadiness(dateConfirmations, true, activeEnvelope);
      if (checked) onboarding.emit("mapping:complete");
    } finally { mappingSubmit.current = false; setMappingSubmitting(false); }
  }, [activeSavedId, analysisDate, dateConfirmations, envelope, executeReadiness, persistWork, onboarding.emit]);

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

  const beginReupload = handleClearSession;

  const navigateResults = async (destination: "purchase" | "impact") => {
    setImpactFocus(undefined); setDecisionFocus(undefined);
    if (!dataset || updateTargetId) {
      const id = updateTargetId ?? activeSavedId ?? uploadTarget?.id;
      if (id) await openSavedDataset(id, destination);
      return;
    }
    if (getReadinessBlockers(envelope.session.mapping).length > 0) {
      // An unfinished reupload leaves the saved plan in place, so open that plan.
      if (pendingUploadTarget.current) { await openSavedDataset(pendingUploadTarget.current, destination); return; }
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
      onGuide={async () => {
        for (const [id, work] of pendingWork.current) await persistWork(id, work);
        if (pendingWork.current.size > 0) return;
        await onboarding.startReplay(activeSavedId ?? returnPlanId ?? uploadTarget?.id);
      }}
      onReturnToPlan={guidedImport && returnPlanId && !activeSavedId && step >= 3 ? () => { onboarding.stop(); window.location.hash = `#dataset/${encodeURIComponent(returnPlanId)}`; } : undefined}
      i3Typography={!showImpact}
      stepDone={step === 1 ? Boolean(dataset) : step === 2 ? getReadinessBlockers(envelope.session.mapping).length === 0 : step === 3 ? Boolean(readiness) : true}
      current={step}
      reached={reached}
      onNavigate={next => { if (next === 1 && workspaceActive) beginReupload(); else goTo(next); }}
      sourceMode={envelope.session.sourceMode}
      sourceName={dataset?.sourceName}
      notice={updateTargetId || step === 2 || step === 3 || step === 4 ? null : sessionNotice}
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
      {guidedImport && returnPlanId && !activeSavedId && step <= 2 && <section className="guided-import-notice" aria-label={t("Your saved plan")}>
        <p>{t(dataset?.sourceMode === "sample" ? "This sample is for practice. It won’t replace your plan or enter upload history." : "Your current plan stays available until your new plan is ready.")}</p>
        <button type="button" className="onboarding-button" onClick={() => { onboarding.stop(); window.location.hash = `#dataset/${encodeURIComponent(returnPlanId)}`; }}>{t("Back to my plan")}</button>
      </section>}
      {saveError && <p role="alert">{t(saveError)}</p>}
      {workspaceActive && dataset?.sourceMode === "user" && <span className="workspace-autosave sr-only" role="status" aria-live="polite">{t(saveState === "saving" ? "Saving automatically…" : saveState === "saved" ? "Saved automatically on this device" : saveState === "error" ? "Waiting to save automatically" : "Your upload will be saved automatically when your purchase plan is ready.")}</span>}
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
        />
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
          focusQuery={readinessFocus}
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
          selectedKey={productKey}
          onSelect={setProductKey}
          focus={impactFocus}
          onPurchaseDecision={openDecision}
          snapshot={effectiveReadiness!}
          contexts={cp3Inputs}
          datasetId={activeSavedId ?? undefined}
          shopName={workspaceDataset.shopName}
          datasetName={workspaceDataset.datasetName}
          supplierDrafts={supplierOrderDrafts}
          onContextChange={(key, value) => updateContexts({ [key]: value })}
          onContextsChange={updateContexts}
          forecast={forecast}
          drafts={purchaseDrafts}
          onBack={() => { setImpactFocus(undefined); setDecisionFocus(undefined); setShowImpact(false); }}
          onNew={beginReupload}
        />
      ))}

      {t(step === 4 && readiness && forecast && !showImpact && (
        <>
        <PurchasePlanScreen
          initialView={purchaseView}
          onViewChange={setPurchaseView}
          decisionFocus={decisionFocus}
          snapshot={effectiveReadiness!}
          contexts={cp3Inputs}
          datasetId={activeSavedId ?? undefined}
          onContextChange={(key, value) => updateContexts({ [key]: value })}
          onContextsChange={updateContexts}
          forecast={forecast}
          drafts={purchaseDrafts}
          onDraftChange={(key, inputs) => {
            const next = { ...latestDrafts.current, [key]: inputs };
            latestDrafts.current = next;
            setPurchaseDrafts(next);
            if (activeSavedId) void persistWork(activeSavedId, { purchaseDrafts: next });
          }}
          onDraftsChange={updates => {
            const next = { ...latestDrafts.current, ...updates };
            latestDrafts.current = next;
            setPurchaseDrafts(next);
            if (activeSavedId) void persistWork(activeSavedId, { purchaseDrafts: next });
          }}
          supplierDrafts={supplierOrderDrafts}
          onSupplierChange={(key, terms) => {
            const next = { ...supplierOrderDrafts, [key]: terms };
            latestSupplierDrafts.current = next;
            setSupplierOrderDrafts(next);
            if (activeSavedId) void persistWork(activeSavedId, { supplierOrderDrafts: next });
          }}
          selectedKey={productKey}
          onSelect={setProductKey}
          onBack={() => { setReadinessFocus(null); setStep(3); }}
          onReviewProduct={key => { const values = readiness.rows.find(row => row.productKey === key)?.interpretedValues; setReadinessFocus(values?.productCode ?? values?.productName ?? null); setStep(3); }}
          onImpact={openImpact}
        />
        </>
      ))}
    </AppShell>
  );
}
