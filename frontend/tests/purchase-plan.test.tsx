import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PurchasePlanScreen } from "../src/screens/PurchasePlanScreen.tsx";
import { PurchaseStockChart } from "../src/purchase-plan/PurchaseStockChart.tsx";
import { PurchaseDemandChart } from "../src/purchase-plan/PurchaseDemandChart.tsx";
import { buildDemandReview, evaluateProductPurchasePlan, suggestSupplierOrder } from "../src/engine.ts";
import { joinPurchaseEvidence, type PurchaseDrafts } from "../src/purchase-plan/model.ts";
import { makeEvidence } from "./fixtures.ts";

function Harness({ data, evaluate = evaluateProductPurchasePlan }: { data?: ReturnType<typeof makeEvidence>; evaluate?: typeof evaluateProductPurchasePlan }) {
  const [defaultData] = useState(makeEvidence), evidence = data ?? defaultData;
  const [drafts, setDrafts] = useState<PurchaseDrafts>({}), [selectedKey, onSelect] = useState<string | null>(null);
  return <PurchasePlanScreen {...evidence} drafts={drafts} selectedKey={selectedKey} onSelect={onSelect} onDraftChange={(key, inputs) => setDrafts(previous => ({ ...previous, [key]: inputs }))} onBack={() => {}} evaluatePurchase={evaluate} />;
}
const open = (sku = "000101") => fireEvent.click(screen.getByRole("button", { name: new RegExp(`Open purchase plan.*${sku}`) }));
const detail = () => within(screen.getByRole("region", { name: "Same product name" }));
const openDetails = () => fireEvent.click(screen.getByRole("button", { name: "Open" }));
const checksOpen = () => screen.queryByRole("navigation", { name: "Product checks" }) !== null;

describe("purchase planning", () => {
  it("routes both impact actions to the existing dashboard callback", () => {
    const onImpact = vi.fn();
    render(<PurchasePlanScreen {...makeEvidence()} drafts={{}} selectedKey={null} onSelect={() => {}} onDraftChange={() => {}} onBack={() => {}} onImpact={onImpact} />);
    fireEvent.click(screen.getByRole("button", { name: "See your impact →" }));
    fireEvent.click(screen.getByRole("button", { name: /Possible excess stock.*See impact/ }));
    expect(onImpact).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("routes products needing more data back to readiness without quantity controls", () => {
    const onBack = vi.fn();
    render(<PurchasePlanScreen {...makeEvidence()} drafts={{}} selectedKey="C" onSelect={() => {}} onDraftChange={() => {}} onBack={onBack} />);
    expect(screen.getByRole("heading", { name: "Unavailable" })).toBeTruthy();
    expect(screen.getByText(makeEvidence().forecast.products.find(product => product.productKey === "C")!.labelReason.message)).toBeTruthy();
    expect(screen.queryByLabelText("Planned order")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fix it in Step 3" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
  it("keeps invalid text visible and checks the last accepted quantity; slider and buttons resynchronise the text", () => {
    render(<Harness />); open();
    const exact = screen.getByLabelText("Exact planned order quantity");
    fireEvent.change(exact, { target: { value: "12" } });
    fireEvent.change(exact, { target: { value: "-4" } });
    expect(exact.getAttribute("aria-invalid")).toBe("true");
    expect((exact as HTMLInputElement).value).toBe("-4");
    expect((screen.getByLabelText("Planned order") as HTMLInputElement).value).toBe("12");
    expect(screen.getByRole("alert").textContent).toContain("last valid quantity");
    fireEvent.change(screen.getByLabelText("Planned order"), { target: { value: "8" } });
    expect((exact as HTMLInputElement).value).toBe("8");
    expect(exact.getAttribute("aria-invalid")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Increase planned order" }));
    expect((exact as HTMLInputElement).value).toBe("9");
    fireEvent.click(screen.getByRole("button", { name: "Decrease planned order" }));
    expect((exact as HTMLInputElement).value).toBe("8");
  });
  it("shows automatic drafts and both charts immediately, preserving an explicit zero", () => {
    render(<Harness />); open();
    expect(screen.getAllByRole("columnheader").map(el=>el.textContent)).toEqual(["Product","Expected, 4 weeks","In stock","Your order","Check"]);
    expect(screen.getByLabelText("Planned order").getAttribute("aria-valuetext")).toBe("12 units");
    expect(screen.getByRole("img",{name:/Recorded sales/})).toBeTruthy();
    expect(screen.getByRole("img",{name:/^Stock after order:/})).toBeTruthy();
    expect(screen.getByRole("region",{name:"Why this purchase check?"})).toBeTruthy();
    expect(checksOpen()).toBe(false);
    fireEvent.change(screen.getByLabelText("Exact planned order quantity"),{target:{value:"0"}});
    expect(screen.getByLabelText("Planned order").getAttribute("aria-valuetext")).toBe("0 units");
    fireEvent.click(screen.getByRole("button",{name:"Reset order to suggestion"}));
    expect(screen.getByLabelText("Planned order").getAttribute("aria-valuetext")).toBe("12 units");
  });
  it("selects by key when names are identical and preserves leading zeros", () => {
    render(<Harness />);
    const row = screen.getByRole("button", { name: /Open purchase plan.*000202/ }).closest("tr")!;
    fireEvent.click(row.querySelectorAll("td")[1]);
    expect(detail().getByText(/000202 · Counted/)).toBeTruthy();
    expect(detail().getByText("Only 6 of the last 8 weeks have records")).toBeTruthy();
  });
  it("search and status filters select matching products, show an empty state and keep global counts", () => {
    render(<Harness />);
    const groups = screen.getByRole("group", { name: "Filter by what each product needs" });
    const counts = Array.from(groups.querySelectorAll(".pp-kpi-number")).map(el => el.textContent);
    fireEvent.change(screen.getByLabelText("Search name or code"), { target: { value: "000202" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(detail().getByText(/000202 · Counted/)).toBeTruthy();
    fireEvent.click(within(groups).getByRole("button", { name: /Need more data/ }));
    expect(screen.queryByRole("region", { name: "Same product name" })).toBeNull();
    expect(screen.getAllByText("No products match.").length).toBeGreaterThan(0);
    expect(Array.from(groups.querySelectorAll(".pp-kpi-number")).map(el => el.textContent)).toEqual(counts);
    fireEvent.change(screen.getByLabelText("Search name or code"), { target: { value: "" } });
    expect(screen.getByRole("heading", { name: "Few records" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });
  it("keeps ordering available with details closed and retains quantities without recalculating when details are opened", () => {
    const evaluate = vi.fn(evaluateProductPurchasePlan);
    render(<Harness evaluate={evaluate} />); open();
    const count = evaluate.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Planned order"), { target: { value: "23" } });
    expect(evaluate.mock.calls.length).toBe(count + 1);
    fireEvent.change(screen.getByLabelText("Incoming stock"), { target: { value: "40" } });
    expect(evaluate.mock.calls.length).toBe(count + 2);
    expect(checksOpen()).toBe(false);
    expect(screen.getByRole("region", { name: "Estimated purchase spending" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Done, next product →" })).toBeTruthy();
    openDetails();
    expect(checksOpen()).toBe(true);
    expect(screen.getByRole("img", { name: /Recorded sales/ })).toBeTruthy();
    expect((screen.getByLabelText("Exact planned order quantity") as HTMLInputElement).value).toBe("23");
    expect((screen.getByLabelText("Incoming stock") as HTMLInputElement).value).toBe("40");
    fireEvent.click(screen.getByRole("button", { name: "Hide evidence" }));
    expect(screen.queryByRole("img", { name: /Recorded sales/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show evidence" }));
    expect(screen.getByRole("img", { name: /Recorded sales/ })).toBeTruthy();
    expect(evaluate.mock.calls.length).toBe(count + 2);
    open("000202");
    expect(screen.getByLabelText("Planned order").getAttribute("aria-valuetext")).toBe("5 units");
    open(); expect((screen.getByLabelText("Planned order") as HTMLInputElement).value).toBe("23");
  });
  it("uses the suggested quantity explicitly and Done advances without discarding drafts", () => {
    render(<Harness />); open();
    const button = screen.getByRole("button", { name: /^Use suggested / });
    const quantity = button.textContent!.match(/\d[\d,]*/)?.[0].replaceAll(",", "");
    fireEvent.click(button);
    expect((screen.getByLabelText("Exact planned order quantity") as HTMLInputElement).value).toBe(quantity);
    expect(screen.getByText("This plan is within range.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done, next product →" }));
    open(); expect((screen.getByLabelText("Exact planned order quantity") as HTMLInputElement).value).toBe(quantity);
  });
  it("prefills confirmed file figures with provenance and mapped expiry", () => {
    const data = makeEvidence();
    data.snapshot = { ...data.snapshot, purchaseFileEvidence: { plannedOrderColumnConfirmed: true, incomingStockColumnConfirmed: true, expiryDateColumnConfirmed: true, products: [{ productKey: "A", plannedOrderQuantity: 20, incomingStockQuantity: 3, expiryDates: ["2026-09-20"], reasonCodes: [] }] } };
    render(<Harness data={data} />); open();
    expect((screen.getByLabelText("Planned order") as HTMLInputElement).value).toBe("20");
    expect((screen.getByLabelText("Incoming stock") as HTMLInputElement).value).toBe("3");
    expect(detail().getAllByText("from your file").length).toBeGreaterThan(1);
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: /^Expiry date/ }));
    expect(detail().getByText(/Expires in 6 days/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Planned order"), { target: { value: "21" } });
    expect(detail().getByText("input by you")).toBeTruthy();
  });
  it("keeps insufficient and stale evidence unplannable instead of showing false estimates", () => {
    const data = makeEvidence();
    data.snapshot = { ...data.snapshot, productStock: data.snapshot.productStock.map(stock => stock.productKey === "A" ? { ...stock, stockAsOfDate: "2026-08-01" } : stock) };
    render(<Harness data={data} />); open();
    expect(screen.getByText("the stock count date is more than 14 days old")).toBeTruthy();
    expect(screen.queryByLabelText("Planned order")).toBeNull();
    open("000303");
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Use suggested/ })).toBeNull();
  });
  it("surfaces all mismatches without calculating their plans", () => {
    const data = makeEvidence(); data.forecast = { ...data.forecast, products: [data.forecast.products[0], { ...data.forecast.products[1], productKey: "ORPHAN" }] };
    const evaluate = vi.fn(evaluateProductPurchasePlan);
    render(<Harness data={data} evaluate={evaluate} />);
    expect(screen.getAllByRole("row")).toHaveLength(5);
    expect(screen.getByRole("alert").textContent).toContain("Evidence mismatch");
    expect(evaluate.mock.calls.every(([demand]) => demand.productKey === "A")).toBe(true);
    expect(joinPurchaseEvidence(data.snapshot, { ...data.forecast, snapshotId: "stale" }).every(product => product.issue)).toBe(true);
  });
  it("keeps supplier terms per product and preserves a manual order while terms change", () => {
    render(<Harness />); open();
    fireEvent.click(screen.getByRole("button",{name:"Use suggested 12"}));
    const initial = (screen.getByLabelText("Planned order") as HTMLInputElement).value;
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: /Supplier terms/ }));
    fireEvent.change(screen.getByLabelText("Case size"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Minimum order"), { target: { value: "36" } });
    fireEvent.change(screen.getByLabelText("Lead time (days)"), { target: { value: "29" } });
    expect((screen.getByLabelText("Planned order") as HTMLInputElement).value).toBe(initial);
    expect(screen.getByText(/Delivery falls outside/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use supplier quantity 36" }));
    expect((screen.getByLabelText("Planned order") as HTMLInputElement).value).toBe("36");
    expect(screen.getByText("This plan looks too high.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Case size"), { target: { value: "0" } });
    expect(screen.queryByRole("button", { name: /^Use supplier quantity/ })).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("whole case size");
    open("000202"); openDetails(); fireEvent.click(screen.getByRole("button", { name: /Supplier terms/ }));
    expect((screen.getByLabelText("Case size") as HTMLInputElement).value).toBe("");
    open(); openDetails(); fireEvent.click(screen.getByRole("button", { name: /Supplier terms/ }));
    expect((screen.getByLabelText("Case size") as HTMLInputElement).value).toBe("12");
    const product = joinPurchaseEvidence(makeEvidence().snapshot, makeEvidence().forecast)[0];
    const plan = evaluateProductPurchasePlan(product.demand!, { analysisDate: "2026-09-14", stock: product.stock });
    expect(suggestSupplierOrder(plan.estimatedRestock, { caseSize: 12, minimumOrder: 36 }, "2026-09-14")).toMatchObject({ quantity: 36 });
  });
});

describe("purchase evidence chart", () => {
  it("compares equal four-week totals and preserves the supplied forecast bounds", () => {
    const { snapshot, forecast } = makeEvidence();
    const weeks = buildDemandReview(snapshot).products.find(product => product.productKey === "A")!.timeline.weeks;
    const range = { ...forecast.products[0].range!, low: 20, high: 60 };
    render(<PurchaseDemandChart weeks={weeks} range={range} name="Test" analysisDate={snapshot.analysisDate} />);
    const bars = screen.getAllByTestId("recorded-period-bar");
    expect(bars).toHaveLength(2);
    const expected = [weeks.slice(-8, -4), weeks.slice(-4)].map(period => period.reduce((sum, week) => sum + week.positiveQuantity, 0));
    const chart = screen.getByRole("img", { name: /Recorded sales/ });
    expected.forEach(quantity => expect(chart.getAttribute("aria-label")).toContain(`${quantity} units`));
    expect(chart.getAttribute("aria-label")).toContain("Next 4 weeks: 20–60 units");
    expect(screen.getByTestId("forecast-range-extension")).toBeTruthy();
    expect(screen.getByText("Earlier 4 weeks")).toBeTruthy();
    expect(screen.getByText("Latest 4 weeks")).toBeTruthy();
  });
  it("shows a single estimate without a range extension when both bounds agree", () => {
    const { snapshot, forecast } = makeEvidence();
    const weeks = buildDemandReview(snapshot).products.find(product => product.productKey === "A")!.timeline.weeks;
    render(<PurchaseDemandChart weeks={weeks} range={{ ...forecast.products[0].range!, low: 40, high: 40 }} name="Test" analysisDate={snapshot.analysisDate} />);
    expect(screen.getByRole("img", { name: /Recorded sales/ }).getAttribute("aria-label")).toContain("Next 4 weeks: 40 units");
    expect(screen.queryByTestId("forecast-range-extension")).toBeNull();
    expect(screen.queryByText("40–40")).toBeNull();
  });
  it("shows no complete-period sales bar when recent records are missing", () => {
    const { snapshot, forecast } = makeEvidence();
    render(<PurchaseDemandChart weeks={[]} range={forecast.products[0].range!} name="Test" analysisDate={snapshot.analysisDate} />);
    expect(screen.queryByTestId("recorded-period-bar")).toBeNull();
    expect(screen.getAllByText("Missing records")).toHaveLength(2);
    expect(screen.getAllByText("0 of 4 weeks recorded")).toHaveLength(2);
  });
  it("separates stock and estimated sales while keeping a shared scale", () => {
    render(<PurchaseStockChart stock={10} incoming={5} order={20} low={30} high={40} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Stock after order: 35 units");
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Expected demand: 30–40 units");
    expect(screen.getByText("Stock after your order")).toBeTruthy();
    expect(screen.getByText("Expected sales")).toBeTruthy();
    expect(screen.getByText("In stock: 10")).toBeTruthy();
    expect(screen.getByText("Incoming: 5")).toBeTruthy();
    expect(screen.getByText("Your order: 20")).toBeTruthy();
  });
  it("distinguishes missing weeks from zero and shows one four-week forecast", () => {
    const { snapshot, forecast } = makeEvidence();
    const weeks = buildDemandReview(snapshot).products.find(product => product.productKey === "B")!.timeline.weeks;
    render(<PurchaseDemandChart weeks={weeks} range={forecast.products[1].range!} name="Test" analysisDate={snapshot.analysisDate} />);
    expect(screen.getAllByTestId("missing-week")).toHaveLength(2);
    expect(screen.getAllByTestId("zero-sales-bar")).toHaveLength(1);
    expect(screen.getAllByTestId("recorded-sales-bar")).toHaveLength(5);
    expect(screen.getAllByTestId("forecast-period-bar")).toHaveLength(1);
    expect(screen.queryByTestId("forecast-week-band")).toBeNull();
    expect(screen.getByText("The forecast is an estimate for all 4 weeks together. Actual sales may be lower or higher.")).toBeTruthy();
    expect(screen.getByText("A past bar is unavailable when any of its weeks are missing. Missing records do not mean zero sales.")).toBeTruthy();
  });
  it("does not substitute old history for recent missing weeks and explains returns", () => {
    const { snapshot, forecast } = makeEvidence();
    const weeks = buildDemandReview(snapshot).products[0].timeline.weeks.map((week, i) => i === 0 ? { ...week, negativeQuantity: -2 } : week);
    const view = render(<PurchaseDemandChart weeks={weeks} range={forecast.products[0].range!} name="Test" analysisDate={snapshot.analysisDate} />);
    expect(screen.getByText(/Bars show positive sales/)).toBeTruthy();
    view.rerender(<PurchaseDemandChart weeks={weeks} range={forecast.products[0].range!} name="Test" analysisDate="2027-09-14" />);
    expect(screen.getAllByTestId("missing-week")).toHaveLength(8);
    expect(screen.queryByTestId("recorded-sales-bar")).toBeNull();
  });
});
