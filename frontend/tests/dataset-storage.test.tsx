import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmIdentityMode, createEmptySession, setMapping, updateSessionMapping, type SessionEnvelope } from "../src/engine.ts";
import { withStore } from "../src/storage/browser-db.ts";
import { clearEverything, createSavedDataset, getSavedDataset, saveDatasetWork } from "../src/storage/saved-datasets.ts";

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
      result: db, onupgradeneeded: null as ((event: { oldVersion: number }) => void) | null,
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
    expect(database.open).toHaveBeenCalledWith("stockless", 3);
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
