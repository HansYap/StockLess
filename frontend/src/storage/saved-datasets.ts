import type {
  DateFormatConfirmation, DemandForecastReview,
  ProductPurchaseInputs, ProductPurchasePlan, ReadinessSnapshot, SessionEnvelope,
} from "../engine.ts";
import type { PurchaseDrafts } from "../purchase-plan/model.ts";
import { withStore, withTransaction } from "./browser-db.ts";

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
  readonly decisions: readonly SavedDecision[];
  readonly outcomes: readonly SavedOutcome[];
}

/** Frozen evidence from the time a retailer made a decision. Updates never rewrite it. */
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
}

export interface SavedOutcome {
  readonly id: string;
  readonly recordedAt: string;
  readonly decisionId?: string;
  readonly details: Readonly<Record<string, unknown>>;
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
  return items.map(summarizeSavedDataset).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
    await withStore<IDBValidKey>("datasets", "readwrite", (store) => store.add(saved));
  } catch (error) {
    if (error instanceof Error && error.name === "ConstraintError") throw new DatasetNameConflictError();
    throw error;
  }
  return saved;
}

export type SavedWork = Pick<SavedDataset,
  "envelope" | "analysisDate" | "dateConfirmations" | "readiness" | "forecast" | "purchaseDrafts" | "supplierTerms">;

const pendingMutations = new Map<string, Promise<unknown>>();

function mutateSavedDataset(
  id: string, change: (current: SavedDataset) => SavedDataset,
): Promise<SavedDataset> {
  const previous = pendingMutations.get(id) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(() => withTransaction<SavedDataset>(["datasets"], "readwrite", (transaction, result) => {
    const store = transaction.objectStore("datasets");
    const request = store.get(id) as IDBRequest<SavedDataset | undefined>;
    request.onsuccess = () => {
      const current = request.result;
      if (!current) { transaction.abort(); return; }
      const next = change(current);
      store.put(next);
      result(next);
    };
  }));
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
export function replaceDatasetContents(current: SavedDataset, replacement: SessionEnvelope, now = new Date().toISOString(), analysisDate = current.analysisDate): SavedDataset {
  requireImport(replacement);
  return {
    ...current, envelope: replacement, readiness: null, forecast: null,
    analysisDate, dateConfirmations: [], updatedAt: now,
  };
}

export function replaceSavedDataset(id: string, replacement: SessionEnvelope, analysisDate?: string): Promise<SavedDataset> {
  requireImport(replacement);
  return mutateSavedDataset(id, (current) => replaceDatasetContents(current, replacement, new Date().toISOString(), analysisDate));
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

export function removeSavedDecision(datasetId: string, decisionId: string): Promise<SavedDataset> {
  return mutateSavedDataset(datasetId, (current) => ({
    ...current,
    decisions: current.decisions.filter((item) => item.id !== decisionId),
    outcomes: current.outcomes.filter((item) => item.decisionId !== decisionId),
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
}
