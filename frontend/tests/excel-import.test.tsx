import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as XLSX from "xlsx";
import { excelToCsvBytes } from "../src/screens/excel-import.ts";
import { UploadScreen } from "../src/screens/UploadScreen.tsx";
import { parseCsvBytes } from "../src/engine.ts";

describe("Excel sales import", () => {
  for (const bookType of ["xlsx", "xls"] as const) {
    it(`preserves dates and formatted product codes from .${bookType}`, async () => {
      const sheet = XLSX.utils.aoa_to_sheet([
        ["Sale date", "Product code", "Quantity sold"],
        [new Date("2026-09-20T00:00:00Z"), 101, 3],
      ]);
      sheet.B2.z = "000000";
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Sales");
      const file = XLSX.write(book, { type: "array", bookType, cellDates: true });
      const converted = await excelToCsvBytes(new Uint8Array(file), `sales.${bookType}`);
      const parsed = await parseCsvBytes(converted, { sourceMode: "user", sourceName: `sales.${bookType}`, mimeType: "text/csv;converted-from=excel" });
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0].originalValues).toContain("000101");
      expect(parsed.rows[0].originalValues[0]).toBe("2026-09-20");
    });
  }

  it("uses the first nonempty worksheet and explains an empty workbook", async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([]), "Empty");
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["SKU", "Quantity"], ["A1", 2]]), "Sales");
    const bytes = new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }));
    expect(new TextDecoder().decode(await excelToCsvBytes(bytes, "sales.xlsx"))).toContain("A1,2");
    const empty = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(empty, XLSX.utils.aoa_to_sheet([]), "Empty");
    await expect(excelToCsvBytes(new Uint8Array(XLSX.write(empty, { type: "array", bookType: "xlsx" })), "empty.xlsx"))
      .rejects.toThrow(/No data found/);
  });

  it("sends an uploaded workbook through the existing CSV importer with its original name", async () => {
    const sheet = XLSX.utils.aoa_to_sheet([["Sale date", "Product code", "Quantity sold"], ["2026-09-20", "000101", 3]]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Sales");
    const bytes = new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }));
    const file = new File([bytes], "retailer.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    Object.defineProperty(file, "stream", { value: () => new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }) });
    const onSource = vi.fn(async (converted: Uint8Array, sourceName: string, _mode: string, mimeType: string | undefined) => {
      const dataset = await parseCsvBytes(converted, { sourceMode: "user", sourceName, mimeType });
      expect(dataset.rows[0].originalValues).toContain("000101");
    });
    render(<UploadScreen onSource={onSource} onCancel={() => {}} />);
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(onSource).not.toHaveBeenCalled();
    expect(screen.getByText("retailer.xlsx")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue to matching →" }));
    await waitFor(() => expect(onSource).toHaveBeenCalledOnce());
    expect(onSource.mock.calls[0][1]).toBe("retailer.xlsx");
    expect(onSource.mock.calls[0][3]).toBe("text/csv;converted-from=excel");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
