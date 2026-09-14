import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmIdentityMode,
  createMappingState,
  setMapping,
  type MappingState,
  type ParsedDataset,
  type SessionEnvelope,
} from "../src/engine.ts";

const memory = vi.hoisted(() => new Map<string, unknown>());

vi.mock("../src/storage/browser-db.ts", () => ({
  withStore: async <T,>(
    _storeName: string,
    _mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const store = {
      put(value: { headersKey: string }) {
        memory.set(value.headersKey, value);
        return { result: value.headersKey };
      },
      getAll() {
        return { result: [...memory.values()] };
      },
      count() {
        return { result: memory.size };
      },
      clear() {
        memory.clear();
        return { result: undefined };
      },
    } as unknown as IDBObjectStore;
    return run(store).result;
  },
}));

import {
  confirmAllMatches,
  countSavedMatchings,
  deleteAllSavedMatchings,
  loadSavedMatching,
  saveMatching,
} from "../src/storage/saved-matching.ts";

function envelope(headers: readonly string[], mapping = createMappingState()): SessionEnvelope {
  const dataset: ParsedDataset = {
    sourceMode: "user",
    sourceName: "sales.csv",
    sourceByteLength: 100,
    sourceSha256: "hash",
    delimiter: ",",
    columns: headers.map((header, index) => ({
      id: `column-${index}`,
      index,
      header,
      normalizedHeader: header.trim(),
      previewValues: [],
    })),
    rows: [],
    normalizations: [],
  };
  return {
    preferences: {},
    session: {
      id: "session",
      sourceMode: "user",
      dataset,
      mapping,
      identityEvidence: [],
      createdAt: "2026-09-14T00:00:00.000Z",
    },
  };
}

function confirmedStableMapping(): MappingState {
  let mapping = createMappingState();
  mapping = setMapping(mapping, "transaction_date", "column-0", true);
  mapping = setMapping(mapping, "quantity_sold", "column-1", true);
  mapping = setMapping(mapping, "product_code", "column-2", true);
  return confirmIdentityMode(mapping, "stable");
}

describe("saved column matching", () => {
  beforeEach(() => memory.clear());

  it("creates, reads, confirms, updates and deletes an exact saved file shape", async () => {
    const first = envelope(["Date", "Quantity", "SKU", "Stock"], confirmedStableMapping());
    expect(await saveMatching(first)).toBe(true);
    expect(await countSavedMatchings()).toBe(1);

    const reordered = envelope(["SKU", "Date", "Quantity", "Stock"]);
    const loaded = await loadSavedMatching(reordered);
    expect(loaded?.offered).toBe(true);
    expect(loaded?.envelope.session.mapping.mappings.product_code).toMatchObject({
      sourceColumnId: "column-0",
      confirmed: false,
    });
    const confirmed = confirmAllMatches(loaded!.envelope);
    expect(Object.values(confirmed.session.mapping.mappings).every((match) => match?.confirmed)).toBe(true);
    expect(confirmed.session.mapping.identityConfirmed).toBe(true);

    let updatedMapping = confirmedStableMapping();
    updatedMapping = setMapping(updatedMapping, "current_stock", "column-3", true);
    expect(await saveMatching(envelope(["Date", "Quantity", "SKU", "Stock"], updatedMapping))).toBe(true);
    expect(await countSavedMatchings()).toBe(1);
    const updated = await loadSavedMatching(envelope(["Date", "Quantity", "SKU", "Stock"]));
    expect(updated?.envelope.session.mapping.mappings.current_stock).toMatchObject({
      sourceColumnId: "column-3",
      confirmed: false,
    });

    expect(await deleteAllSavedMatchings()).toBe(true);
    expect(await countSavedMatchings()).toBe(0);
    expect(await loadSavedMatching(envelope(["Date", "Quantity", "SKU", "Stock"]))).toBeNull();
  });

  it("leaves every field blank and names differences when any column changes", async () => {
    await saveMatching(envelope(["Date", "Quantity", "SKU"], confirmedStableMapping()));

    const changed = await loadSavedMatching(envelope(["Date", "Units", "SKU", "Notes"]));
    expect(changed?.offered).toBe(false);
    expect(changed?.envelope.session.mapping.mappings).toEqual({});
    expect(changed?.differences).toEqual({
      missingColumns: ["Quantity"],
      newColumns: ["Notes", "Units"],
    });
  });
});
