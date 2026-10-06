import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ReturningPage } from "../src/screens/ReturningPage.tsx";
import { setLanguage } from "../src/i18n/index.ts";
import type { SavedDatasetSummary } from "../src/storage/saved-datasets.ts";

const storage = vi.hoisted(() => ({ listSavedDatasets: vi.fn(), removeSavedDataset: vi.fn(), clearEverything: vi.fn() }));
vi.mock("../src/storage/saved-datasets.ts", () => storage);
const items: SavedDatasetSummary[] = [
  { id: "recent / file", shopName: "Corner Shop", datasetName: "September sales", sourceName: "sept.csv", rowCount: 482, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-18T00:00:00Z", planCount: 1, decisionCount: 0, outcomeCount: 0, supplierTermCount: 0 },
  { id: "older", shopName: "Market", datasetName: "August sales", sourceName: "aug.csv", rowCount: 1104, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z", planCount: 0, decisionCount: 0, outcomeCount: 0, supplierTermCount: 0 },
];
beforeEach(() => { vi.resetAllMocks(); setLanguage("en"); storage.listSavedDatasets.mockResolvedValue(items); });
afterEach(() => setLanguage("en"));
async function page() { render(<ReturningPage />); await screen.findByRole("link", { name: "Continue" }); }
function rows() { return Array.from(document.querySelectorAll(".returning-row")).map(row => within(row as HTMLElement).getByRole("heading").textContent); }

it("continues the latest real dataset and preserves open, update and upload destinations", async () => {
  await page();
  expect(screen.getByRole("link", { name: "Continue" }).getAttribute("href")).toBe("#dataset/recent%20%2F%20file");
  expect(screen.getByRole("link", { name: "Open September sales" }).getAttribute("href")).toBe("#dataset/recent%20%2F%20file");
  expect(screen.getAllByRole("link", { name: "Update" })[0].getAttribute("href")).toBe("#update/recent%20%2F%20file");
  expect(screen.getByRole("link", { name: "Upload a new file" }).getAttribute("href")).toBe("#workspace");
});
it("filters by file, dataset and shop while keeping the most recent card independent", async () => {
  await page();
  const input = screen.getByRole("searchbox", { name: "Search datasets" });
  fireEvent.change(input, { target: { value: "  AUG.CSV " } });
  expect(rows()).toEqual(["August sales"]);
  expect(screen.getByText("Showing 1 of 2 datasets")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Continue" }).getAttribute("href")).toBe("#dataset/recent%20%2F%20file");
  fireEvent.change(input, { target: { value: "Corner Shop" } });
  expect(rows()).toEqual(["September sales"]);
  fireEvent.change(input, { target: { value: "missing" } });
  expect(screen.getByRole("heading", { name: "No matching datasets" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect(rows()).toHaveLength(2);
  expect(document.activeElement).toBe(input);
});
it("sorts by name and row count and restores recent order", async () => {
  await page();
  const sort = screen.getByRole("combobox", { name: "Sort by" });
  fireEvent.change(sort, { target: { value: "name" } }); expect(rows()).toEqual(["August sales", "September sales"]);
  fireEvent.change(sort, { target: { value: "rows" } }); expect(rows()).toEqual(["August sales", "September sales"]);
  fireEvent.change(sort, { target: { value: "recent" } }); expect(rows()).toEqual(["September sales", "August sales"]);
});
it("requires confirmation before removing one dataset and refreshes the resume card", async () => {
  await page();
  fireEvent.click(screen.getByRole("button", { name: "Delete September sales" }));
  expect(storage.removeSavedDataset).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(storage.removeSavedDataset).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete September sales" }));
  storage.listSavedDatasets.mockResolvedValue([items[1]]);
  fireEvent.click(screen.getByRole("button", { name: "Remove dataset" }));
  await waitFor(() => expect(storage.removeSavedDataset).toHaveBeenCalledWith(items[0].id));
  await waitFor(() => expect(screen.getByRole("link", { name: "Continue" }).getAttribute("href")).toBe("#dataset/older"));
  expect(storage.clearEverything).not.toHaveBeenCalled();
});
it("keeps saved data visible after a failed delete and translates the new controls", async () => {
  await page();
  storage.removeSavedDataset.mockRejectedValue(new Error("storage unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Delete September sales" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove dataset" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(rows()).toHaveLength(2);
  act(() => setLanguage("ms"));
  expect(screen.getByRole("searchbox", { name: "Cari set data" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Teruskan" })).toBeTruthy();
});
it("shows upload and empty states without creating example data", async () => {
  storage.listSavedDatasets.mockResolvedValue([]);
  render(<ReturningPage />);
  await screen.findByRole("heading", { name: "A fresh start" });
  expect(screen.queryByRole("link", { name: "Continue" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Clear Everything" })).toBeNull();
  expect(screen.getAllByRole("link", { name: "Upload a new file" })).toHaveLength(2);
});
