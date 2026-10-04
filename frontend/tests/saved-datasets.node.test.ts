import assert from "node:assert/strict";
import { test } from "node:test";
import { replaceDatasetContents, summarizeSavedDataset, type SavedDataset } from "../src/storage/saved-datasets.ts";
import type { DemandForecastReview, ReadinessSnapshot, SessionEnvelope } from "../src/engine.ts";

function envelope(sourceName: string, values: readonly string[]): SessionEnvelope {
  return {
    preferences: {},
    session: {
      id: sourceName, createdAt: "2026-01-01T00:00:00Z",
      sourceMode: "user", identityEvidence: [],
      mapping: { mappings: {}, identityConfirmed: false },
      dataset: {
        sourceMode: "user", sourceName, sourceByteLength: 1, sourceSha256: sourceName,
        delimiter: ",", columns: [], normalizations: [],
        rows: values.map((value, index) => ({
          sourceRow: index + 2, originalValues: [value], normalizedValues: [value],
        })),
      },
    },
  };
}

test("replacement uses the new file once and preserves dated decision evidence and outcomes", () => {
  const original = envelope("old.csv", ["A", "B"]);
  const decision = {
    id: "decision-1", recordedAt: "2026-01-03T00:00:00Z",
    recommendation: { analysisDate: "2026-01-02", sourceSha256: "old.csv", products: [] },
  };
  const saved: SavedDataset = {
    id: "dataset-1", shopName: "Aina's shop", datasetName: "Sales",
    shopKey: "aina's shop", nameKey: "sales", createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-03T00:00:00Z", envelope: original,
    analysisDate: "2026-01-02", dateConfirmations: [], duplicateDecisions: {},
    readiness: { id: "old-snapshot" } as ReadinessSnapshot,
    forecast: { snapshotId: "old-snapshot" } as DemandForecastReview,
    purchaseDrafts: {}, supplierTerms: { Vendor: "7 days" },
    decisions: [decision], outcomes: [{ id: "outcome-1", recordedAt: "2026-01-04T00:00:00Z", decisionId: decision.id, details: { sold: 10 } }],
  };
  const replacement = envelope("new.csv", ["A", "B", "C"]);
  const updated = replaceDatasetContents(saved, replacement, "2026-01-05T00:00:00Z");

  assert.equal(updated.envelope.session.dataset?.rows.length, 3);
  assert.equal(updated.envelope.session.dataset?.sourceName, "new.csv");
  assert.equal(updated.readiness, null);
  assert.equal(updated.forecast, null);
  assert.deepEqual(updated.decisions, [decision]);
  assert.deepEqual(updated.outcomes, saved.outcomes);
  assert.deepEqual(updated.supplierTerms, { Vendor: "7 days" });
  assert.equal(updated.decisions[0].recommendation.analysisDate, "2026-01-02");
  assert.equal(saved.envelope.session.dataset?.sourceName, "old.csv");
  assert.equal(summarizeSavedDataset(updated).rowCount, 3);
});
