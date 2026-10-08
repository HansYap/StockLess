import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DecisionOutcomeControls, malaysiaToday } from "../src/components/DecisionOutcomeControls.tsx";
import { createPurchaseDecision, DecisionValidationError, evaluateProductPurchasePlan } from "../src/engine.ts";
import { setLanguage } from "../src/i18n/index.ts";
import { getSavedDataset, savePurchaseDecision, saveStockOutcome, removeSavedDecision } from "../src/storage/saved-datasets.ts";
import { makeEvidence } from "./fixtures.ts";
vi.mock("../src/storage/saved-datasets.ts", async importOriginal => ({
  ...await importOriginal<typeof import("../src/storage/saved-datasets.ts")>(),
  getSavedDataset: vi.fn(), savePurchaseDecision: vi.fn(), saveStockOutcome: vi.fn(), removeSavedDecision: vi.fn(),
}));
beforeEach(() => { setLanguage("en"); vi.clearAllMocks(); vi.mocked(getSavedDataset).mockResolvedValue(undefined); });
function props() {
  const evidence = makeEvidence();
  return { datasetId: "dataset-1", snapshot: evidence.snapshot, product: { key: "A", title: "Tea", sku: "0001", pack: "250 g" },
    plan: evaluateProductPurchasePlan(evidence.forecast.products[0], { analysisDate: evidence.snapshot.analysisDate, stock: evidence.snapshot.productStock[0] }) };
}
it("uses Malaysia date and does not save decisions merely by opening the controls", async () => {
  expect(malaysiaToday(new Date("2026-10-07T17:00:00Z"))).toBe("2026-10-08");
  render(<DecisionOutcomeControls {...props()} />);
  await waitFor(() => expect(getSavedDataset).toHaveBeenCalled());
  expect(savePurchaseDecision).not.toHaveBeenCalled(); expect(saveStockOutcome).not.toHaveBeenCalled();
  expect(screen.getByText("No outcome recorded.")).toBeTruthy();
});
it("only saves an explicit choice and supplies frozen source, labels and policy evidence", async () => {
  vi.mocked(savePurchaseDecision).mockResolvedValue(undefined as never);
  const input = props(); render(<DecisionOutcomeControls {...input} />);
  fireEvent.change(screen.getByLabelText("Response"), { target: { value: "Changed" } });
  fireEvent.change(screen.getByLabelText("Final quantity"), { target: { value: "6" } });
  fireEvent.change(screen.getByLabelText("Reason (optional)"), { target: { value: "Shelf space" } });
  fireEvent.change(screen.getByLabelText("Supplier (optional)"), { target: { value: "Local supplier" } });
  fireEvent.click(screen.getByRole("button", { name: "Save decision" }));
  await waitFor(() => expect(savePurchaseDecision).toHaveBeenCalledOnce());
  expect(vi.mocked(savePurchaseDecision).mock.calls[0]).toEqual(["dataset-1", expect.objectContaining({ response: "Changed", finalQuantity: "6", reason: "Shelf space", supplier: "Local supplier",
    recommendation: expect.objectContaining({ productKey: "A", productName: "Tea", productCode: "0001", packSize: "250 g", sourceSha256: input.snapshot.sourceSha256, policyVersion: input.plan.purchasePolicyVersion }) })]);
});
it("keeps invalid input visible after a typed validation failure and translates the correction", async () => {
  setLanguage("zh");
  vi.mocked(savePurchaseDecision).mockRejectedValue(new DecisionValidationError({ finalQuantity: "Bad quantity" }));
  render(<DecisionOutcomeControls {...props()} />);
  fireEvent.change(screen.getByLabelText("回应"), { target: { value: "Ignored" } });
  fireEvent.change(screen.getByLabelText("最终数量"), { target: { value: "bad" } });
  fireEvent.click(screen.getByRole("button", { name: "保存决定" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("请修正数量"));
  expect((screen.getByLabelText("最终数量") as HTMLInputElement).value).toBe("bad");
});
it("records actual zero separately and requires confirmation before deleting a decision", async () => {
  const input = props();
  const decision = createPurchaseDecision({ id: "saved", datasetId: "dataset-1", response: "Followed", referenceDate: "2026-10-08", recordedAt: "2026-10-08T10:00:00Z",
    recommendation: { productKey: "A", productName: "Tea", sourceName: "sales.csv", sourceSha256: "hash", sourceMode: "user", analysisDate: "2026-09-14", policyVersion: "cp3-v2", recommendedQuantity: 12, quantityUnit: "pieces" } });
  vi.mocked(getSavedDataset).mockResolvedValue({ decisions: [{ id: "saved", purchaseDecision: decision }], outcomes: [] } as never);
  vi.mocked(saveStockOutcome).mockResolvedValue(undefined as never);
  render(<DecisionOutcomeControls {...input} />);
  await screen.findByRole("button", { name: "Delete decision" });
  fireEvent.change(screen.getByLabelText("Recorded quantity"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Save actual outcome" }));
  await waitFor(() => expect(saveStockOutcome).toHaveBeenCalledWith("dataset-1", expect.objectContaining({ quantity: "0", kind: "discarded", unit: "pieces", productKey: "A" })));
  fireEvent.click(screen.getByRole("button", { name: "Delete decision" }));
  expect(removeSavedDecision).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(removeSavedDecision).not.toHaveBeenCalled();
});
