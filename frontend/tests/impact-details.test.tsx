import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ProductPurchasePanel } from "../src/purchase-plan/ProductPurchasePanel.tsx";
import { joinPurchaseEvidence } from "../src/purchase-plan/model.ts";
import { ImpactDashboard } from "../src/screens/ImpactDashboard.tsx";
import { emptyProductPurchaseInputs, evaluateProductPurchasePlan, type ProductPlanningContext } from "../src/engine.ts";
import { setLanguage } from "../src/i18n/index.ts";
import { makeEvidence } from "./fixtures.ts";

beforeEach(() => setLanguage("en"));

describe("optional impact details", () => {
  function panel(withValues: boolean) {
    const data = makeEvidence();
    const snapshot = { ...data.snapshot, evidenceKey: "optional-impact", productCosts: withValues ? [
      { productKey: "A", field: "unit_cost" as const, state: "usable" as const, value: 8.9, sourceRows: [2] },
    ] : [], productWeights: withValues ? [
      { productKey: "A", field: "unit_weight_kg" as const, state: "usable" as const, value: 0.48, sourceRows: [2] },
    ] : [] };
    const context: ProductPlanningContext = { evidenceKey: snapshot.evidenceKey, noExpiry: true, ...(withValues ? { category: "margarine", categorySource: "ai" as const, categoryConfirmed: true, isFood: true } : {}) };
    const product = joinPurchaseEvidence(snapshot, data.forecast, { A: context })[0];
    const inputs = emptyProductPurchaseInputs();
    const plan = evaluateProductPurchasePlan(product.demand!, { analysisDate: snapshot.analysisDate, stock: product.stock, inputs });
    const onDone = vi.fn(), onImpact = vi.fn(), onPlanningChange = vi.fn();
    render(<ProductPurchasePanel product={product} plan={plan} inputs={inputs} analysisDate={snapshot.analysisDate} terms={{}} onTermsChange={() => {}} onChange={() => {}} onReviewData={() => {}} onPlanningChange={onPlanningChange} onDone={onDone} onImpact={onImpact} total={3} />);
    return { onDone, onImpact, onPlanningChange };
  }

  it("shows available file values and an automatic category without requiring confirmations", () => {
    const { onDone, onImpact, onPlanningChange } = panel(true);
    const details = within(screen.getByRole("region", { name: "Impact dashboard details" }));
    expect(details.getByText("Purchase cost · MYR 8.90")).toBeTruthy();
    expect(details.getByText("Food category · Margarine")).toBeTruthy();
    expect(details.getByText("Weight per unit · 0.48 kg")).toBeTruthy();
    expect(details.queryByText(/confirmed|Source|From your file/)).toBeNull();
    fireEvent.click(details.getByRole("button", { name: "View impact dashboard →" }));
    expect(onImpact).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Done, next product →" }));
    expect(onDone).toHaveBeenCalledOnce();
    expect(onPlanningChange).not.toHaveBeenCalled();
  });

  it("allows moving on with missing impact details and offers optional edits", () => {
    const { onDone, onPlanningChange } = panel(false);
    const details = within(screen.getByRole("region", { name: "Impact dashboard details" }));
    expect(details.getAllByText(/Not available/)).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Done, next product →" }));
    expect(onDone).toHaveBeenCalledOnce();
    fireEvent.click(details.getByRole("button", { name: "Edit details" }));
    expect(details.getByText("Details used for these estimates")).toBeTruthy();
    fireEvent.click(details.getByRole("button", { name: "Change Purchase cost" }));
    fireEvent.change(details.getByLabelText("Your purchase cost for one unit (MYR)"), { target: { value: "5.75" } });
    fireEvent.click(details.getByRole("button", { name: "Next →" }));
    expect(onPlanningChange).toHaveBeenLastCalledWith(expect.objectContaining({ unitCost: 5.75, noExpiry: true }));
    fireEvent.click(details.getByRole("button", { name: "Close details" }));
    expect(details.getByRole("button", { name: "View impact dashboard →" })).toBeTruthy();
  });

  it("routes the dashboard missing-details list to the specific product", () => {
    const onProductDetails = vi.fn();
    const data = makeEvidence();
    const snapshot = { ...data.snapshot, evidenceKey: "missing-details" };
    render(<ImpactDashboard snapshot={snapshot} forecast={data.forecast} drafts={{}} onBack={() => {}} onProductDetails={onProductDetails} />);
    const summary = screen.getByText(/Review products with missing details/);
    fireEvent.click(summary);
    const missing = within(summary.closest("details")!);
    expect(missing.getByText(/You can keep planning without filling these in/)).toBeTruthy();
    fireEvent.click(missing.getByRole("button", { name: /Add details for.*000101/ }));
    expect(onProductDetails).toHaveBeenCalledWith("A");
    expect(missing.queryByText("Few records")).toBeNull();
  });
});
