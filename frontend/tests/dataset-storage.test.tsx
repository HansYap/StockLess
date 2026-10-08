import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmIdentityMode, createEmptySession, setMapping, updateSessionMapping, type SessionEnvelope } from "../src/engine.ts";
import { makeEvidence } from "./fixtures.ts";
import { withStore } from "../src/storage/browser-db.ts";
import { clearEverything, createSavedDataset, getSavedDataset, listSavedDatasets, replaceSavedDataset, saveDatasetWork, saveGeneratedPurchasePlan,
  savePurchaseDecision, updateSavedPurchaseDecision, saveStockOutcome, updateSavedStockOutcome, savedPurchaseDecisions, savedStockOutcomes, removeSavedDecision, type SavedWork } from "../src/storage/saved-datasets.ts";

// Exercise the real storage callers against an asynchronous browser database adapter.
function browserDatabase(version: number, stores: Map<string, Map<IDBValidKey, unknown>>) {
  const create = vi.fn((name: string) => {
    stores.set(name, new Map());
    return { createIndex: vi.fn() };
  });
  const remove = vi.fn((name: string) => stores.delete(name));
  const db = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore: create,
    deleteObjectStore: remove,
    close: vi.fn(),
    transaction: vi.fn((names: string | string[]) => {
      for (const name of typeof names === "string" ? [names] : names) {
        if (!stores.has(name)) throw new Error(`Unknown store: ${name}`);
      }
      const transaction = {
        oncomplete: null as (() => void) | null,
        onabort: null as (() => void) | null,
        aborted: false,
        abort() { this.aborted = true; queueMicrotask(() => this.onabort?.()); },
        objectStore: (name: string) => {
          const records = stores.get(name)!;
          const request = (value: unknown) => {
            const result = { result: structuredClone(value), onsuccess: null as (() => void) | null };
            queueMicrotask(() => result.onsuccess?.());
            return result;
          };
          return {
            deleteIndex: vi.fn(), createIndex: vi.fn(),
            delete: (id: IDBValidKey) => { records.delete(id); return request(undefined); },
            count: () => request(records.size),
            get: (id: IDBValidKey) => request(records.get(id)),
            getAll: () => request([...records.values()]),
            add: (value: { id: string }) => { records.set(value.id, structuredClone(value)); return request(value.id); },
            put: (value: { id: string }) => { records.set(value.id, structuredClone(value)); return request(value.id); },
            clear: () => { records.clear(); return request(undefined); },
          };
        },
      };
      setTimeout(() => { if (!transaction.aborted) transaction.oncomplete?.(); }, 0);
      return transaction;
    }),
  };
  const open = vi.fn((_name: string, nextVersion: number) => {
    const request = {
      result: db, get transaction() { return { objectStore: (name: string) => db.transaction([name]).objectStore(name) }; }, onupgradeneeded: null as ((event: { oldVersion: number }) => void) | null,
      onsuccess: null as (() => void) | null,
    };
    queueMicrotask(() => {
      if (version < nextVersion) {
        request.onupgradeneeded?.({ oldVersion: version });
        version = nextVersion;
      }
      request.onsuccess?.();
    });
    return request;
  });
  vi.stubGlobal("indexedDB", { open });
  return { create, remove, open };
}

function importedDataset(): SessionEnvelope {
  const empty = createEmptySession();
  return {
    ...empty, session: { ...empty.session, sourceMode: "user", dataset: {
      sourceMode: "user", sourceName: "sales.csv", sourceSha256: "hash", sourceByteLength: 1,
      delimiter: ",", columns: [], normalizations: [], rows: [
        { sourceRow: 2, originalValues: ["0001", "2"], normalizedValues: ["0001", "2"] },
      ],
    } },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("dataset-only browser storage", () => {
  it("upgrades an existing database by retiring templates without recreating or losing datasets", async () => {
    const saved = { id: "existing", envelope: importedDataset(), decisions: [{ id: "decision" }] };
    const datasets = new Map<IDBValidKey, unknown>([[saved.id, saved]]);
    const stores = new Map([
      ["datasets", datasets],
      ["mapping_templates", new Map<IDBValidKey, unknown>([["old-headings", { rules: {} }]])],
    ]);
    const database = browserDatabase(2, stores);
    expect(await getSavedDataset(saved.id)).toEqual(saved);
    expect(database.open).toHaveBeenCalledWith("stockless", 4);
    expect(database.remove).toHaveBeenCalledExactlyOnceWith("mapping_templates");
    expect(database.create).not.toHaveBeenCalled();
    expect(stores.get("datasets")).toBe(datasets);
    expect(stores.has("mapping_templates")).toBe(false);
  });

  it("saves and reopens dataset rows with their confirmed column setup, then clears dataset work", async () => {
    const stores = new Map<string, Map<IDBValidKey, unknown>>();
    const database = browserDatabase(0, stores);
    const imported = importedDataset();
    const saved = await createSavedDataset("Shop", "Sales", imported, "2026-10-05");
    let mapping = setMapping(imported.session.mapping, "transaction_date", "date", true);
    mapping = setMapping(mapping, "quantity_sold", "qty", true);
    mapping = setMapping(mapping, "product_code", "sku", true);
    mapping = confirmIdentityMode(mapping, "stable");
    const confirmed = updateSessionMapping(imported, mapping);
    await saveDatasetWork(saved.id, { envelope: confirmed });
    const reopened = await getSavedDataset(saved.id);
    expect(reopened?.envelope.session.mapping).toEqual(mapping);
    expect(reopened?.envelope.session.dataset?.rows).toEqual(imported.session.dataset?.rows);
    expect([...stores.keys()]).toEqual(["datasets"]);
    expect(database.create).toHaveBeenCalledExactlyOnceWith("datasets", { keyPath: "id" });
    await clearEverything();
    expect(await withStore("datasets", "readonly", (store) => store.getAll())).toEqual([]);
  });
});


it("archives the previous file and keeps only the latest 12 uploads, regardless of plan edits", async () => {
  const stores = new Map<string, Map<IDBValidKey, unknown>>();
  browserDatabase(0, stores);
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    const first = await createSavedDataset("Corner Shop", "First upload", importedDataset(), "2026-09-01");
    await saveDatasetWork(first.id, { supplierTerms: { Vendor: "Case of 6" } });
    for (let day = 2; day <= 13; day++) {
      vi.setSystemTime(new Date(`2026-09-${String(day).padStart(2, "0")}T00:00:00Z`));
      const imported = importedDataset();
      const replacement = { ...imported, session: { ...imported.session, dataset: { ...imported.session.dataset!, sourceName: `sales-${day}.csv`, sourceSha256: `hash-${day}` } } };
      await replaceSavedDataset(first.id, replacement);
    }
    const history = await listSavedDatasets();
    expect(history).toHaveLength(12);
    expect(stores.get("datasets")?.size).toBe(12);
    expect(history[0].id).toBe(first.id);
    expect(history[0].sourceName).toBe("sales-13.csv");
    expect(history.at(-1)?.sourceName).toBe("sales-2.csv");
    const archived = await getSavedDataset(history[1].id);
    expect(archived?.envelope.session.dataset?.sourceName).toBe("sales-12.csv");
    expect(archived?.supplierTerms).toEqual({ Vendor: "Case of 6" });
    vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
    await saveDatasetWork(history[1].id, { supplierTerms: { Vendor: "Edited older plan" } });
    expect((await listSavedDatasets())[0].id).toBe(first.id);
  } finally { vi.useRealTimers(); }
});


function completedWork(envelope = importedDataset()): SavedWork {
  const evidence = makeEvidence();
  return { envelope, analysisDate: evidence.snapshot.analysisDate, dateConfirmations: [],
    readiness: evidence.snapshot, forecast: evidence.forecast, purchaseDrafts: {}, supplierOrderDrafts: {}, supplierTerms: {} };
}
function planRecord(id: string) {
  return { id, recordedAt: "2026-10-07T00:00:00Z", recommendation: { analysisDate: "2026-10-07", sourceSha256: id, products: [] }, note: "Generated purchase plan" };
}

it("automatically names a completed upload and stores its plan and original version together", async () => {
  const stores = new Map<string, Map<IDBValidKey, unknown>>();
  browserDatabase(0, stores);
  const work = completedWork();
  const first = await saveGeneratedPurchasePlan(work, planRecord("first"));
  expect(first.datasetName).toBe("sales");
  expect(first.shopName).toBe("My store");
  expect((await getSavedDataset(first.id))?.forecast).toEqual(work.forecast);
  await saveDatasetWork(first.id, { supplierTerms: { Vendor: "Case of 6" } });
  const imported = importedDataset();
  const replacement = { ...imported, session: { ...imported.session, dataset: { ...imported.session.dataset!, sourceName: "latest.csv", sourceSha256: "new-hash" } } };
  const next = await saveGeneratedPurchasePlan(completedWork(replacement), planRecord("second"), first.id, true);
  expect(next.id).toBe(first.id);
  expect(next.datasetName).toBe("latest");
  expect(next.supplierTerms).toEqual({ Vendor: "Case of 6" });
  const history = await listSavedDatasets();
  expect(history).toHaveLength(2);
  const archived = await getSavedDataset(history.find(item => item.id !== first.id)!.id);
  expect(archived?.envelope.session.dataset?.sourceName).toBe("sales.csv");
  expect(archived?.forecast).toEqual(work.forecast);
  expect(archived?.decisions.map(item => item.id)).toEqual(["first"]);
  await saveGeneratedPurchasePlan(completedWork(replacement), planRecord("second"), first.id);
  expect(await listSavedDatasets()).toHaveLength(2);
  expect((await getSavedDataset(first.id))?.decisions.map(item => item.id)).toEqual(["first", "second"]);
});

it("does not create or replace saved work before the purchase plan is ready", async () => {
  const stores = new Map<string, Map<IDBValidKey, unknown>>();
  browserDatabase(0, stores);
  const first = await saveGeneratedPurchasePlan(completedWork(), planRecord("first"));
  const before = await getSavedDataset(first.id);
  await expect(saveGeneratedPurchasePlan({ ...completedWork(), forecast: null }, planRecord("second"), first.id, true)).rejects.toThrow("Generate a purchase plan");
  expect(await getSavedDataset(first.id)).toEqual(before);
  expect(await listSavedDatasets()).toHaveLength(1);
});

it("explicit decisions and measured zero outcomes persist without converting generated previews or free-text notes", async () => {
  const stores = new Map<string, Map<IDBValidKey, unknown>>(); browserDatabase(0, stores);
  const saved = await saveGeneratedPurchasePlan(completedWork(), planRecord("generated"));
  const recommendation = { productKey: "A", productName: "Tea", productCode: "0001", packSize: "250 g", sourceName: "sales.csv", sourceSha256: "hash", sourceMode: "user" as const,
    analysisDate: saved.analysisDate, policyVersion: "cp3-v2", recommendedQuantity: 12, quantityUnit: "pieces" };
  // The checked source must agree with the imported file before a decision can be saved.
  await saveDatasetWork(saved.id, { readiness: { ...saved.readiness!, sourceSha256: "hash" } });
  const withDecision = await savePurchaseDecision(saved.id, { id: "chosen", response: "Changed", finalQuantity: 6, reason: "Shelf capacity", referenceDate: "2026-10-08", recordedAt: "2026-10-08T10:00:00Z", recommendation });
  expect(withDecision.decisions).toHaveLength(2);
  expect(savedPurchaseDecisions(withDecision)).toHaveLength(1);
  expect(withDecision.decisions[0].purchaseDecision).toBeUndefined();
  await saveStockOutcome(saved.id, { id: "observed-zero", productKey: "A", decisionId: "chosen", kind: "discarded", date: "2026-10-08", quantity: 0, unit: "pieces", referenceDate: "2026-10-08", recordedAt: "2026-10-08T11:00:00Z" });
  const reopened = (await getSavedDataset(saved.id))!;
  expect(savedStockOutcomes(reopened)[0].quantity).toBe(0);
  const corrected = await updateSavedPurchaseDecision(saved.id, "chosen", { response: "Changed", finalQuantity: 4, reason: "Corrected count", referenceDate: "2026-10-08" });
  expect(savedPurchaseDecisions(corrected)[0].recommendation).toEqual(recommendation);
  expect(savedPurchaseDecisions(corrected)[0].finalQuantity).toBe(4);
  await removeSavedDecision(saved.id, "chosen");
  const afterDelete = (await getSavedDataset(saved.id))!;
  expect(savedPurchaseDecisions(afterDelete)).toEqual([]);
  expect(savedStockOutcomes(afterDelete)[0].quantity).toBe(0);
  expect(savedStockOutcomes(afterDelete)[0].decisionId).toBeUndefined();
});

it("rejects wrong-source decisions and wrong-product outcome links without adding records", async () => {
  const stores = new Map<string, Map<IDBValidKey, unknown>>(); browserDatabase(0, stores);
  const saved = await saveGeneratedPurchasePlan(completedWork(), planRecord("generated"));
  await expect(savePurchaseDecision(saved.id, { id: "wrong", response: "Followed", referenceDate: "2026-10-08", recordedAt: "2026-10-08T10:00:00Z",
    recommendation: { productKey: "A", productName: "Tea", sourceName: "other.csv", sourceSha256: "wrong", sourceMode: "user", analysisDate: saved.analysisDate, policyVersion: "cp3-v2", recommendedQuantity: 12, quantityUnit: "pieces" } })).rejects.toThrow("does not match");
  await expect(saveStockOutcome(saved.id, { productKey: "A", decisionId: "generated", kind: "expired", date: "2026-10-08", quantity: 1, unit: "pieces", referenceDate: "2026-10-08" })).rejects.toThrow("related decision");
  const reopened = (await getSavedDataset(saved.id))!;
  expect(reopened.decisions).toHaveLength(1); expect(reopened.outcomes).toEqual([]);
});

it("freezes known pack and seller mass at recording while litres require a volume basis", async () => {
  browserDatabase(0, new Map());
  const work = completedWork();
  const readiness = { ...work.readiness!, evidenceKey: 'weight-source', rows: work.readiness!.rows.map(row => ({ ...row, interpretedValues: { ...row.interpretedValues, packVariant: '500g' } })) };
  const saved = await saveGeneratedPurchasePlan({ ...work, readiness }, planRecord('generated'));
  const input = { productKey: 'A', kind: 'discarded' as const, date: '2026-10-08', quantity: 2, unit: 'pieces' as const, referenceDate: '2026-10-08' };
  await saveStockOutcome(saved.id, { ...input, id: 'pack' });
  expect(savedStockOutcomes((await getSavedDataset(saved.id))!)[0].conversion?.kilogramsPerUnit).toBe(.5);
  await saveDatasetWork(saved.id, { cp3Inputs: { A: { evidenceKey: 'weight-source', kgPerUnit: .2 } } });
  await saveStockOutcome(saved.id, { ...input, id: 'manual' });
  await updateSavedStockOutcome(saved.id, 'pack', { ...input, quantity: 3 });
  await saveStockOutcome(saved.id, { ...input, id: 'litres', unit: 'litres' });
  const outcomes = savedStockOutcomes((await getSavedDataset(saved.id))!);
  expect(outcomes.find(o=>o.id==='pack')?.conversion?.kilogramsPerUnit).toBe(.5);
  expect(outcomes.find(o=>o.id==='manual')?.conversion?.kilogramsPerUnit).toBe(.2);
  expect(outcomes.find(o=>o.id==='litres')?.conversion).toBeUndefined();
});
