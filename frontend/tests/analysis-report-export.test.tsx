import { expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { AnalysisReport } from "../src/engine.ts";
import { buildAnalysisWorkbookBytes, NoFinalisedOrdersError, renderAnalysisReportHtml } from "../src/purchase-plan/analysis-report-export.ts";

function report(): AnalysisReport {
  return {
    schemaVersion: 1,
    metadata: { shopName: "小店 <script>alert(1)</script>", datasetId: "D", datasetName: "October", sourceName: "sales.csv", sourceSha256: "abc123", sourceMode: "sample", sourceLabel: "Sample data", analysisDate: "2026-10-06", period: { start: "2026-09-01", end: "2026-10-06" }, generatedAt: "2026-10-08T00:00:00.000Z", snapshotId: "S", currency: "MYR" },
    tables: [
      { id: "metadata", title: "Metadata", columns: ["Field", "Value"], rows: [["Data source", "Sample data"]] },
      { id: "results", title: "Product Results", columns: ["Product name", "Product code", "Pack size", "Planned quantity"], rows: [["=HYPERLINK(\"https://example.invalid\")", "000101", "500 g", 0], ["Roti <img src=x onerror=alert(1)>", "000102", "250 g", "Not entered"]] },
      { id: "decisions", title: "Saved Decisions", columns: ["Original recommendation", "Final quantity"], rows: [[40, 0]] },
      { id: "outcomes", title: "Recorded Outcomes", columns: ["Quantity"], rows: [[0]] },
      { id: "finalorders", title: "Finalised Orders", columns: ["Product code", "Final quantity"], rows: [["000102", 10]] },
    ],
    limitations: ["Sample data; estimates < outcomes."]
  };
}

it("writes an actual XLSX workbook with textual SKU/formula-like cells and numeric zero", async () => {
  const bytes = await buildAnalysisWorkbookBytes(report());
  expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]);
  const book = XLSX.read(bytes, { type: "array" });
  expect(book.SheetNames).toEqual(["Metadata", "Product Results", "Saved Decisions", "Recorded Outcomes", "Finalised Orders"]);
  const sheet = book.Sheets["Product Results"];
  expect(sheet.A2.t).toBe("s"); expect(sheet.A2.f).toBeUndefined();
  expect(sheet.A2.v).toBe('=HYPERLINK("https://example.invalid")');
  expect(sheet.B2.t).toBe("s"); expect(sheet.B2.v).toBe("000101");
  expect(sheet.D2.t).toBe("n"); expect(sheet.D2.v).toBe(0);
  expect(sheet.D3.v).toBe("Not entered");
});

it("exports only metadata and the positive final-order table; empty final orders show an actionable error", async () => {
  const bytes = await buildAnalysisWorkbookBytes(report(), { finalOrdersOnly: true });
  const book = XLSX.read(bytes, { type: "array" });
  expect(book.SheetNames).toEqual(["Metadata", "Finalised Orders"]);
  const source = report();
  const empty = { ...source, tables: source.tables.map(table => table.id === "finalorders" ? { ...table, rows: [] } : table) };
  await expect(buildAnalysisWorkbookBytes(empty, { finalOrdersOnly: true })).rejects.toBeInstanceOf(NoFinalisedOrdersError);
});

it("print summary escapes all supplied text, preserves Unicode, labels source and keeps zero decisions", () => {
  const html = renderAnalysisReportHtml(report());
  expect(html).toContain("小店 &lt;script&gt;alert(1)&lt;/script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img src=x");
  expect(html).toContain("Roti &lt;img src=x onerror=alert(1)&gt;");
  expect(html).toContain("Sample data");
  expect(html).toContain("2026-09-01 to 2026-10-06");
  expect(html).toContain("Saved Decisions");
  expect(html).toContain("<td>40</td><td>0</td>");
  expect(html).toContain("Save as PDF");
  expect(html).toContain("<meta charset=\"utf-8\">");
});
