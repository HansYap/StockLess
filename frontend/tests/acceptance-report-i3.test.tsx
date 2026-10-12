import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../src/App.tsx";
import { ReadinessScreen } from "../src/screens/ReadinessScreen.tsx";
import { PurchasePlanScreen } from "../src/screens/PurchasePlanScreen.tsx";
import { PurchaseCheckCard } from "../src/purchase-plan/PurchaseCheckCard.tsx";
import { StorageExplanation } from "../src/components/StorageExplanation.tsx";
import { createMappingState, type ParsedDataset } from "../src/engine.ts";
import { listSavedDatasets, getSavedDataset } from "../src/storage/saved-datasets.ts";
import { setLanguage } from "../src/i18n/index.ts";
import { makeEvidence } from "./fixtures.ts";

vi.mock("../src/storage/saved-datasets.ts", async importOriginal => ({
  ...await importOriginal<object>(), listSavedDatasets: vi.fn(), getSavedDataset: vi.fn(),
}));

beforeEach(() => {
  setLanguage("en");
  vi.mocked(listSavedDatasets).mockReset().mockResolvedValue([]);
  vi.mocked(getSavedDataset).mockReset().mockResolvedValue(undefined);
  window.location.hash = "#workspace";
  window.scrollTo = vi.fn();
});

it("explains no usable records and offers matching while blocking analysis", () => {
  const { snapshot } = makeEvidence();
  const empty = { ...snapshot, rows: snapshot.rows.map(row => ({ ...row, useState: "excluded" as const })), reconciliation: { ...snapshot.reconciliation, rowsUsed: 0, rowsExcluded: snapshot.rows.length } };
  const dataset: ParsedDataset = { sourceName: "book.xlsx", worksheetName: "Sales Oct", sourceMode: "user", sourceSha256: "test", sourceByteLength: 1, delimiter: ",", columns: [], rows: [], normalizations: [] };
  const onBack = vi.fn(), onContinue = vi.fn();
  render(<ReadinessScreen dataset={dataset} mapping={createMappingState()} snapshot={empty} dateConfirmations={[]} checking={false} error={null} forecasting={false} forecastError={null} filter={null} onFilter={() => {}} onConfirmDateFormat={() => {}} onBack={onBack} onContinue={onContinue} reportFilename="problems.csv" />);
  expect(screen.getByRole("alert").textContent).toContain("no product has usable sales records");
  expect(screen.queryByText(/You can continue with usable rows/)).toBeNull();
  expect((screen.getByRole("button", { name: /Continue to purchase planning/ }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "← Back to matching" }));
  expect(onBack).toHaveBeenCalledOnce();
  expect(onContinue).not.toHaveBeenCalled();
  expect(screen.getByText("Worksheet: Sales Oct")).toBeTruthy();
});

it("keeps the chosen worksheet visible in purchase planning", () => {
  const { snapshot, forecast } = makeEvidence();
  render(<PurchasePlanScreen snapshot={{ ...snapshot, worksheetName: "Sales Oct" }} forecast={forecast} drafts={{}} selectedKey={null} onSelect={() => {}} onDraftChange={() => {}} onBack={() => {}} />);
  expect(screen.getByText(/Worksheet: Sales Oct/)).toBeTruthy();
});

it("labels every value in purchase-check working with its actual source", () => {
  const props = { stock: 10, atRisk: 4, incoming: 5, order: 34, low: 34, high: 46, target: 40, suggested: 29, expiryUsed: true, incomingEntered: true, orderEntered: true, adjustment: { before: 25, after: 29 } };
  const view = render(<PurchaseCheckCard {...props} incomingSource="from your file" orderSource="input by you" />);
  const rows = document.querySelectorAll(".pp-work-row");
  expect(rows[0].textContent).toContain("from your file");
  expect(rows[1].textContent).toContain("worked out by StockLess");
  expect(rows[2].textContent).toContain("from your file");
  expect(rows[3].textContent).toContain("input by you");
  expect(rows[4].textContent).toContain("worked out by StockLess");
  for (const row of document.querySelectorAll(".pp-work-notes p")) expect(row.textContent).toContain("worked out by StockLess");
  view.rerender(<PurchaseCheckCard {...props} incomingSource="input by you" orderSource="worked out by StockLess" />);
  expect(document.querySelectorAll(".pp-work-row")[2].textContent).toContain("input by you");
  expect(document.querySelectorAll(".pp-work-row")[3].textContent).toContain("worked out by StockLess");
});

it("retries loading upload history after an initial browser-storage error", async () => {
  vi.mocked(listSavedDatasets).mockRejectedValueOnce(new Error("Storage unavailable"));
  render(<App />);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Saved work failed to load");
  fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  await vi.waitFor(() => expect(listSavedDatasets).toHaveBeenCalledTimes(2));
  expect(screen.queryByText(/Saved work failed to load/)).toBeNull();
});

it("retries opening the selected saved dataset as well as checking history", async () => {
  vi.mocked(getSavedDataset).mockRejectedValueOnce(new Error("Storage unavailable"));
  render(<App initialDatasetId="saved-id" />);
  const alert = await screen.findByRole("alert");
  fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  await vi.waitFor(() => expect(getSavedDataset).toHaveBeenCalledTimes(2));
  expect(getSavedDataset).toHaveBeenLastCalledWith("saved-id");
});

it("explains single and total deletion and the separate clear-session action", () => {
  render(<StorageExplanation onManage={() => {}} />);
  expect(screen.getByText(/use Delete beside an upload/).textContent).toContain("Clear Everything");
  expect(screen.getByText(/Clear session clears only/).textContent).toContain("does not delete saved uploads");
  expect(screen.queryByText(/outcomes you record/)).toBeNull();
  expect(screen.queryByText(/Decisions:/)).toBeNull();
});
