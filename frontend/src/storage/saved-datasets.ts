import type {
  DateFormatConfirmation, DemandForecastReview,
  ProductPurchaseInputs, ProductPurchasePlan, ReadinessSnapshot, SessionEnvelope, SupplierOrderTerms,
  PurchaseDecision, PurchaseDecisionInput, PurchaseDecisionEdit, RecordedStockOutcome, StockOutcomeInput,
} from "../engine.ts";
import { createPurchaseDecision, updatePurchaseDecision, createStockOutcome, updateStockOutcome, emptyProductPurchaseInputs } from "../engine.ts";
import { applyPlanningContexts, planningMass, parsePackQuantity } from "../engine.ts";
import type { PurchaseDrafts } from "../purchase-plan/model.ts";
import { withStore, withTransaction } from "./browser-db.ts";

export const UPLOAD_HISTORY_LIMIT = 12;

/** Remember returning use even if an unfinished file is cleared or the last history item is removed. */
export const UPLOAD_VISIT_KEY = "stockless.hasUploaded";
export function hasUploadedBefore(): boolean {
  try { return localStorage.getItem(UPLOAD_VISIT_KEY) === "true"; } catch { return false; }
}
export function rememberUploadVisit(): void {
  try { localStorage.setItem(UPLOAD_VISIT_KEY, "true"); } catch { /* Available saved uploads still identify returning use. */ }
}

/** Upload time, rather than plan edits, determines the current file and history order. */
export function newestUploads<T extends Pick<SavedDataset, "createdAt">>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, UPLOAD_HISTORY_LIMIT);
}

function writeUpload(store: IDBObjectStore, saved: SavedDataset, previous?: SavedDataset): void {
  if (previous) {
    const archiveId = globalThis.crypto.randomUUID();
    // The historical file becomes its own selectable dataset; evidence and dates stay intact.
    store.add({ ...previous, id: archiveId,
      decisions: previous.decisions.map(item => item.purchaseDecision ? { ...item, purchaseDecision: { ...item.purchaseDecision, datasetId: archiveId } } : item),
      outcomes: previous.outcomes.map(item => item.stockOutcome ? { ...item, stockOutcome: { ...item.stockOutcome, datasetId: archiveId } } : item),
    });
  }
  store.put(saved);
  const request = store.getAll() as IDBRequest<SavedDataset[]>;
  request.onsuccess = () => {
    const keep = new Set(newestUploads(request.result).map(item => item.id));
    for (const item of request.result) if (!keep.has(item.id)) store.delete(item.id);
  };
}

/** A saved workspace belongs to exactly one named shop and one named dataset. */
export interface SavedDataset {
  readonly id: string;
  readonly shopName: string;
  readonly datasetName: string;
  readonly shopKey: string;
  readonly nameKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly envelope: SessionEnvelope;
  readonly analysisDate: string;
  readonly dateConfirmations: readonly DateFormatConfirmation[];
  readonly readiness: ReadinessSnapshot | null;
  readonly forecast: DemandForecastReview | null;
  readonly purchaseDrafts: PurchaseDrafts;
  readonly supplierTerms: Readonly<Record<string, string>>;
  readonly cp3Inputs?: import("../engine.ts").PlanningContexts;
  readonly supplierOrderDrafts?: Readonly<Record<string, SupplierOrderTerms | undefined>>;
  readonly decisions: readonly SavedDecision[];
  readonly outcomes: readonly SavedOutcome[];
}

/** Frozen evidence from plan generation or an explicitly recorded decision. Updates never rewrite it. */
export interface SavedDecision {
  readonly id: string;
  readonly recordedAt: string;
  readonly recommendation: {
    readonly analysisDate: string;
    readonly sourceSha256: string;
    readonly products: readonly {
      readonly key: string;
      readonly name: string;
      readonly inputs: ProductPurchaseInputs;
      readonly plan?: ProductPurchasePlan;
    }[];
  };
  readonly note?: string;
  /** Absent on legacy automatically saved plan previews, which are not user decisions. */
  readonly purchaseDecision?: PurchaseDecision;
}

export interface SavedOutcome {
  readonly id: string;
  readonly recordedAt: string;
  readonly decisionId?: string;
  readonly details: Readonly<Record<string, unknown>>;
  /** Legacy free-text notes remain available without pretending to be measured waste. */
  readonly stockOutcome?: RecordedStockOutcome;
}

export type SavedDatasetSummary = Pick<SavedDataset,
  "id" | "shopName" | "datasetName" | "createdAt" | "updatedAt"> & {
  readonly sourceName: string;
  readonly rowCount: number;
  readonly decisionCount: number;
  readonly outcomeCount: number;
  readonly planCount: number;
  readonly supplierTermCount: number;
};

export class DatasetNameConflictError extends Error {
  constructor() { super("This shop already has a dataset with that name. Update it or choose another name."); }
}

function name(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) throw new Error("Enter a shop and dataset name.");
  return trimmed;
}

function key(value: string): string { return value.normalize("NFKC").toLocaleLowerCase(); }

function requireImport(envelope: SessionEnvelope): void {
  if (!envelope.session.dataset || envelope.session.dataset.sourceMode !== "user") {
    throw new Error("Import a retailer dataset before saving it.");
  }
}

export function summarizeSavedDataset(item: SavedDataset): SavedDatasetSummary {
  return {
    id: item.id, shopName: item.shopName, datasetName: item.datasetName,
    createdAt: item.createdAt, updatedAt: item.updatedAt,
    sourceName: item.envelope.session.dataset?.sourceName ?? "",
    rowCount: item.envelope.session.dataset?.rows.length ?? 0,
    decisionCount: item.decisions.length, outcomeCount: item.outcomes.length,
    planCount: Object.keys(item.purchaseDrafts).length,
    supplierTermCount: Object.keys(item.supplierTerms ?? {}).length,
  };
}

export async function listSavedDatasets(): Promise<readonly SavedDatasetSummary[]> {
  const items = await withStore<SavedDataset[]>("datasets", "readonly", (store) => store.getAll());
  return newestUploads(items).map(summarizeSavedDataset);
}

export async function hasSavedDatasets(): Promise<boolean> {
  return (await withStore<number>("datasets", "readonly", (store) => store.count())) > 0;
}

export async function getSavedDataset(id: string): Promise<SavedDataset | undefined> {
  return withStore<SavedDataset | undefined>("datasets", "readonly", (store) => store.get(id));
}

export async function findSavedDataset(shopName: string, datasetName: string): Promise<SavedDataset | undefined> {
  return withStore<SavedDataset | undefined>("datasets", "readonly", (store) =>
    store.index("shop_and_name").get([key(name(shopName)), key(name(datasetName))]));
}

export async function createSavedDataset(
  shopInput: string, datasetInput: string, envelope: SessionEnvelope,
  analysisDate: string,
): Promise<SavedDataset> {
  requireImport(envelope);
  const shopName = name(shopInput);
  const datasetName = name(datasetInput);
  const now = new Date().toISOString();
  const saved: SavedDataset = {
    id: globalThis.crypto.randomUUID(), shopName, datasetName,
    shopKey: key(shopName), nameKey: key(datasetName), createdAt: now, updatedAt: now,
    envelope, analysisDate, dateConfirmations: [],
    readiness: null, forecast: null, purchaseDrafts: {}, supplierTerms: {}, decisions: [], outcomes: [],
  };
  try {
    await withTransaction<void>(["datasets"], "readwrite", (transaction, result) => {
      writeUpload(transaction.objectStore("datasets"), saved);
      result(undefined);
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ConstraintError") throw new DatasetNameConflictError();
    throw error;
  }
  return saved;
}

export type SavedWork = Pick<SavedDataset,
  "envelope" | "analysisDate" | "dateConfirmations" | "readiness" | "forecast" | "purchaseDrafts" | "supplierTerms" | "supplierOrderDrafts" | "cp3Inputs">;

/** Commit a complete plan and its upload together; incomplete imports never replace saved work. */
export async function saveGeneratedPurchasePlan(
  work: SavedWork, plan: SavedDecision, datasetId?: string, newUpload = false,
): Promise<SavedDataset> {
  requireImport(work.envelope);
  if (!work.readiness || !work.forecast || work.forecast.snapshotId !== work.readiness.id) {
    throw new Error("Generate a purchase plan before saving this upload.");
  }
  await Promise.all([...pendingMutations.values()].map(operation => operation.catch(() => undefined)));
  return withTransaction<SavedDataset>(["datasets"], "readwrite", (transaction, result) => {
    const store = transaction.objectStore("datasets");
    const request = store.getAll() as IDBRequest<SavedDataset[]>;
    request.onsuccess = () => {
      const current = datasetId ? request.result.find(item => item.id === datasetId) : newestUploads(request.result)[0];
      if (datasetId && !current) { transaction.abort(); return; }
      const upload = newUpload || !datasetId;
      const now = new Date().toISOString();
      const datasetName = work.envelope.session.dataset!.sourceName.replace(/\.[^.]+$/, "") || "Sales upload";
      const shopName = current?.shopName ?? "My store";
      const saved: SavedDataset = {
        ...(current ?? {}), ...work,
        supplierTerms: { ...current?.supplierTerms, ...work.supplierTerms },
        id: current?.id ?? globalThis.crypto.randomUUID(),
        shopName, shopKey: current?.shopKey ?? key(shopName),
        datasetName: upload ? datasetName : current!.datasetName,
        nameKey: upload ? key(datasetName) : current!.nameKey,
        createdAt: upload ? now : current!.createdAt, updatedAt: now,
        decisions: current?.decisions.some(item => item.id === plan.id)
          ? current.decisions : [...(current?.decisions ?? []), plan],
        outcomes: current?.outcomes ?? [],
      };
      if (upload) writeUpload(store, saved, current);
      else store.put(saved);
      result(saved);
    };
  });
}

const pendingMutations = new Map<string, Promise<unknown>>();

function mutateSavedDataset(
  id: string, change: (current: SavedDataset) => SavedDataset,
  upload = false,
): Promise<SavedDataset> {
  const previous = pendingMutations.get(id) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(() => {
    let mutationError: unknown;
    return withTransaction<SavedDataset>(["datasets"], "readwrite", (transaction, result) => {
    const store = transaction.objectStore("datasets");
    const request = store.get(id) as IDBRequest<SavedDataset | undefined>;
    request.onsuccess = () => {
      const current = request.result;
      if (!current) { transaction.abort(); return; }
      try {
        const next = change(current);
        if (upload) writeUpload(store, next, current);
        else store.put(next);
        result(next);
      } catch (error) { mutationError = error; transaction.abort(); }
    };
    }).catch(error => { throw mutationError ?? error; });
  });
  pendingMutations.set(id, operation);
  void operation.finally(() => {
    if (pendingMutations.get(id) === operation) pendingMutations.delete(id);
  }).catch(() => undefined);
  return operation;
}

/** Save edited planning inputs and supplier terms without changing old decisions. */
export function saveDatasetWork(id: string, work: Partial<SavedWork>): Promise<SavedDataset> {
  return mutateSavedDataset(id, (current) => ({
    ...current, ...work, updatedAt: new Date().toISOString(),
  }));
}

/** Replaces the parsed file only after import succeeds. History and planning edits remain. */
export function replaceDatasetContents(current: SavedDataset, replacement: SessionEnvelope, now = new Date().toISOString(), analysisDate = current.analysisDate, datasetInput?: string): SavedDataset {
  requireImport(replacement);
  const datasetName = name(datasetInput ?? replacement.session.dataset!.sourceName.replace(/\.[^.]+$/, ""));
  return {
    ...current, envelope: replacement, readiness: null, forecast: null,
    datasetName, nameKey: key(datasetName),
    analysisDate, dateConfirmations: [], createdAt: now, updatedAt: now,
  };
}

export function replaceSavedDataset(id: string, replacement: SessionEnvelope, analysisDate?: string, datasetName?: string): Promise<SavedDataset> {
  requireImport(replacement);
  return mutateSavedDataset(id, (current) => replaceDatasetContents(current, replacement, new Date().toISOString(), analysisDate, datasetName), true);
}

export function recordDecision(id: string, decision: SavedDecision): Promise<SavedDataset> {
  return mutateSavedDataset(id, (current) => ({
    ...current,
    decisions: current.decisions.some((item) => item.id === decision.id)
      ? current.decisions : [...current.decisions, decision],
    updatedAt: new Date().toISOString(),
  }));
}

export function recordOutcome(id: string, outcome: SavedOutcome): Promise<SavedDataset> {
  return mutateSavedDataset(id, (current) => ({
    ...current,
    outcomes: current.outcomes.some((item) => item.id === outcome.id)
      ? current.outcomes : [...current.outcomes, outcome],
    updatedAt: new Date().toISOString(),
  }));
}

function decisionRecord(decision: PurchaseDecision): SavedDecision {
  const evidence = decision.recommendation;
  return {
    id: decision.id, recordedAt: decision.recordedAt, note: decision.reason,
    recommendation: { analysisDate: evidence.analysisDate, sourceSha256: evidence.sourceSha256,
      products: [{ key: decision.productKey, name: evidence.productName,
        inputs: evidence.inputs ?? emptyProductPurchaseInputs(), plan: evidence.plan }] },
    purchaseDecision: decision,
  };
}

/** Only explicit user choices enter typed decision history; generated previews stay separate. */
export function savedPurchaseDecisions(dataset: SavedDataset): readonly PurchaseDecision[] {
  return dataset.decisions.flatMap(item => item.purchaseDecision ? [item.purchaseDecision] : []);
}

export function savedStockOutcomes(dataset: SavedDataset): readonly RecordedStockOutcome[] {
  return dataset.outcomes.flatMap(item => item.stockOutcome ? [item.stockOutcome] : []);
}

export function savePurchaseDecision(datasetId: string, input: Omit<PurchaseDecisionInput, "datasetId">): Promise<SavedDataset> {
  const decision = createPurchaseDecision({ ...input, datasetId });
  if (decision.recommendation.sourceMode !== "user") return Promise.reject(new Error("Sample decisions are illustrative and cannot enter business outcome history."));
  return mutateSavedDataset(datasetId, current => {
    requireImport(current.envelope);
    if (current.decisions.some(item => item.id === decision.id)) throw new Error("This decision already exists. Use the edit action to correct it.");
    if (!current.readiness || current.readiness.sourceSha256 !== decision.recommendation.sourceSha256
      || current.readiness.analysisDate !== decision.recommendation.analysisDate
      || current.envelope.session.dataset!.sourceSha256 !== decision.recommendation.sourceSha256
      || !current.readiness.rows.some(row => row.productKey === decision.productKey)) {
      throw new Error("The recommendation does not match this dataset's checked product evidence. Run readiness and purchase planning again.");
    }
    if (decision.recommendation.unitCost !== undefined) {
      const cost = applyPlanningContexts(current.readiness, current.cp3Inputs ?? {}).productCosts?.find(item => item.productKey === decision.productKey);
      if (cost?.state !== "usable" || cost.value !== decision.recommendation.unitCost) throw new Error("The preserved Unit Cost must match this dataset's validated product cost.");
    }
    return { ...current, decisions: [...current.decisions, decisionRecord(decision)], updatedAt: new Date().toISOString() };
  });
}

/** Editing never substitutes a fresh recommendation for the original decision evidence. */
export function updateSavedPurchaseDecision(datasetId: string, decisionId: string, edit: PurchaseDecisionEdit): Promise<SavedDataset> {
  return mutateSavedDataset(datasetId, current => {
    const existing = current.decisions.find(item => item.id === decisionId)?.purchaseDecision;
    if (!existing || existing.datasetId !== datasetId) throw new Error("Select an explicitly recorded purchase decision to edit.");
    const decision = updatePurchaseDecision(existing, edit);
    return { ...current, decisions: current.decisions.map(item => item.id === decisionId ? decisionRecord(decision) : item), updatedAt: new Date().toISOString() };
  });
}

function outcomeRecord(outcome: RecordedStockOutcome): SavedOutcome {
  return { id: outcome.id, recordedAt: outcome.recordedAt, decisionId: outcome.decisionId,
    details: { description: outcome.description ?? `${outcome.kind}: ${outcome.quantity} ${outcome.unit}`, productKey: outcome.productKey,
      date: outcome.date, quantity: outcome.quantity, unit: outcome.unit, kind: outcome.kind }, stockOutcome: outcome };
}

function requireOutcomeProduct(current: SavedDataset, outcome: RecordedStockOutcome): void {
  requireImport(current.envelope);
  const decision = outcome.decisionId ? current.decisions.find(item => item.id === outcome.decisionId)?.purchaseDecision : undefined;
  if (outcome.decisionId && (!decision || decision.productKey !== outcome.productKey || decision.datasetId !== current.id)) {
    throw new Error("The related decision must belong to this dataset and product.");
  }
  if (!current.readiness?.rows.some(row => row.productKey === outcome.productKey)
    && !current.decisions.some(item => item.purchaseDecision?.productKey === outcome.productKey || item.recommendation.products.some(product => product.key === outcome.productKey))) {
    throw new Error("Select a product from this dataset or its saved decision history.");
  }
}

export function saveStockOutcome(datasetId: string, input: Omit<StockOutcomeInput, "datasetId">): Promise<SavedDataset> {
  return mutateSavedDataset(datasetId, current => {
    const outcome = createStockOutcome({ ...input, datasetId, conversion: input.conversion ?? frozenOutcomeConversion(current, input.productKey, input.unit) });
    requireOutcomeProduct(current, outcome);
    if (current.outcomes.some(item => item.id === outcome.id)) throw new Error("This outcome already exists. Use the edit action to correct it.");
    return { ...current, outcomes: [...current.outcomes, outcomeRecord(outcome)], updatedAt: new Date().toISOString() };
  });
}

/** Freeze the conversion with the observation; later product edits must not rewrite history. */
function frozenOutcomeConversion(current: SavedDataset, productKey: string, unit: StockOutcomeInput['unit']) {
  if (!current.readiness || unit === 'kg') return undefined;
  const context = current.cp3Inputs?.[productKey];
  const mass = planningMass(current.readiness, productKey, context, true);
  if (mass.state !== 'available') return undefined;
  const estimated = mass.method !== 'manual' && (mass.method !== 'pack_parser' || mass.approximate);
  if (unit === 'pieces') return { kilogramsPerUnit: mass.kgPerUnit, estimated, source: `At recording: ${mass.provenance}` };
  const pack = parsePackQuantity(current.readiness.rows.find(row => row.productKey === productKey)?.interpretedValues.packVariant ?? '');
  return pack.state === 'available' && pack.dimension === 'l'
    ? { kilogramsPerUnit: mass.kgPerUnit / pack.quantity, estimated, source: `At recording: ${mass.provenance}; ${pack.quantity} litres per sales unit` } : undefined;
}

export function updateSavedStockOutcome(datasetId: string, outcomeId: string, edit: Omit<StockOutcomeInput, "id" | "datasetId" | "productKey">): Promise<SavedDataset> {
  return mutateSavedDataset(datasetId, current => {
    const existing = current.outcomes.find(item => item.id === outcomeId)?.stockOutcome;
    if (!existing || existing.datasetId !== datasetId) throw new Error("Select a measured stock outcome to edit.");
    const conversion = edit.conversion ?? (existing.unit === edit.unit ? existing.conversion : frozenOutcomeConversion(current, existing.productKey, edit.unit));
    const outcome = updateStockOutcome(existing, { ...edit, conversion });
    requireOutcomeProduct(current, outcome);
    return { ...current, outcomes: current.outcomes.map(item => item.id === outcomeId ? outcomeRecord(outcome) : item), updatedAt: new Date().toISOString() };
  });
}

export function removeSavedDecision(datasetId: string, decisionId: string): Promise<SavedDataset> {
  return mutateSavedDataset(datasetId, (current) => ({
    ...current,
    decisions: current.decisions.filter((item) => item.id !== decisionId),
    // Removing a recommendation must not erase actual discarded stock already recorded.
    outcomes: current.outcomes.map(item => item.decisionId === decisionId
      ? { ...item, decisionId: undefined, stockOutcome: item.stockOutcome && { ...item.stockOutcome, decisionId: undefined } } : item),
    updatedAt: new Date().toISOString(),
  }));
}

export function removeSavedOutcome(datasetId: string, outcomeId: string): Promise<SavedDataset> {
  return mutateSavedDataset(datasetId, (current) => ({
    ...current, outcomes: current.outcomes.filter((item) => item.id !== outcomeId),
    updatedAt: new Date().toISOString(),
  }));
}

export function removeSavedPlan(datasetId: string, productKey: string): Promise<SavedDataset> {
  return mutateSavedDataset(datasetId, (current) => {
    const purchaseDrafts = { ...current.purchaseDrafts };
    delete purchaseDrafts[productKey];
    return { ...current, purchaseDrafts, updatedAt: new Date().toISOString() };
  });
}

export async function removeSavedDataset(id: string): Promise<void> {
  await pendingMutations.get(id)?.catch(() => undefined);
  await withStore<undefined>("datasets", "readwrite", (store) => store.delete(id));
}

/** Clears all saved dataset work after pending edits finish. */
export async function clearEverything(): Promise<void> {
  await Promise.all([...pendingMutations.values()].map((operation) => operation.catch(() => undefined)));
  await withTransaction<void>(["datasets"], "readwrite", (transaction, result) => {
    transaction.objectStore("datasets").clear();
    result(undefined);
  });
  try { localStorage.removeItem(UPLOAD_VISIT_KEY); } catch { /* Browser storage may be unavailable. */ }
}
