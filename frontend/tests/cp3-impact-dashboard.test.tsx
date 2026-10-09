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
    onContextsChange={updates => setContexts(current => ({ ...current, ...updates }))}
    onContextChange={(key, value) => setContexts(current => ({ ...current, [key]: value }))} onBack={() => {}} />;
}
function openAnalysis() { expect(screen.getByRole("heading", { name: "Detailed estimates and how they work" })).toBeTruthy(); }
function financialCard(label: string) { openAnalysis(); fireEvent.click(screen.getByRole("tab", { name: "Business" })); return screen.getByText(label).parentElement!; }
function environmentPanel() { openAnalysis(); fireEvent.click(screen.getByRole("tab", { name: "Environmental" })); return screen.getByRole("tabpanel", { name: "Environmental" }); }
function environmentalValue(label: string) { return within(environmentPanel()).getByText(label).parentElement!.querySelector("b")!.textContent; }

it("Step 5 shows the exact same current planned and scenario quantities/costs as Step 4", async () => {
  const input = await evidence();
  const plans = buildPurchasePlanReview(input.snapshot, input.forecast, { inputsByProduct: input.drafts }).products;
  const impact = buildImpactReview(input.snapshot, input.forecast, input.drafts, plans);
  const view = render(<Harness {...input} />);
  const step4Cost = estimatePurchaseCost(input.snapshot, KEY, input.drafts[KEY].plannedOrder.state === "value" ? input.drafts[KEY].plannedOrder.value : undefined);
  expect(step4Cost.state).toBe("estimated");
  if (step4Cost.state === "estimated") expect(within(financialCard("Planned purchase spend")).getByText(`MYR ${step4Cost.amount.toFixed(2)}`)).toBeTruthy();
  expect(impact.products[0].scenarioQuantity).toBe(plans[0].estimatedRestock.state === "available" ? plans[0].estimatedRestock.quantity.value : undefined);
  expect(within(financialCard("Restock scenario spend")).getByText("MYR 100.00")).toBeTruthy();
  expect(within(financialCard("Excess-stock cost")).getByText("MYR 150.00")).toBeTruthy();
  expect(within(financialCard("Suggested orders would cost less")).getByText("MYR 150.00")).toBeTruthy();
  expect(within(financialCard("Suggested orders would cost less")).getByText("Compared with your plan · same 1 product")).toBeTruthy();
  view.rerender(<Harness {...input} drafts={{ [KEY]: { ...input.drafts[KEY], plannedOrder: createPurchaseQuantity(10, "input by you") } }} />);
  expect(within(financialCard("Suggested orders would cost more")).getByText("MYR 75.00")).toBeTruthy();
  view.rerender(<Harness {...input} drafts={{ [KEY]: { ...input.drafts[KEY], plannedOrder: createPurchaseQuantity(40, "input by you") } }} />);
  expect(within(financialCard("Suggested orders would cost the same")).getByText("MYR 0.00")).toBeTruthy();
  await waitFor(() => expect(getSavedDataset).toHaveBeenCalled());
});

it("automatic category and pack weight produce CO2e without extra inputs", async () => {
  const input=await evidence(); render(<Harness {...input} />);
  expect(environmentalValue("Potential excess: estimated CO₂e")).toMatch(/≈ [\d,.]+ kg CO₂e/);
  expect(screen.queryByText("Recorded waste: estimated CO₂e")).toBeNull();
  expect(screen.queryByLabelText("Food category")).toBeNull();
  expect(screen.queryByText("Review suggested categories (1)")).toBeNull();
  expect(screen.getAllByText(/AI-assigned food category, not manually confirmed/).length).toBeGreaterThan(0);
});

it("manual cost and weight still take priority, while replacement evidence discards them", async () => {
  const input=await evidence({cost:""});
  const contexts={ [KEY]:{evidenceKey:input.snapshot.evidenceKey!,category:"rice",categoryConfirmed:true,isFood:true,unitCost:4,kgPerUnit:.2} };
  const props={...input,snapshot:applyPlanningContexts(input.snapshot,contexts),contexts,onBack:()=>{}};
  const {rerender}=render(<ImpactDashboard {...props} />);
  expect(within(financialCard("Planned purchase spend")).getByText("MYR 400.00")).toBeTruthy();
  expect(environmentalValue("Potential excess: estimated CO₂e")).toMatch(/kg CO₂e/);
  const replacement=await evidence({cost:"",name:"Unknown item"});
  rerender(<ImpactDashboard {...replacement} snapshot={applyPlanningContexts(replacement.snapshot,contexts)} contexts={contexts} onBack={()=>{}} />);
  expect(environmentalValue("Potential excess: estimated CO₂e")).toBe("Unavailable");
  expect(within(financialCard("Planned purchase spend")).getByText("Unavailable")).toBeTruthy();
});

it("keeps saved outcomes out of snapshot estimates without deleting those records", async () => {
  const input = await evidence({ pack: "30 biji" });
  const zero = createStockOutcome({ id: "zero-waste", datasetId: "D", productKey: KEY, kind: "discarded", date: DATE, quantity: 0, unit: "kg", referenceDate: DATE, recordedAt: "2026-10-06T00:00:00Z" });
  const saved = { ...input.saved, outcomes: [{ id: zero.id, recordedAt: zero.recordedAt, details: {}, stockOutcome: zero }] }, before = JSON.stringify(saved);
  vi.mocked(getSavedDataset).mockResolvedValue(saved);
  render(<Harness {...input} initialContexts={{ [KEY]: { evidenceKey: input.snapshot.evidenceKey!, category: "rice", categoryConfirmed: true, isFood: true } }} />);
  fireEvent.click(screen.getByRole("tab", { name: "Environmental" }));
  await waitFor(() => expect(getSavedDataset).toHaveBeenCalledWith("D"));
  expect(screen.queryByText("Recorded waste: estimated CO₂e")).toBeNull();
  expect(environmentalValue("Potential excess: estimated CO₂e")).toBe("Unavailable");
  expect(environmentalValue("Named scenario difference")).toBe("Unavailable");
  expect(environmentPanel().querySelectorAll('.ix-card')).toHaveLength(2);
  expect(JSON.stringify(saved)).toBe(before);
});

it("missing cost does not block stock or automatic environmental estimates", async () => {
  const input=await evidence({cost:""});render(<Harness {...input} />);
  expect(environmentalValue("Potential excess: estimated CO₂e")).toMatch(/kg CO₂e/);
  expect(within(financialCard("Planned purchase spend")).getByText("Unavailable")).toBeTruthy();
  expect(screen.getByRole("button",{name:/Possible excess stock/}).querySelector('b')?.textContent).toBe("60 units");
  expect(screen.queryByLabelText("Your purchase cost / sales unit (MYR)")).toBeNull();
});

it("an unsupported automatic category leaves stock and money available without a confirmation checklist",async()=>{
  const input=await evidence({name:'Unknown item'});render(<Harness {...input} />);
  expect(environmentalValue('Potential excess: estimated CO₂e')).toBe('Unavailable');
  expect(within(environmentPanel()).queryByText(/Confirm categories/)).toBeNull();
  expect(screen.getByRole('button',{name:/Possible excess stock/}).querySelector('b')?.textContent).toBe('60 units');
  expect(within(financialCard('Planned purchase spend')).getByText('MYR 250.00')).toBeTruthy();
});

it("optional corrections lead to one product-details home in Purchase plan", async () => {
  const input=await evidence({cost:""}),review=vi.fn();
  render(<ImpactDashboard {...input} onProductDetails={review} onBack={()=>{}} />);
  financialCard("Planned purchase spend");fireEvent.click(screen.getByText("Missing purchase costs: first 10 priorities"));
  fireEvent.click(screen.getByRole("button",{name:"Add cost"}));expect(review).toHaveBeenCalledWith(KEY);
  expect(screen.queryByLabelText("Your purchase cost / sales unit (MYR)")).toBeNull();
});
