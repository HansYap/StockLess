import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import App from "../src/App.tsx";
import { createEmptySession, readinessEvidenceKey, READINESS_POLICY_VERSION, createMappingState, setMapping, confirmIdentityMode } from "../src/engine.ts";
import { getSavedDataset, listSavedDatasets, replaceSavedDataset, saveDatasetWork, createSavedDataset, summarizeSavedDataset, type SavedDataset } from "../src/storage/saved-datasets.ts";
import { runReadinessCheckInWorker } from "../src/workers/readiness-client.ts";
import { runDemandForecastInWorker } from "../src/workers/forecast-client.ts";
import { makeEvidence } from "./fixtures.ts";

vi.mock("../src/storage/saved-datasets.ts", async original => ({
  ...await original<object>(), getSavedDataset: vi.fn(), listSavedDatasets: vi.fn(),
  replaceSavedDataset: vi.fn(), saveDatasetWork: vi.fn(), createSavedDataset: vi.fn(), findSavedDataset: vi.fn(async () => undefined),
}));
vi.mock("../src/engine.ts", async original => ({ ...await original<object>(), proposeMappings: vi.fn(async () => ({ proposals: [] })) }));
vi.mock("../src/workers/semantic-client.ts", () => ({ createLocalSemanticScorer: () => undefined }));
vi.mock("../src/workers/import-session-client.ts", () => ({ replaceSessionSourceInWorker: vi.fn(async () => importedEnvelope()) }));
vi.mock("../src/workers/readiness-client.ts", () => ({ runReadinessCheckInWorker: vi.fn(async () => evidence().snapshot) }));
vi.mock("../src/workers/forecast-client.ts", () => ({ runDemandForecastInWorker: vi.fn(async () => evidence().forecast) }));
vi.mock("../src/screens/UploadScreen.tsx", async original => {
  const { UploadScreen } = await original<typeof import("../src/screens/UploadScreen.tsx")>();
  return { UploadScreen: (props: ComponentProps<typeof UploadScreen>) => <>
    <UploadScreen {...props} />
    <button onClick={() => void props.onSource(new Uint8Array(), "replacement.csv", "user", "text/csv", () => {}, new AbortController().signal)}>Import test replacement</button>
    <button onClick={props.onCancel}>Cancel test import</button>
  </> };
});
vi.mock("../src/screens/MappingScreen.tsx", () => ({ MappingScreen: (props: ComponentProps<typeof import("../src/screens/MappingScreen.tsx").MappingScreen>) => <>
  <h1>Test mapping</h1><button onClick={props.onBack}>Back to test upload</button>
  <button onClick={props.onConfirmAllAndContinue}>Check test readiness</button>{props.children}
</> }));
vi.mock("../src/screens/ReadinessScreen.tsx", () => ({ ReadinessScreen: (props: ComponentProps<typeof import("../src/screens/ReadinessScreen.tsx").ReadinessScreen>) => <>
  <h1>Test readiness</h1><button onClick={props.onContinue}>Calculate test plan</button><button onClick={props.onBack}>Back to test mapping</button>
</> }));
vi.mock("../src/screens/PurchasePlanScreen.tsx", () => ({ PurchasePlanScreen: (props: ComponentProps<typeof import("../src/screens/PurchasePlanScreen.tsx").PurchasePlanScreen>) => <>
  <h1>Saved purchase plan</h1><button onClick={props.onBack}>Back to test readiness</button>
  <span data-testid="restored-drafts">{JSON.stringify(props.drafts)}</span><span data-testid="restored-suppliers">{JSON.stringify(props.supplierDrafts)}</span>
</> }));
vi.mock("../src/screens/ImpactDashboard.tsx", () => ({ ImpactDashboard: () => <h1>Saved impact dashboard</h1> }));

function importedEnvelope() {
  const empty = createEmptySession();
  let mapping = createMappingState();
  mapping = setMapping(mapping, "transaction_date", "date", true);
  mapping = setMapping(mapping, "quantity_sold", "quantity", true);
  mapping = setMapping(mapping, "product_code", "sku", true);
  return { ...empty, session: { ...empty.session, mapping: confirmIdentityMode(mapping, "stable"), sourceMode: "user" as const, dataset: {
    sourceMode: "user" as const, sourceName: "sales.csv", sourceSha256: "hash", sourceByteLength: 0,
    delimiter: "," as const, columns: [], rows: [], normalizations: [],
  } } };
}
function evidence() {
  const result = makeEvidence();
  return { ...result, snapshot: { ...result.snapshot, sourceSha256: "hash", policyVersion: READINESS_POLICY_VERSION, evidenceKey: readinessEvidenceKey(importedEnvelope().session.dataset!, importedEnvelope().session.mapping, { analysisDate: result.snapshot.analysisDate }) } };
}
let saved: SavedDataset;
beforeEach(() => {
  vi.clearAllMocks();
  const result = evidence();
  saved = { id: "existing", shopName: "Corner Shop", datasetName: "September sales", shopKey: "corner shop", nameKey: "september sales",
    createdAt: "2026-09-01", updatedAt: "2026-09-20", envelope: importedEnvelope(), analysisDate: "2026-09-14", dateConfirmations: [],
    readiness: result.snapshot, forecast: result.forecast,
    purchaseDrafts: {}, supplierTerms: {}, decisions: [], outcomes: [],
  };
  vi.mocked(getSavedDataset).mockImplementation(async id => id === saved.id ? saved : undefined);
  vi.mocked(listSavedDatasets).mockImplementation(async () => [summarizeSavedDataset(saved)]);
  vi.mocked(replaceSavedDataset).mockResolvedValue(saved);
  vi.mocked(saveDatasetWork).mockImplementation(async (_id, work) => { saved = { ...saved, ...work }; return saved; });
  vi.mocked(createSavedDataset).mockImplementation(async (shopName, datasetName, envelope, analysisDate) => {
    saved = { ...saved, id: "new", shopName, datasetName, envelope, analysisDate, readiness: null, forecast: null };
    return saved;
  });
});
afterEach(() => vi.restoreAllMocks());
async function updatePage() {
  render(<App updateDatasetId="existing" />);
  await screen.findByRole("heading", { name: "Reupload your sales file" });
  return screen.getByRole("complementary", { name: "Workspace navigation" });
}
it("adds saved-dataset navigation and graphics to reupload, without saved management or sample replacement", async () => {
  const sidebar = await updatePage();
  expect(within(sidebar).getByText("September sales")).toBeTruthy();
  expect(within(sidebar).getByText("Corner Shop")).toBeTruthy();
  expect(within(sidebar).getByRole("button", { name: "Reupload" }).getAttribute("aria-current")).toBe("page");
  expect(within(sidebar).getByRole("link", { name: "Switch dataset" }).getAttribute("href")).toBe("#returning");
  expect(screen.queryByText("Manage saved information")).toBeNull();
  expect(screen.queryByRole("button", { name: "Use sample file" })).toBeNull();
  expect(within(screen.getByRole("navigation", { name: "Progress" })).getAllByRole("listitem")).toHaveLength(3);
  expect(document.querySelectorAll(".saved-workspace__content .ws-decor img")).toHaveLength(2);
});
it("keeps new uploads without a sidebar even when this device has saved datasets", async () => {
  render(<App />);
  await screen.findByText("Manage saved information");
  expect(screen.getByRole("heading", { name: "Upload your sales file" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Use sample file" })).toBeTruthy();
  expect(screen.queryByRole("complementary", { name: "Workspace navigation" })).toBeNull();
});
it.each([ ["Purchase plan", "Saved purchase plan"], ["Impact dashboard", "Saved impact dashboard"] ])("%s restores the selected dataset's saved work", async (button, heading) => {
  const sidebar = await updatePage();
  fireEvent.click(within(sidebar).getByRole("button", { name: button }));
  await screen.findByRole("heading", { name: heading });
  expect(replaceSavedDataset).not.toHaveBeenCalled();
});
it("retains the update target when import or replacement is cancelled, and replaces that same dataset on retry", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  await updatePage();
  fireEvent.click(screen.getByText("Cancel test import"));
  expect(screen.getByRole("heading", { name: "Reupload your sales file" })).toBeTruthy();
  fireEvent.click(screen.getByText("Import test replacement"));
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  expect(replaceSavedDataset).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByText("Import test replacement"));
  await screen.findByRole("heading", { name: "Test mapping" });
  expect(replaceSavedDataset).toHaveBeenCalledOnce();
  expect(vi.mocked(replaceSavedDataset).mock.calls[0][0]).toBe("existing");
  fireEvent.click(screen.getByText("Back to test upload"));
  await screen.findByRole("heading", { name: "Reupload your sales file" });
  expect(screen.queryByLabelText("Active session")).toBeNull();
});
it("opens preparation instead of an empty plan when saved evidence is incomplete", async () => {
  saved = { ...saved, envelope: { ...saved.envelope, session: { ...saved.envelope.session, mapping: createMappingState() } }, readiness: null, forecast: null };
  const sidebar = await updatePage();
  fireEvent.click(within(sidebar).getByRole("button", { name: "Purchase plan" }));
  await screen.findByRole("heading", { name: "Test mapping" });
  expect(screen.queryByRole("heading", { name: "Saved purchase plan" })).toBeNull();
});

function sidebar() { return screen.getByRole("complementary", { name: "Workspace navigation" }); }
function noSidebar() { expect(screen.queryByRole("complementary", { name: "Workspace navigation" })).toBeNull(); }

it("keeps a newly saved dataset without a sidebar until all three preparation steps are complete", async () => {
  render(<App />);
  fireEvent.click(screen.getByText("Import test replacement"));
  await screen.findByRole("heading", { name: "Test mapping" });
  noSidebar();
  fireEvent.change(screen.getByRole("combobox", { name: "Shop name" }), { target: { value: "New shop" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Dataset name" }), { target: { value: "New sales" } });
  fireEvent.click(screen.getByRole("button", { name: "Save dataset", exact: true }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Save dataset", exact: true })).toBeNull());
  noSidebar();
  fireEvent.click(screen.getByText("Check test readiness"));
  await screen.findByRole("heading", { name: "Test readiness" });
  noSidebar();
  fireEvent.click(screen.getByText("Calculate test plan"));
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(within(sidebar()).getByText("New sales")).toBeTruthy();
  expect(within(sidebar()).getByRole("button", { name: "Purchase plan" }).getAttribute("aria-current")).toBe("page");
  expect(screen.queryByRole("navigation", { name: "Progress" })).toBeNull();
  expect(window.location.hash).toBe("#dataset/new");
  expect(saveDatasetWork).toHaveBeenCalledWith("new", expect.objectContaining({ forecast: expect.objectContaining({ snapshotId: "snapshot-test" }) }));
  fireEvent.click(screen.getByText("Back to test readiness"));
  await screen.findByRole("heading", { name: "Test readiness" });
  expect(sidebar()).toBeTruthy();
});

it("retains the sidebar through replacement mapping and readiness", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await updatePage();
  fireEvent.click(screen.getByText("Import test replacement"));
  await screen.findByRole("heading", { name: "Test mapping" });
  expect(within(sidebar()).getByText("September sales")).toBeTruthy();
  fireEvent.click(screen.getByText("Check test readiness"));
  await screen.findByRole("heading", { name: "Test readiness" });
  expect(within(sidebar()).getByRole("button", { name: "Reupload" }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(screen.getByText("Calculate test plan"));
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(sidebar()).toBeTruthy();
});

it("opens returning users directly into their saved plan and preserves drafts without recalculating", async () => {
  saved = { ...saved, purchaseDrafts: { A: { plannedOrder: { state: "value", value: 20, source: "input by you" }, incomingStock: { state: "empty" } } }, supplierOrderDrafts: { A: { caseSize: 6 } } };
  render(<App initialDatasetId="existing" />);
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(screen.getByTestId("restored-drafts").textContent).toContain('"value":20');
  expect(screen.getByTestId("restored-suppliers").textContent).toContain('"caseSize":6');
  expect(runReadinessCheckInWorker).not.toHaveBeenCalled();
  expect(runDemandForecastInWorker).not.toHaveBeenCalled();
  fireEvent.click(within(sidebar()).getByRole("button", { name: "Impact dashboard" }));
  await screen.findByRole("heading", { name: "Saved impact dashboard" });
  expect(within(sidebar()).getByRole("button", { name: "Impact dashboard" }).getAttribute("aria-current")).toBe("page");
  expect(runDemandForecastInWorker).not.toHaveBeenCalled();
});

it("keeps reupload and results destinations when the page is refreshed", async () => {
  render(<App initialDatasetId="existing" />);
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(window.location.hash).toBe("#dataset/existing");
  fireEvent.click(within(sidebar()).getByRole("button", { name: "Reupload" }));
  await screen.findByRole("heading", { name: "Reupload your sales file" });
  expect(window.location.hash).toBe("#update/existing");
  fireEvent.click(within(sidebar()).getByRole("button", { name: "Purchase plan" }));
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(window.location.hash).toBe("#dataset/existing");
});

it("starts the sidebar flow when update is selected from saved information management", async () => {
  render(<App />);
  await screen.findByText("Manage saved information");
  fireEvent.click(screen.getByText("Manage saved information"));
  fireEvent.click(screen.getByRole("button", { name: "Update with a file" }));
  await screen.findByRole("heading", { name: "Reupload your sales file" });
  expect(sidebar()).toBeTruthy();
});

it.each(["missing", "old policy", "different file"])("refreshes %s evidence before displaying a returning purchase plan", async kind => {
  saved = { ...saved, readiness: kind === "missing" ? null : { ...saved.readiness!,
    policyVersion: kind === "old policy" ? "old" : READINESS_POLICY_VERSION,
    sourceSha256: kind === "different file" ? "another-file" : "hash",
  } };
  render(<App initialDatasetId="existing" />);
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(runReadinessCheckInWorker).toHaveBeenCalledOnce();
  expect(runDemandForecastInWorker).toHaveBeenCalledOnce();
  expect(saveDatasetWork).toHaveBeenCalledWith("existing", expect.objectContaining({ readiness: evidence().snapshot, forecast: evidence().forecast }));
});

it("refreshes a mismatched forecast without repeating the valid readiness check", async () => {
  saved = { ...saved, forecast: { ...saved.forecast!, snapshotId: "different-snapshot" } };
  render(<App initialDatasetId="existing" />);
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(runReadinessCheckInWorker).not.toHaveBeenCalled();
  expect(runDemandForecastInWorker).toHaveBeenCalledOnce();
});

it("offers saving on an unsaved purchase plan and stores the already calculated results", async () => {
  render(<App />);
  fireEvent.click(screen.getByText("Import test replacement"));
  fireEvent.click(await screen.findByText("Check test readiness"));
  fireEvent.click(await screen.findByText("Calculate test plan"));
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(within(sidebar()).getByText(/This session only/)).toBeTruthy();
  expect(screen.getByText("Save this dataset to reopen this purchase plan and its results on your next visit.")).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Shop name" }), { target: { value: "New shop" } });
  fireEvent.click(screen.getByRole("button", { name: "Save dataset", exact: true }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Save dataset", exact: true })).toBeNull());
  expect(saveDatasetWork).toHaveBeenCalledWith("new", expect.objectContaining({ readiness: evidence().snapshot, forecast: evidence().forecast }));
});

it("keeps an unsaved plan available when a reupload is cancelled", async () => {
  render(<App />);
  fireEvent.click(screen.getByText("Import test replacement"));
  fireEvent.click(await screen.findByText("Check test readiness"));
  fireEvent.click(await screen.findByText("Calculate test plan"));
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  fireEvent.click(within(sidebar()).getByRole("button", { name: "Reupload" }));
  await screen.findByRole("heading", { name: "Reupload your sales file" });
  fireEvent.click(screen.getByText("Cancel test import"));
  fireEvent.click(within(sidebar()).getByRole("button", { name: "Purchase plan" }));
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(runDemandForecastInWorker).toHaveBeenCalledOnce();
  expect(sidebar()).toBeTruthy();
});
