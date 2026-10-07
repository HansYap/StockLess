import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmIdentityMode, createEmptySession, setMapping, updateSessionMapping, type SessionEnvelope } from "../src/engine.ts";
import { withStore } from "../src/storage/browser-db.ts";
import { clearEverything, createSavedDataset, getSavedDataset, listSavedDatasets, replaceSavedDataset, saveDatasetWork } from "../src/storage/saved-datasets.ts";

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
      setTimeout(() => transaction.oncomplete?.(), 0);
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
