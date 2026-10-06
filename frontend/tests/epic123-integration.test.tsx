import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as XLSX from "xlsx";
import { UploadScreen } from "../src/screens/UploadScreen.tsx";
import { importExcelWorksheet, inspectExcelWorkbook } from "../src/screens/excel-import.ts";
import { MappingScreen } from "../src/screens/MappingScreen.tsx";
import { ProductPurchasePanel } from "../src/purchase-plan/ProductPurchasePanel.tsx";
import { joinPurchaseEvidence } from "../src/purchase-plan/model.ts";
import { setLanguage } from "../src/i18n/index.ts";
import { buildDemandForecastReview, confirmIdentityMode, createMappingState, createPurchaseQuantity, emptyProductPurchaseInputs, evaluateProductPurchasePlan,
  parseCsvBytes, previousCompleteWeekStarts, runReadinessCheck, setMapping, type ProductPurchaseInputs } from "../src/engine.ts";

beforeEach(() => setLanguage("en"));
function workbook() {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Date", "SKU", "Quantity"], ["2026-09-28", "FIRST", 1]]), "First");
  const sheet = XLSX.utils.aoa_to_sheet([["Date", "SKU", "Quantity"], ["2026-09-28", "SECOND", 7]]);
  XLSX.utils.book_append_sheet(book, sheet, "Second");
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }));
}

it("US1.3 requires a worksheet choice and sends only the chosen records with original provenance", async () => {
  const bytes = workbook(); const file = new File([bytes], "two-sheets.xlsx");
  Object.defineProperty(file, "stream", { value: () => new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }) });
  const onSource = vi.fn(async () => {});
  render(<UploadScreen onSource={onSource} onCancel={() => {}} />);
  fireEvent.change(screen.getByLabelText("Choose CSV or Excel file"), { target: { files: [file] } });
  const choice = await screen.findByRole("combobox", { name: "Worksheet" });
  expect((screen.getByRole("button", { name: "Continue to matching →" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(choice, { target: { value: "Second" } });
  expect(within(screen.getByRole("region", { name: "Worksheet preview" })).getByText("SECOND")).toBeTruthy();
  expect(screen.queryByText("FIRST")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Continue to matching →" }));
  await waitFor(() => expect(onSource).toHaveBeenCalledOnce());
  const call = onSource.mock.calls[0] as unknown as Parameters<import("react").ComponentProps<typeof UploadScreen>["onSource"]>;
  expect(call[6]?.worksheetName).toBe("Second"); expect(call[6]?.sourceRowNumbers).toEqual([2]);
  const parsed = await parseCsvBytes(call[0], { sourceName: call[1], sourceMode: "user", mimeType: call[3], sourceMetadata: call[6] });
  expect(parsed.rows.map(row => row.normalizedValues[1])).toEqual(["SECOND"]);
});

it("US1.3 preserves real worksheet row numbers across blank rows and leading zeros", async () => {
  const sheet = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.sheet_add_aoa(sheet, [["Date", "SKU", "Quantity"], ["2026-09-28", 101, 2]], { origin: "A3" });
  sheet.B4.z = "000000";
  XLSX.utils.sheet_add_aoa(sheet, [["2026-09-29", "000102", 3]], { origin: "A7" });
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Sales");
  const bytes = new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }));
  const imported = await importExcelWorksheet(bytes, "offset.xlsx", "Sales");
  expect(imported.sourceMetadata.headerRow).toBe(3); expect(imported.sourceMetadata.sourceRowNumbers).toEqual([4,7]);
  const parsed = await parseCsvBytes(imported.bytes, { sourceMode: "user", sourceName: "offset.xlsx", mimeType: "text/csv;converted-from=excel", sourceMetadata: imported.sourceMetadata });
  expect(parsed.rows[0].originalValues[1]).toBe("000101"); expect(parsed.rows[1].sourceRow).toBe(7);
});

it("US1.3 explains empty and merged-header sheets without substituting another worksheet", async () => {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([["Sales report", "", ""], ["2026-09-28", "A", 2]]); sheet["!merges"] = [{ s: {r:0,c:0}, e:{r:0,c:2} }];
  XLSX.utils.book_append_sheet(book, sheet, "Merged"); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Date","SKU","Quantity"]]), "Header only");
  const bytes = new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }));
  const sheets = await inspectExcelWorkbook(bytes, "bad.xlsx"); expect(sheets.every(sheet => sheet.problem)).toBe(true);
  await expect(importExcelWorksheet(bytes, "bad.xlsx", "Merged")).rejects.toThrow(/Merged header/);
});

async function costEvidence(cost = "2.50") {
  const dates = previousCompleteWeekStarts("2026-10-06");
  const dataset = await parseCsvBytes(new TextEncoder().encode(["Date,SKU,Quantity,Stock,Stock date,Unit Cost", ...dates.map(date => `${date},A,10,0,2026-10-05,${cost}`)].join("\n")), { sourceMode: "user", sourceName: "cost.csv" });
  let mapping = createMappingState();
  for (const [i, field] of (["transaction_date", "product_code", "quantity_sold", "current_stock", "stock_as_of_date", "unit_cost"] as const).entries()) mapping = setMapping(mapping, field, `column-${i}`, true);
  mapping = confirmIdentityMode(mapping, "stable");
  const snapshot = await runReadinessCheck(dataset, mapping, { analysisDate: "2026-10-06" });
  return { dataset, mapping, snapshot, forecast: buildDemandForecastReview(snapshot) };
}

it("US1.4 exposes optional cost matching and its actual preview", async () => {
  const { dataset, mapping } = await costEvidence();
  render(<MappingScreen dataset={dataset} mapping={mapping} proposals={null} onSelectColumn={() => {}} onSelectIdentity={() => {}} onBack={() => {}} onConfirmAllAndContinue={() => {}} error={null} notice={null} />);
  const cost = screen.getByRole("combobox", { name: "Source column for Unit cost" }) as HTMLSelectElement;
  expect(cost.disabled).toBe(false); expect(cost.value).toBe("column-5");
  expect(cost.closest(".mapping-row")?.textContent).toContain("2.50 · 2.50 · 2.50 · 2.50 · 2.50");
});

it("US2.1 Step 4 displays validated costs, preserves zero and excludes invalid costs and empty orders", async () => {
  const { snapshot, forecast } = await costEvidence();
  const product = joinPurchaseEvidence(snapshot, forecast)[0];
  const inputs = { ...emptyProductPurchaseInputs(), plannedOrder: createPurchaseQuantity(40, "input by you") };
  const plan = evaluateProductPurchasePlan(product.demand!, { stock: product.stock, analysisDate: snapshot.analysisDate, inputs });
  const { rerender } = render(<ProductPurchasePanel product={product} plan={plan} inputs={inputs} analysisDate={snapshot.analysisDate} terms={{}} onTermsChange={() => {}} onChange={() => {}} onReviewData={() => {}} total={1} onDone={() => {}} />);
  expect(within(screen.getByRole("region", { name: "Estimated purchase spending" })).getByText(/MYR 100.00/)).toBeTruthy();
  const showSpending = (evidence: typeof snapshot, demand: typeof forecast, purchaseInputs: ProductPurchaseInputs = inputs) => {
    const nextProduct = joinPurchaseEvidence(evidence, demand)[0];
    const nextPlan = evaluateProductPurchasePlan(nextProduct.demand!, { stock: nextProduct.stock, analysisDate: evidence.analysisDate, inputs: purchaseInputs });
    rerender(<ProductPurchasePanel product={nextProduct} plan={nextPlan} inputs={purchaseInputs} analysisDate={evidence.analysisDate} terms={{}} onTermsChange={() => {}} onChange={() => {}} onReviewData={() => {}} total={1} onDone={() => {}} />);
    return within(screen.getByRole("region", { name: "Estimated purchase spending" }));
  };
  const zero = await costEvidence("0");
  expect(showSpending(zero.snapshot, zero.forecast).getByText(/MYR 0.00/)).toBeTruthy();
  const invalid = await costEvidence("invalid");
  const unavailable = showSpending(invalid.snapshot, invalid.forecast);
  expect(unavailable.getByText("Unavailable")).toBeTruthy();
  expect(unavailable.queryByText(/MYR \d/)).toBeNull();
  const unentered = showSpending(snapshot, forecast, emptyProductPurchaseInputs());
  expect(unentered.getByText("Not entered")).toBeTruthy();
  expect(unentered.queryByText(/MYR \d/)).toBeNull();
});
