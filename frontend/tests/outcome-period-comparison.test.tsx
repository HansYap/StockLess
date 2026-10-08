import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OutcomePeriodComparison } from "../src/components/OutcomePeriodComparison.tsx";
import { getSavedDataset } from "../src/storage/saved-datasets.ts";
import { createStockOutcome } from "../src/engine.ts";
import { setLanguage } from "../src/i18n/index.ts";
import { makeEvidence } from "./fixtures.ts";
vi.mock("../src/storage/saved-datasets.ts", async importOriginal => ({ ...await importOriginal<typeof import("../src/storage/saved-datasets.ts")>(), getSavedDataset: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); setLanguage("en"); vi.mocked(getSavedDataset).mockResolvedValue({ decisions: [], outcomes: [] } as never); });
function setPeriods(first = "2026-09-01", second = "2026-09-08") {
  fireEvent.change(screen.getByLabelText("First period start"), { target: { value: first } });
  fireEvent.change(screen.getByLabelText("First period end"), { target: { value: first } });
  fireEvent.change(screen.getByLabelText("Second period start"), { target: { value: second } });
  fireEvent.change(screen.getByLabelText("Second period end"), { target: { value: second } });
}
it("shows no recorded outcomes as No record rather than an observed zero", async () => {
  render(<OutcomePeriodComparison datasetId="dataset-1" currentSnapshot={makeEvidence().snapshot} />);
  await waitFor(() => expect(getSavedDataset).toHaveBeenCalled());
  expect(screen.getAllByText("No record")).toHaveLength(2);
  expect(screen.queryByText("Recorded zero")).toBeNull();
  expect(screen.queryByText(/Recorded waste change:/)).toBeNull();
});
it("compares real recorded zero with observed waste and rejects unequal periods", async () => {
  const records = [createStockOutcome({ id: "a", datasetId: "dataset-1", productKey: "A", kind: "discarded", date: "2026-09-01", quantity: 0, unit: "pieces", referenceDate: "2026-10-08" }),
    createStockOutcome({ id: "b", datasetId: "dataset-1", productKey: "A", kind: "expired", date: "2026-09-08", quantity: 2, unit: "pieces", referenceDate: "2026-10-08" })];
  vi.mocked(getSavedDataset).mockResolvedValue({ decisions: [], outcomes: records.map(stockOutcome => ({ stockOutcome })) } as never);
  render(<OutcomePeriodComparison datasetId="dataset-1" currentSnapshot={makeEvidence().snapshot} />);
  setPeriods();
  await screen.findByText(/Recorded waste change: 2 pieces/);
  expect(screen.getByText(/Recorded zero/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Second period end"), { target: { value: "2026-09-09" } });
  expect(screen.queryByText(/Recorded waste change:/)).toBeNull();
  expect(screen.getAllByText(/same inclusive number of days/).length).toBe(2);
});
it("never compares different recorded units without a known conversion", async () => {
  const records = [createStockOutcome({ id: "a", datasetId: "dataset-1", productKey: "A", kind: "discarded", date: "2026-09-01", quantity: 1, unit: "pieces", referenceDate: "2026-10-08" }),
    createStockOutcome({ id: "b", datasetId: "dataset-1", productKey: "A", kind: "expired", date: "2026-09-08", quantity: 1, unit: "kg", referenceDate: "2026-10-08" })];
  vi.mocked(getSavedDataset).mockResolvedValue({ decisions: [], outcomes: records.map(stockOutcome => ({ stockOutcome })) } as never);
  render(<OutcomePeriodComparison datasetId="dataset-1" currentSnapshot={makeEvidence().snapshot} />); setPeriods();
  await screen.findByText(/periods use different quantity units/);
  expect(screen.queryByText(/Recorded waste change:/)).toBeNull();
});
