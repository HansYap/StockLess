import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { PurchasePlanScreen, type SupplierDrafts } from "../src/screens/PurchasePlanScreen.tsx";
import { buildDemandForecastReview, createPurchaseQuantity, evaluateProductPurchasePlan, type ProductPurchaseInputs } from "../src/engine.ts";
import { evaluatePurchaseProduct, joinPurchaseEvidence, type PurchaseDrafts } from "../src/purchase-plan/model.ts";
import { prepareSuggestedOrders } from "../src/purchase-plan/suggested-orders.ts";
import { setLanguage } from "../src/i18n/index.ts";
import { makeEvidence } from "./fixtures.ts";

afterEach(() => act(() => setLanguage("en")));
const blank: ProductPurchaseInputs = { plannedOrder: { state: "empty" }, incomingStock: { state: "empty" } };
function Harness({ data = makeEvidence(), initial = {}, terms = {}, apply = vi.fn() }: { data?: ReturnType<typeof makeEvidence>; initial?: PurchaseDrafts; terms?: SupplierDrafts; apply?: ReturnType<typeof vi.fn> }) {
  const [evidence] = useState(data), [drafts, setDrafts] = useState(initial), [selectedKey, onSelect] = useState<string | null>("A");
  return <PurchasePlanScreen {...evidence} drafts={drafts} supplierDrafts={terms} selectedKey={selectedKey} onSelect={onSelect}
    onDraftChange={(key, inputs) => setDrafts(previous => ({ ...previous, [key]: inputs }))}
    onDraftsChange={updates => { apply(updates); setDrafts(previous => ({ ...previous, ...updates })); }} onBack={() => {}} />;
}
const prepare = () => fireEvent.click(screen.getByRole("button", { name: "Prepare suggested orders" }));
const dialog = () => within(screen.getByRole("dialog", { name: "Review suggested orders" }));
const choice = (sku: string) => dialog().getByRole("checkbox", { name: new RegExp(`SKU ${sku}$`) }) as HTMLInputElement;
function review(data = makeEvidence(), drafts: PurchaseDrafts = {}, terms: SupplierDrafts = {}) {
  const products = joinPurchaseEvidence(data.snapshot, data.forecast);
  const plans = new Map(products.map(product => [product.key, evaluatePurchaseProduct(product, data.snapshot.analysisDate, drafts[product.key] ?? product.fileInputs, evaluateProductPurchasePlan)]));
  return prepareSuggestedOrders(products, plans, drafts, terms, data.snapshot.analysisDate, evaluateProductPurchasePlan);
}

describe("reviewed suggested orders", () => {
  it("changes nothing on preview or cancellation, then applies all selected drafts together and synchronises the open editor", () => {
    const apply = vi.fn(), incoming = createPurchaseQuantity(3, "from your file");
    render(<Harness initial={{ A: { ...blank, incomingStock: incoming } }} apply={apply} />);
    fireEvent.change(screen.getByLabelText("Exact planned order quantity"), { target: { value: "-4" } });
    prepare();
    expect(apply).not.toHaveBeenCalled();
    expect(dialog().getAllByRole("checkbox")).toHaveLength(2);
    fireEvent.click(dialog().getByRole("button", { name: "Cancel" }));
    expect(apply).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Exact planned order quantity") as HTMLInputElement).value).toBe("-4");
    prepare(); fireEvent.click(dialog().getByRole("button", { name: "Use 2 suggestions" }));
    expect(apply).toHaveBeenCalledOnce();
    const updates = apply.mock.calls[0][0] as PurchaseDrafts;
    expect(Object.keys(updates)).toEqual(["A", "B"]);
    expect(updates.A?.incomingStock).toBe(incoming);
    expect(updates.A?.plannedOrder).toMatchObject({ state: "value", source: "input by you" });
    expect((screen.getByLabelText("Exact planned order quantity") as HTMLInputElement).value).toBe(String(updates.A!.plannedOrder.state === "value" ? updates.A!.plannedOrder.value : ""));
    expect(screen.getByLabelText("Exact planned order quantity").getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("2 draft orders updated. You can still edit each quantity.")).toBeTruthy();
  });

  it("preserves explicit zero and confirmed file orders without creating unavailable quantities", () => {
    const data = makeEvidence(), apply = vi.fn();
    data.snapshot = { ...data.snapshot, purchaseFileEvidence: { plannedOrderColumnConfirmed: true, incomingStockColumnConfirmed: false, expiryDateColumnConfirmed: false,
      products: [{ productKey: "B", plannedOrderQuantity: 20, reasonCodes: [] }] } };
    render(<Harness data={data} initial={{ A: { ...blank, plannedOrder: createPurchaseQuantity(0, "input by you") } }} apply={apply} />);
    prepare();
    expect(dialog().getByText("2 entered orders kept")).toBeTruthy();
    expect(dialog().getByText("1 product needs individual review")).toBeTruthy();
    expect(dialog().queryByRole("checkbox")).toBeNull();
    expect((dialog().getByRole("button", { name: "Use 0 suggestions" }) as HTMLButtonElement).disabled).toBe(true);
    expect(apply).not.toHaveBeenCalled();
  });

  it("includes saved supplier terms and requires selection of a supplier quantity above demand", () => {
    const apply = vi.fn();
    render(<Harness terms={{ A: { caseSize: 12, minimumOrder: 36, leadTimeDays: 2 } }} apply={apply} />);
    prepare();
    expect(choice("000101").checked).toBe(false);
    expect(dialog().getByText(/Adjusted from .* for your supplier terms/)).toBeTruthy();
    expect(dialog().getByText(/Case size: 12 · Minimum order: 36 · Lead time \(days\): 2/)).toBeTruthy();
    expect(dialog().getByText(/above the .*four-week range/)).toBeTruthy();
    fireEvent.click(choice("000101")); fireEvent.click(choice("000202"));
    fireEvent.click(dialog().getByRole("button", { name: "Use 1 suggestion" }));
    expect(apply).toHaveBeenCalledWith({ A: expect.objectContaining({ plannedOrder: expect.objectContaining({ value: 36 }) }) });
  });

  it("covers every blank product regardless of search, status or the first twelve rows", () => {
    const original = makeEvidence().snapshot;
    const snapshot = { ...original, rows: Array.from({ length: 15 }, (_, i) => original.rows.filter(row => row.productKey === "A").map(row => ({ ...row, productKey: `P${i}`, interpretedValues: { ...row.interpretedValues, productCode: `00${i}` } }))).flat(),
      productStock: Array.from({ length: 15 }, (_, i) => ({ ...original.productStock[0], productKey: `P${i}` })) };
    const apply = vi.fn();
    render(<Harness data={{ snapshot, forecast: buildDemandForecastReview(snapshot) }} apply={apply} />);
    fireEvent.change(screen.getByLabelText("Search name or code"), { target: { value: "0014" } });
    fireEvent.click(screen.getByLabelText("Only products I am ordering"));
    prepare();
    expect(dialog().getAllByRole("checkbox")).toHaveLength(15);
    fireEvent.click(dialog().getByRole("button", { name: "Use 15 suggestions" }));
    expect(Object.keys(apply.mock.calls[0][0])).toHaveLength(15);
  });

  it("blocks a stale review until refreshed, preserving a quantity entered since preview", () => {
    const data = makeEvidence(), apply = vi.fn(), props = { ...data, selectedKey: "A", onSelect: vi.fn(), onDraftChange: vi.fn(), onDraftsChange: apply, onBack: vi.fn() };
    const rendered = render(<PurchasePlanScreen {...props} drafts={{}} />);
    prepare();
    rendered.rerender(<PurchasePlanScreen {...props} drafts={{ A: { ...blank, plannedOrder: createPurchaseQuantity(7, "input by you") } }} />);
    expect(dialog().getByRole("alert").textContent).toContain("Refresh the review");
    expect((dialog().getByRole("button", { name: "Use 2 suggestions" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(dialog().getByRole("button", { name: "Refresh review" }));
    expect(dialog().getByText("1 entered order kept")).toBeTruthy();
    fireEvent.click(dialog().getByRole("button", { name: "Use 1 suggestion" }));
    expect(Object.keys(apply.mock.calls[0][0])).toEqual(["B"]);
  });

  it("takes an excluded product to its individual plan and clears filters hiding it", () => {
    render(<Harness terms={{ A: { leadTimeDays: 28 } }} />);
    fireEvent.change(screen.getByLabelText("Search name or code"), { target: { value: "000202" } });
    prepare();
    fireEvent.click(dialog().getByText("2 products need individual review"));
    const skipped = dialog().getByText(/Delivery falls outside/).closest("li")!;
    fireEvent.click(within(skipped).getByRole("button", { name: "Review product" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByLabelText("Search name or code") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("region", { name: "Same product name" }).textContent).toContain("000101 · Counted");
  });

  it.each(["zh", "ms"] as const)("translates bulk controls in %s while preserving product identity", language => {
    act(() => setLanguage(language));
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: language === "zh" ? "准备建议订单" : "Sediakan cadangan pesanan" }));
    const modal = screen.getByRole("dialog", { name: language === "zh" ? "查看建议订单" : "Semak cadangan pesanan" });
    expect(within(modal).getByRole("checkbox", { name: /Same product name.*000101/ })).toBeTruthy();
    expect(within(modal).getByRole("button", { name: language === "zh" ? "采用 2 项建议" : "Guna 2 cadangan" })).toBeTruthy();
  });
});

describe("suggestion eligibility", () => {
  it.each([
    [{ leadTimeDays: 28 }, /Delivery falls outside/],
    [{ caseSize: 0 }, /valid whole-number supplier terms/],
    [{ caseSize: 999998, minimumOrder: 999999 }, /above the supported order limit/],
  ] as const)("keeps unsupported supplier suggestions out of the batch (%j)", (terms, reason) => {
    const result = review(makeEvidence(), {}, { A: terms });
    expect(result.suggestions.map(row => row.product.key)).toEqual(["B"]);
    expect(result.skipped.find(row => row.product.key === "A")?.reason).toMatch(reason);
    expect(result.skipped.find(row => row.product.key === "C")).toBeTruthy();
  });

  it("leaves mismatched or stale stock evidence without a draft and retains a genuine zero suggestion", () => {
    const data = makeEvidence();
    data.snapshot = { ...data.snapshot, productStock: data.snapshot.productStock.map(stock => ({ ...stock, ...(stock.productKey === "A" ? { currentStock: 100 } : { stockAsOfDate: "2026-08-01" }) })) };
    const result = review(data);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({ quantity: 0, selectedByDefault: true, inputs: { plannedOrder: { state: "value", value: 0 } } });
    expect(review({ ...data, forecast: { ...data.forecast, snapshotId: "other" } }).suggestions).toHaveLength(0);
  });

  it("leaves an ageing but still usable stock count unselected for an explicit closer review", () => {
    const data = makeEvidence();
    data.snapshot = { ...data.snapshot, productStock: data.snapshot.productStock.map(stock => stock.productKey === "A" ? { ...stock, stockAsOfDate: "2026-09-06" } : stock) };
    expect(review(data).suggestions.find(row => row.product.key === "A")).toMatchObject({ selectedByDefault: false, plan: { audit: { gettingOld: true } } });
  });

  it("respects unavailable expiry adjustments and supplier quantities above the engine's storage cap", () => {
    const data = makeEvidence(), products = joinPurchaseEvidence(data.snapshot, data.forecast);
    const plans = new Map(products.map(product => [product.key, evaluatePurchaseProduct(product, data.snapshot.analysisDate, product.fileInputs, evaluateProductPurchasePlan)]));
    const plan = plans.get("A")!;
    if (plan.estimatedRestock.state !== "available") throw new Error("Expected fixture estimate");
    plans.set("A", { ...plan, estimatedRestock: { ...plan.estimatedRestock, shelfLifeCap: 1 } });
    let result = prepareSuggestedOrders(products, plans, {}, { A: { caseSize: 12 } }, data.snapshot.analysisDate, evaluateProductPurchasePlan);
    expect(result.skipped.find(row => row.product.key === "A")?.reason).toMatch(/exceeds the storage limit/);
    plans.set("A", { ...plan, estimatedRestock: { ...plan.estimatedRestock, afterUnavailableReason: "Cannot tell how much will expire: demand could be zero" } });
    result = prepareSuggestedOrders(products, plans, {}, {}, data.snapshot.analysisDate, evaluateProductPurchasePlan);
    expect(result.skipped.find(row => row.product.key === "A")?.reason).toContain("demand could be zero");
  });
});
