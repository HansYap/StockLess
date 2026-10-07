import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ReadinessOverview } from "../src/screens/ReadinessOverview.tsx";
import { PurchasePlanScreen } from "../src/screens/PurchasePlanScreen.tsx";
import { ProductPurchasePanel } from "../src/purchase-plan/ProductPurchasePanel.tsx";
import { StorageExplanation } from "../src/components/StorageExplanation.tsx";
import { findingsCsv } from "../src/screens/ReadinessScreen.tsx";
import { buildFindings, buildReadinessProducts } from "../src/readiness/model.ts";
import { joinPurchaseEvidence } from "../src/purchase-plan/model.ts";
import { setLanguage } from "../src/i18n/index.ts";
import { parseCsvBytes, createMappingState, setMapping, confirmIdentityMode, runReadinessCheck, previousCompleteWeekStarts, buildProductTimelines, buildDemandForecastReview, emptyProductPurchaseInputs, createPurchaseQuantity, evaluateProductPurchasePlan } from "../src/engine.ts";

beforeEach(() => setLanguage("en"));
async function evidence({ conflict = false, duplicate = false, sample = false } = {}) {
  const records = previousCompleteWeekStarts("2026-10-06").map((date,i) => [date,"A","10","Tea","250 g","0","2026-10-05","2.50",`tx-${i}`]);
  if (conflict) { records[7][3] = "Teh Alternatif"; records[7][4] = "500 g"; }
  if (duplicate) records.push([...records[0]]);
  const dataset = await parseCsvBytes(new TextEncoder().encode(["Date,SKU,Quantity,Name,Pack,Stock,Stock date,Unit Cost,Transaction reference", ...records.map(r=>r.join(","))].join("\n")), {sourceMode:sample?"sample":"user",sourceName:"test.csv"});
  let mapping = createMappingState();
  for (const [i,field] of (["transaction_date","product_code","quantity_sold","product_name","pack_variant","current_stock","stock_as_of_date","unit_cost"] as const).entries()) mapping = setMapping(mapping,field,`column-${i}`,true);
  mapping = confirmIdentityMode(mapping,"stable");
  const snapshot = await runReadinessCheck(dataset,mapping,{analysisDate:"2026-10-06"});
  return {snapshot,forecast:buildDemandForecastReview(snapshot)};
}

it("finds and displays an alternate conflicting label in readiness and purchase while keeping it blocked", async () => {
  const {snapshot,forecast} = await evidence({conflict:true});
  const ready = render(<ReadinessOverview snapshot={snapshot} timelines={buildProductTimelines(snapshot)} />);
  fireEvent.change(screen.getByRole("searchbox"),{target:{value:"Teh Alternatif"}});
  expect(document.querySelectorAll(".pcard")).toHaveLength(1);
  expect(screen.getByText(/Teh Alternatif.*500 g/)).toBeTruthy();
  expect(forecast.products[0].range).toBeUndefined();
  ready.unmount();
  render(<PurchasePlanScreen snapshot={snapshot} forecast={forecast} drafts={{}} selectedKey="ID|A" onSelect={()=>{}} onDraftChange={()=>{}} onBack={()=>{}} />);
  fireEvent.change(screen.getByRole("searchbox"),{target:{value:"Teh Alternatif"}});
  expect(document.querySelectorAll(".pp-table tbody tr")).toHaveLength(1);
  expect(within(document.querySelector(".pp-table")!).getByText(/Teh Alternatif/)).toBeTruthy();
  expect(screen.getByRole("heading",{name:"Unavailable"})).toBeTruthy();
});

it("default problem CSV identifies the duplicate's retained and excluded rows independently", async () => {
  const {snapshot} = await evidence({duplicate:true});
  const products = buildReadinessProducts(snapshot,buildProductTimelines(snapshot));
  const findings = buildFindings(snapshot,products).filter(item=>item.type==="tidy");
  const group = snapshot.duplicateGroups[0];
  const csv = findingsCsv(findings,"test.xlsx",snapshot.analysisDate,"Sales");
  const lines = csv.split("\r\n");
  expect(lines.some(line=>line.includes(`"${group.retainedSourceRow}","${group.sourceRows.join(", ")}"`) && line.endsWith('"Used"'))).toBe(true);
  const excluded = group.sourceRows.find(row=>row!==group.retainedSourceRow)!;
  expect(lines.some(line=>line.includes(`"${excluded}","${group.sourceRows.join(", ")}"`) && line.endsWith('"Left out"'))).toBe(true);
  expect(csv).toContain('"test.xlsx","Sales"');
  expect(csv).not.toContain("See all row evidence");
});

it("purchase summary shows Not entered before input and an assessed zero after an explicit zero", async () => {
  const {snapshot,forecast} = await evidence();
  const props = {snapshot,forecast,selectedKey:"ID|A",onSelect:()=>{},onDraftChange:()=>{},onBack:()=>{},onImpact:()=>{}};
  const {rerender} = render(<PurchasePlanScreen {...props} drafts={{}} />);
  const summary = () => within(screen.getByRole("button",{name:/Possible excess stock.*See impact/}));
  expect(summary().getByText("Not entered")).toBeTruthy();
  expect(summary().queryByText("0 units")).toBeNull();
  rerender(<PurchasePlanScreen {...props} drafts={{"ID|A":{...emptyProductPurchaseInputs(),plannedOrder:createPurchaseQuantity(0,"input by you")}}} />);
  expect(summary().getByText("0 units")).toBeTruthy();
  expect(summary().queryByText("Not entered")).toBeNull();
});

it("sample offers two supplier comparisons and adopts only an explicitly chosen quantity", async () => {
  const {snapshot,forecast} = await evidence({sample:true});
  const product = joinPurchaseEvidence(snapshot,forecast)[0], inputs = emptyProductPurchaseInputs();
  const plan = evaluateProductPurchasePlan(product.demand!,{stock:product.stock,analysisDate:snapshot.analysisDate,inputs});
  const onChange = vi.fn();
  render(<ProductPurchasePanel product={product} plan={plan} inputs={inputs} analysisDate={snapshot.analysisDate} terms={{}} onTermsChange={()=>{}} onChange={onChange} onReviewData={()=>{}} total={1} onDone={()=>{}} />);
  fireEvent.click(screen.getByText("Compare supplier options"));
  const a = within(screen.getByRole("region",{name:"Supplier option A"})), b = within(screen.getByRole("region",{name:"Supplier option B"}));
  expect(a.getByText("42")).toBeTruthy(); expect(b.getByText("60")).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(a.getByRole("button",{name:"Use this supplier quantity"}));
  expect(onChange.mock.calls[0][0].plannedOrder.value).toBe(42);
  fireEvent.change(a.getByRole("textbox",{name:/Case size/}),{target:{value:"bad"}});
  expect(a.queryByRole("button",{name:"Use this supplier quantity"})).toBeNull();
  expect(a.getByRole("alert")).toBeTruthy();
});

it("storage explanation states retention, purposes and browser loss", () => {
  const manage = vi.fn();
  render(<StorageExplanation onManage={manage} />);
  expect(screen.getByText(/Settings: column matches/)).toBeTruthy();
  expect(screen.getByText(/Plan history: a copy/)).toBeTruthy();
  expect(screen.getByText(/may be lost when browser data is cleared/)).toBeTruthy();
  expect(screen.getByText(/Your latest 12 completed uploads/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Manage saved uploads" }));
  expect(manage).toHaveBeenCalledOnce();
});
