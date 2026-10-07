import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import App from "../src/App.tsx";
import { createEmptySession, readinessEvidenceKey, READINESS_POLICY_VERSION, createMappingState, setMapping, confirmIdentityMode } from "../src/engine.ts";
import { getSavedDataset, listSavedDatasets, saveGeneratedPurchasePlan, replaceSavedDataset, saveDatasetWork, createSavedDataset, summarizeSavedDataset, type SavedDataset } from "../src/storage/saved-datasets.ts";
import { runReadinessCheckInWorker } from "../src/workers/readiness-client.ts";
import { runDemandForecastInWorker } from "../src/workers/forecast-client.ts";
import { makeEvidence } from "./fixtures.ts";
import { replaceSessionSourceInWorker } from "../src/workers/import-session-client.ts";

vi.mock("../src/storage/saved-datasets.ts", async original => ({
  ...await original<object>(), getSavedDataset: vi.fn(), listSavedDatasets: vi.fn(),
  saveGeneratedPurchasePlan: vi.fn(), replaceSavedDataset: vi.fn(), saveDatasetWork: vi.fn(), createSavedDataset: vi.fn(), findSavedDataset: vi.fn(async () => undefined),
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
    <button onClick={() => void props.onSource(new Uint8Array(), "sample.csv", "sample", "text/csv", () => {}, new AbortController().signal)}>Import test sample</button>
  </> };
});
vi.mock("../src/screens/MappingScreen.tsx", () => ({ MappingScreen: (props: ComponentProps<typeof import("../src/screens/MappingScreen.tsx").MappingScreen>) => <>
  <h1>Test mapping</h1><button onClick={props.onBack}>Back to test upload</button>
  <button onClick={props.onClear}>Clear session</button>
  <button onClick={props.onConfirmAllAndContinue}>Check test readiness</button>{props.children}
</> }));
vi.mock("../src/screens/ReadinessScreen.tsx", () => ({ ReadinessScreen: (props: ComponentProps<typeof import("../src/screens/ReadinessScreen.tsx").ReadinessScreen>) => <>
  <h1>Test readiness</h1><button onClick={props.onContinue}>Calculate test plan</button><button onClick={props.onBack}>Back to test mapping</button>
  <button onClick={props.onClear}>Clear session</button>
</> }));
vi.mock("../src/screens/PurchasePlanScreen.tsx", () => ({ PurchasePlanScreen: (props: ComponentProps<typeof import("../src/screens/PurchasePlanScreen.tsx").PurchasePlanScreen>) => <>
  <h1>Saved purchase plan</h1><button onClick={props.onBack}>Back to test readiness</button>
  <button onClick={() => props.onDraftChange("A", { plannedOrder: { state: "value", value: 20, source: "input by you" }, incomingStock: { state: "empty" } })}>Edit test order</button>
  <button onClick={() => props.onSupplierChange?.("A", { caseSize: 6 })}>Edit test supplier</button>
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
  localStorage.removeItem("stockless.hasUploaded");
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
  vi.mocked(runReadinessCheckInWorker).mockImplementation(async (dataset, mapping, options) => ({
    ...evidence().snapshot, analysisDate: options.analysisDate,
    evidenceKey: readinessEvidenceKey(dataset, mapping, options),
  }));
  vi.mocked(runDemandForecastInWorker).mockImplementation(async snapshot => ({ ...evidence().forecast, snapshotId: snapshot.id, analysisDate: snapshot.analysisDate }));
  vi.mocked(saveGeneratedPurchasePlan).mockImplementation(async (work, plan, id) => {
    const latest = (await listSavedDatasets())[0];
    saved = { ...saved, ...work, id: id ?? latest?.id ?? "new", datasetName: work.envelope.session.dataset!.sourceName.replace(/\.[^.]+$/, ""), decisions: [...saved.decisions, plan] };
    return saved;
  });
  vi.mocked(saveDatasetWork).mockImplementation(async (_id, work) => { saved = { ...saved, ...work }; return saved; });
  vi.mocked(createSavedDataset).mockImplementation(async (shopName, datasetName, envelope, analysisDate) => {
    saved = { ...saved, id: "new", shopName, datasetName, envelope, analysisDate, readiness: null, forecast: null };
    return saved;
  });
});
afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem("stockless.hasUploaded"); });
it("Guide preparation keeps the sidebar hidden and leaves the saved plan untouched until a real replacement plan is generated", async () => {
  const before = structuredClone(saved);
  render(<App guidedImport guideReturnId="existing" />);
  await screen.findByRole("heading", { name: "Upload your sales file" });
  expect(screen.queryByRole("complementary", { name: "Workspace navigation" })).toBeNull();
  expect(screen.getByRole("button", { name: "Back to my plan" })).toBeTruthy();
  fireEvent.click(screen.getByText("Import test replacement"));
  await screen.findByRole("heading", { name: "Test mapping" });
  expect(screen.queryByRole("complementary", { name: "Workspace navigation" })).toBeNull();
  expect(saved).toEqual(before);
  expect(saveGeneratedPurchasePlan).not.toHaveBeenCalled();
  expect(saveDatasetWork).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Check test readiness"));
  await screen.findByRole("heading", { name: "Test readiness" });
  expect(screen.queryByRole("complementary", { name: "Workspace navigation" })).toBeNull();
  expect(saved).toEqual(before);
  fireEvent.click(screen.getByText("Calculate test plan"));
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(saveGeneratedPurchasePlan).toHaveBeenCalledWith(expect.anything(), expect.anything(), "existing", true);
});

it("sample practice never replaces or autosaves a returning user's plan and retains a route back", async () => {
  const before = structuredClone(saved);
  vi.mocked(replaceSessionSourceInWorker).mockImplementationOnce(async () => {
    const envelope = importedEnvelope();
    return { ...envelope, session: { ...envelope.session, sourceMode: "sample", dataset: { ...envelope.session.dataset!, sourceMode: "sample" } } };
  });
  render(<App guidedImport guideReturnId="existing" />);
  await screen.findByRole("heading", { name: "Upload your sales file" });
  fireEvent.click(screen.getByText("Import test sample"));
  await screen.findByRole("heading", { name: "Test mapping" });
  expect(screen.getByText("This sample is for practice. It won’t replace your plan or enter upload history.")).toBeTruthy();
  fireEvent.click(screen.getByText("Check test readiness"));
  await screen.findByRole("heading", { name: "Test readiness" });
  fireEvent.click(screen.getByText("Calculate test plan"));
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(saved).toEqual(before);
  expect(saveGeneratedPurchasePlan).not.toHaveBeenCalled();
  expect(saveDatasetWork).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Back to my plan" }));
  expect(window.location.hash).toBe("#dataset/existing");
});

it("clearing a guided import keeps preparation without the sidebar and preserves saved history", async () => {
  const before = structuredClone(saved);
  render(<App guidedImport guideReturnId="existing" />);
  await screen.findByRole("heading", { name: "Upload your sales file" });
  fireEvent.click(screen.getByText("Import test replacement"));
  await screen.findByRole("heading", { name: "Test mapping" });
  fireEvent.click(screen.getByRole("button", { name: "Clear session" }));
  await screen.findByRole("heading", { name: "Upload your sales file" });
  expect(screen.queryByRole("complementary", { name: "Workspace navigation" })).toBeNull();
  expect(saved).toEqual(before);
  expect(saveGeneratedPurchasePlan).not.toHaveBeenCalled();
  expect(saveDatasetWork).not.toHaveBeenCalled();
});
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
  expect(within(sidebar).getByRole("link", { name: "Upload history" }).getAttribute("href")).toBe("#history");
  expect(screen.queryByText("Manage saved information")).toBeNull();
  expect(screen.queryByRole("button", { name: "Use sample file" })).toBeNull();
  expect(within(screen.getByRole("navigation", { name: "Progress" })).getAllByRole("listitem")).toHaveLength(3);
  expect(document.querySelectorAll(".saved-workspace__content .ws-decor img")).toHaveLength(2);
});
it("keeps the fresh upload screen without a sidebar when there is no saved history", async () => {
  vi.mocked(listSavedDatasets).mockResolvedValue([]);
  render(<App />);
  await screen.findByRole("heading", { name: "Upload your sales file" });
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
it("keeps the saved file intact during preparation and commits a replacement without a save confirmation", async () => {
  const confirm = vi.spyOn(window, "confirm");
  await updatePage();
  fireEvent.click(screen.getByText("Cancel test import"));
  expect(screen.getByRole("heading", { name: "Reupload your sales file" })).toBeTruthy();
  fireEvent.click(screen.getByText("Import test replacement"));
  await screen.findByRole("heading", { name: "Test mapping" });
  expect(saveGeneratedPurchasePlan).not.toHaveBeenCalled();
  expect(replaceSavedDataset).not.toHaveBeenCalled();
  expect(saved.datasetName).toBe("September sales");
  fireEvent.click(screen.getByText("Check test readiness"));
  fireEvent.click(await screen.findByText("Calculate test plan"));
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(saveGeneratedPurchasePlan).toHaveBeenCalledWith(expect.objectContaining({ readiness: expect.any(Object), forecast: expect.any(Object) }), expect.any(Object), "existing", true);
  expect(confirm).not.toHaveBeenCalled();
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

it("automatically saves only after all three preparation steps, without asking for shop or upload names", async () => {
  vi.mocked(listSavedDatasets).mockResolvedValue([]);
  render(<App />);
  fireEvent.click(screen.getByText("Import test replacement"));
  await screen.findByRole("heading", { name: "Test mapping" });
  noSidebar();
  expect(saveGeneratedPurchasePlan).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Save/ })).toBeNull();
  expect(screen.queryByLabelText("Shop name")).toBeNull();
  fireEvent.click(screen.getByText("Check test readiness"));
  await screen.findByRole("heading", { name: "Test readiness" });
  noSidebar();
  expect(saveGeneratedPurchasePlan).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Calculate test plan"));
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(within(sidebar()).getByText("sales")).toBeTruthy();
  expect(within(sidebar()).getByRole("button", { name: "Purchase plan" }).getAttribute("aria-current")).toBe("page");
  expect(window.location.hash).toBe("#dataset/new");
  expect(saveGeneratedPurchasePlan).toHaveBeenCalledOnce();
  expect(saveGeneratedPurchasePlan).toHaveBeenCalledWith(expect.objectContaining({ readiness: expect.any(Object), forecast: expect.objectContaining({ snapshotId: "snapshot-test" }) }), expect.objectContaining({ note: expect.stringContaining("Generated purchase plan") }), undefined, true);
  expect(screen.queryByRole("button", { name: /Save/ })).toBeNull();
  expect(screen.getByText("Saved automatically on this device")).toBeTruthy();
  fireEvent.click(screen.getByText("Back to test readiness"));
  fireEvent.click(await screen.findByText("Calculate test plan"));
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(saveGeneratedPurchasePlan).toHaveBeenCalledOnce();
  expect(runDemandForecastInWorker).toHaveBeenCalledOnce();
});

it("retains the sidebar through replacement mapping and readiness", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await updatePage();
  fireEvent.click(screen.getByText("Import test replacement"));
  await screen.findByRole("heading", { name: "Test mapping" });
  expect(within(sidebar()).getByText("sales")).toBeTruthy();
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

it.each(["mapping", "readiness"])("Clear session from %s returns to upload with its sidebar and keeps saved work", async stage => {
  await updatePage();
  fireEvent.click(screen.getByText("Import test replacement"));
  await screen.findByRole("heading", { name: "Test mapping" });
  if (stage === "readiness") {
    fireEvent.click(screen.getByText("Check test readiness"));
    await screen.findByRole("heading", { name: "Test readiness" });
  }
  fireEvent.click(screen.getByRole("button", { name: "Clear session" }));
  await screen.findByRole("heading", { name: "Reupload your sales file" });
  expect(sidebar()).toBeTruthy();
  expect(window.location.hash).toBe("#update/existing");
  expect(saveGeneratedPurchasePlan).not.toHaveBeenCalled();
  fireEvent.click(within(sidebar()).getByRole("button", { name: "Purchase plan" }));
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(runDemandForecastInWorker).not.toHaveBeenCalled();
});

it("retains a sidebar when the first uploaded file is cleared before a plan is generated", async () => {
  vi.mocked(listSavedDatasets).mockResolvedValue([]);
  render(<App />);
  fireEvent.click(screen.getByText("Import test replacement"));
  await screen.findByRole("heading", { name: "Test mapping" });
  fireEvent.click(screen.getByRole("button", { name: "Clear session" }));
  await screen.findByRole("heading", { name: "Reupload your sales file" });
  expect(sidebar()).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Test mapping" })).toBeNull();
  expect(saveGeneratedPurchasePlan).not.toHaveBeenCalled();
  expect(window.location.hash).toBe("#workspace");
});

it("opens Upload with a sidebar when saved history already exists", async () => {
  render(<App />);
  await screen.findByRole("heading", { name: "Reupload your sales file" });
  expect(sidebar()).toBeTruthy();
  expect(window.location.hash).toBe("#update/existing");
});

it("keeps returning Upload with a sidebar after the last history item is removed", async () => {
  localStorage.setItem("stockless.hasUploaded", "true");
  vi.mocked(listSavedDatasets).mockResolvedValue([]);
  render(<App />);
  await screen.findByRole("heading", { name: "Reupload your sales file" });
  expect(sidebar()).toBeTruthy();
});

it("offers upload history through the sidebar without the old dataset picker", async () => {
  render(<App initialDatasetId="existing" />);
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(within(sidebar()).getByRole("link", { name: "Upload history" }).getAttribute("href")).toBe("#history");
  expect(screen.queryByText("Manage saved information")).toBeNull();
});

it("automatically replaces the current upload when a plan is generated, rather than adding another store", async () => {
  render(<App />);
  fireEvent.click(screen.getByText("Import test replacement"));
  fireEvent.click(await screen.findByText("Check test readiness"));
  fireEvent.click(await screen.findByText("Calculate test plan"));
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(saveGeneratedPurchasePlan).toHaveBeenCalledOnce();
  expect(window.location.hash).toBe("#dataset/existing");
  expect(createSavedDataset).not.toHaveBeenCalled();
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

it("keeps a plan usable on a storage failure and retries saving automatically", async () => {
  vi.mocked(listSavedDatasets).mockResolvedValue([]);
  vi.mocked(saveGeneratedPurchasePlan).mockRejectedValueOnce(new Error("Storage temporarily unavailable"));
  render(<App />);
  fireEvent.click(screen.getByText("Import test replacement"));
  fireEvent.click(await screen.findByText("Check test readiness"));
  fireEvent.click(await screen.findByText("Calculate test plan"));
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  expect(screen.getByRole("alert").textContent).toContain("we will try again automatically");
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Save/ })).toBeNull();
  await screen.findByText("Saved automatically on this device", {}, { timeout: 5000 });
  expect(saveGeneratedPurchasePlan).toHaveBeenCalledTimes(2);
  expect(window.location.hash).toBe("#dataset/new");
  expect(runDemandForecastInWorker).toHaveBeenCalledOnce();
}, 10000);

it("automatically saves order and supplier edits", async () => {
  render(<App initialDatasetId="existing" />);
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  fireEvent.click(screen.getByText("Edit test order"));
  await waitFor(() => expect(saveDatasetWork).toHaveBeenCalledWith("existing", expect.objectContaining({ purchaseDrafts: { A: expect.any(Object) } })));
  fireEvent.click(screen.getByText("Edit test supplier"));
  await waitFor(() => expect(saveDatasetWork).toHaveBeenCalledWith("existing", expect.objectContaining({ supplierOrderDrafts: { A: { caseSize: 6 } } })));
  expect(screen.queryByRole("button", { name: /Save/ })).toBeNull();
});

it("keeps the automatically saved plan available when a reupload is cancelled", async () => {
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


it("merges the latest edits when an automatic save fails, so retry never restores older values", async () => {
  render(<App initialDatasetId="existing" />);
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  vi.mocked(saveDatasetWork).mockRejectedValueOnce(new Error("Temporary storage failure"));
  fireEvent.click(screen.getByText("Edit test order"));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByText("Edit test supplier"));
  await screen.findByText("Saved automatically on this device");
  expect(saveDatasetWork).toHaveBeenLastCalledWith("existing", expect.objectContaining({
    purchaseDrafts: { A: expect.objectContaining({ plannedOrder: expect.objectContaining({ value: 20 }) }) },
    supplierOrderDrafts: { A: { caseSize: 6 } },
  }));
});


it("shows Saving until the latest edit has finished writing", async () => {
  render(<App initialDatasetId="existing" />);
  await screen.findByRole("heading", { name: "Saved purchase plan" });
  let first!: (value: SavedDataset) => void;
  let second!: (value: SavedDataset) => void;
  vi.mocked(saveDatasetWork)
    .mockImplementationOnce(() => new Promise(resolve => { first = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { second = resolve; }));
  fireEvent.click(screen.getByText("Edit test order"));
  fireEvent.click(screen.getByText("Edit test supplier"));
  await act(async () => { first(saved); });
  expect(screen.getByText("Saving automatically…")).toBeTruthy();
  expect(screen.queryByText("Saved automatically on this device")).toBeNull();
  await act(async () => { second(saved); });
  expect(screen.getByText("Saved automatically on this device")).toBeTruthy();
});
