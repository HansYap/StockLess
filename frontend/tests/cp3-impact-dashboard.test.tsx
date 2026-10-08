import { useMemo, useState } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ImpactDashboard } from "../src/screens/ImpactDashboard.tsx";
import { setLanguage } from "../src/i18n/index.ts";
import { applyPlanningContexts, buildDemandForecastReview, buildImpactReview, buildPurchasePlanReview, confirmIdentityMode,
  createEmptySession, createMappingState, createPurchaseQuantity, createStockOutcome, emptyProductPurchaseInputs, estimatePurchaseCost,
  parseCsvBytes, previousCompleteWeekStarts, runReadinessCheck, setMapping,
  type DemandForecastReview, type PlanningContexts, type ReadinessSnapshot, type ProductPurchaseInputs } from "../src/engine.ts";
import { getSavedDataset, type SavedDataset } from "../src/storage/saved-datasets.ts";

// Read boundary only; all readiness, planning, cost, category, kg and CO2e calculations remain real.
vi.mock("../src/storage/saved-datasets.ts", async importOriginal => ({
  ...await importOriginal<typeof import("../src/storage/saved-datasets.ts")>(), getSavedDataset: vi.fn(async () => undefined),
}));

const DATE = "2026-10-06", KEY = "ID|000101";
beforeEach(() => { setLanguage("en"); vi.mocked(getSavedDataset).mockReset(); vi.mocked(getSavedDataset).mockResolvedValue(undefined); });
async function evidence(options: { cost?: string; pack?: string; name?: string } = {}) {
  const headers = ["Date", "SKU", "Name", "Pack", "Quantity", "Stock", "Stock date", "Cost"];
  const rows = previousCompleteWeekStarts(DATE).map(date => [date, "000101", options.name ?? "Beras", options.pack ?? "500g", "10", "0", DATE, options.cost ?? "2.50"]);
  const dataset = await parseCsvBytes(new TextEncoder().encode([headers, ...rows].map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n")), { sourceMode: "user", sourceName: "merchant-test.csv" });
  let mapping = createMappingState();
  for (const [index, field] of (["transaction_date", "product_code", "product_name", "pack_variant", "quantity_sold", "current_stock", "stock_as_of_date", "unit_cost"] as const).entries()) mapping = setMapping(mapping, field, `column-${index}`, true);
  mapping = confirmIdentityMode(mapping, "stable");
  const snapshot = await runReadinessCheck(dataset, mapping, { analysisDate: DATE }), forecast = buildDemandForecastReview(snapshot);
  const drafts = { [KEY]: { ...emptyProductPurchaseInputs(), plannedOrder: createPurchaseQuantity(100, "input by you") } };
  const empty = createEmptySession();
  const saved: SavedDataset = { id: "D", shopName: "Test shop", datasetName: "October", shopKey: "test shop", nameKey: "october", createdAt: "2026-10-06T00:00:00Z", updatedAt: "2026-10-06T00:00:00Z",
    envelope: { ...empty, session: { ...empty.session, sourceMode: "user", dataset, mapping } }, analysisDate: DATE, dateConfirmations: [], readiness: snapshot, forecast, purchaseDrafts: drafts, supplierTerms: {}, decisions: [], outcomes: [] };
  return { snapshot, forecast, drafts, saved };
}
function Harness({ snapshot, forecast, drafts, initialContexts = {} }: { snapshot: ReadinessSnapshot; forecast: DemandForecastReview; drafts: Readonly<Record<string, ProductPurchaseInputs>>; initialContexts?: PlanningContexts }) {
  const [contexts, setContexts] = useState(initialContexts);
  const effective = useMemo(() => applyPlanningContexts(snapshot, contexts), [snapshot, contexts]);
  return <ImpactDashboard snapshot={effective} forecast={forecast} drafts={drafts} contexts={contexts} datasetId="D" shopName="Test shop" datasetName="October"
    onContextChange={(key, value) => setContexts(current => ({ ...current, [key]: value }))} onBack={() => {}} />;
}
function financialCard(label: string) { return screen.getByText(label).parentElement!; }
function environmentPanel() { return screen.getByRole("tabpanel", { name: "Environmental" }); }
function environmentalValue(label: string) { return within(environmentPanel()).getByText(label).parentElement!.querySelector("b")!.textContent; }
function openInputs() { fireEvent.click(screen.getByText("Confirm category, cost, weight and storage")); }

it("Step 5 shows the exact same current planned and scenario quantities/costs as Step 4", async () => {
  const input = await evidence();
  const plans = buildPurchasePlanReview(input.snapshot, input.forecast, { inputsByProduct: input.drafts }).products;
  const impact = buildImpactReview(input.snapshot, input.forecast, input.drafts, plans);
  render(<Harness {...input} />);
  const step4Cost = estimatePurchaseCost(input.snapshot, KEY, input.drafts[KEY].plannedOrder.state === "value" ? input.drafts[KEY].plannedOrder.value : undefined);
  expect(step4Cost.state).toBe("estimated");
  if (step4Cost.state === "estimated") expect(within(financialCard("Planned purchase spend")).getByText(`MYR ${step4Cost.amount.toFixed(2)}`)).toBeTruthy();
  expect(impact.products[0].scenarioQuantity).toBe(plans[0].estimatedRestock.state === "available" ? plans[0].estimatedRestock.quantity.value : undefined);
  expect(within(financialCard("Restock scenario spend")).getByText("MYR 100.00")).toBeTruthy();
  expect(within(financialCard("Excess-stock cost")).getByText("MYR 150.00")).toBeTruthy();
  expect(within(financialCard("Estimated purchase-spend difference")).getByText("MYR 150.00")).toBeTruthy();
  await waitFor(() => expect(getSavedDataset).toHaveBeenCalled());
});

it("category selection does not unlock CO2e until explicitly saved; v2 then labels the bounded rice estimate", async () => {
  const input = await evidence();
  render(<Harness {...input} />);
  fireEvent.click(screen.getByRole("tab", { name: "Environmental" }));
  expect(environmentalValue("Potential excess: estimated CO₂e")).toBe("Unavailable");
  expect(environmentalValue("Recorded waste: estimated CO₂e")).toBe("No outcome recorded");
  openInputs();
  fireEvent.change(screen.getByLabelText("Food category"), { target: { value: "rice" } });
  expect(environmentalValue("Potential excess: estimated CO₂e")).toBe("Unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Confirm and save inputs" }));
  await waitFor(() => expect(environmentalValue("Potential excess: estimated CO₂e")).toMatch(/≈ [\d,.]+ kg CO₂e/));
  expect(environmentalValue("Recorded waste: estimated CO₂e")).toBe("No outcome recorded");
  expect(within(environmentPanel()).getByText("CP3 v2: agreeing-group mean; otherwise median only within ×2 of every source, labelled estimate. Single-source factors are excluded. No consumer stage. Confirm every category.")).toBeTruthy();
  const explanation = within(environmentPanel()).getAllByText(/Beras · .*kg CO₂e/)[0];
  fireEvent.click(explanation);
  expect(within(explanation.closest("details")!).getByText("Estimate; sources disagree, bounded within ×2")).toBeTruthy();
});

it("manual seller cost and weight recalculate totals, then a changed source invalidates all manual overrides", async () => {
  const input = await evidence({ cost: "" });
  const { rerender } = render(<Harness {...input} />);
  expect(within(financialCard("Planned purchase spend")).getByText("Unavailable")).toBeTruthy();
  openInputs();
  fireEvent.change(screen.getByLabelText("Food category"), { target: { value: "rice" } });
  fireEvent.change(screen.getByLabelText("Your purchase cost / sales unit (MYR)"), { target: { value: "4" } });
  fireEvent.change(screen.getByLabelText("Measured kg / sales unit"), { target: { value: ".2" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm and save inputs" }));
  await waitFor(() => expect(within(financialCard("Planned purchase spend")).getByText("MYR 400.00")).toBeTruthy());
  fireEvent.click(screen.getByRole("tab", { name: "Environmental" }));
  expect(environmentalValue("Potential excess: estimated CO₂e")).toMatch(/kg CO₂e/);
  const replacement = await evidence({ cost: "", name: "Different source chicken" });
  expect(replacement.snapshot.evidenceKey).not.toBe(input.snapshot.evidenceKey);
  rerender(<Harness {...replacement} />);
  await waitFor(() => expect(environmentalValue("Potential excess: estimated CO₂e")).toBe("Unavailable"));
  openInputs();
  expect((screen.getByLabelText("Food category") as HTMLSelectElement).value).toBe("");
  expect((screen.getByLabelText("Your purchase cost / sales unit (MYR)") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Measured kg / sales unit") as HTMLInputElement).value).toBe("");
  expect(screen.getByText("Previous inputs belong to different source evidence. Confirm them again.")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Business" }));
  expect(within(financialCard("Planned purchase spend")).getByText("Unavailable")).toBeTruthy();
});

it("actual recorded zero kg appears as zero even when count-only packaging blocks potential mass", async () => {
  const input = await evidence({ pack: "30 biji" });
  const zero = createStockOutcome({ id: "zero-waste", datasetId: "D", productKey: KEY, kind: "discarded", date: DATE, quantity: 0, unit: "kg", referenceDate: DATE, recordedAt: "2026-10-06T00:00:00Z" });
  vi.mocked(getSavedDataset).mockResolvedValue({ ...input.saved, outcomes: [{ id: zero.id, recordedAt: zero.recordedAt, details: {}, stockOutcome: zero }] });
  render(<Harness {...input} initialContexts={{ [KEY]: { evidenceKey: input.snapshot.evidenceKey!, category: "rice", categoryConfirmed: true, isFood: true } }} />);
  fireEvent.click(screen.getByRole("tab", { name: "Environmental" }));
  await waitFor(() => expect(environmentalValue("Recorded waste: estimated CO₂e")).toBe("≈ 0 kg CO₂e"));
  expect(environmentalValue("Potential excess: estimated CO₂e")).toBe("Unavailable");
  expect(environmentalValue("Named scenario difference")).toBe("Unavailable");
  expect(within(environmentPanel()).getByText("0 kg · Source-agreement mass / estimated-factor mass: 0 / 0 kg")).toBeTruthy();
});
