import { expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { AnalysisReport } from "../src/engine.ts";
import { buildAnalysisWorkbookBytes, NoPlannedOrdersError, renderAnalysisReportHtml } from "../src/purchase-plan/analysis-report-export.ts";

function report(): AnalysisReport {
  return {
    schemaVersion: 1,
    metadata: { shopName: "小店 <script>alert(1)</script>", datasetId: "D", datasetName: "October", sourceName: "sales.csv", sourceSha256: "abc123", sourceMode: "sample", sourceLabel: "Sample data", analysisDate: "2026-10-06", period: { start: "2026-09-01", end: "2026-10-06" }, generatedAt: "2026-10-08T00:00:00.000Z", snapshotId: "S", currency: "MYR" },
    tables: [
      { id: "metadata", title: "Metadata", columns: ["Field", "Value"], rows: [["Data source", "Sample data"]] },
      { id: "results", title: "Product Results", columns: ["Product name", "Product code", "Pack size", "Planned quantity"], rows: [["=HYPERLINK(\"https://example.invalid\")", "000101", "500 g", 0], ["Roti <img src=x onerror=alert(1)>", "000102", "250 g", "Not entered"]] },
      { id: "outcomes", title: "Recorded Outcomes", columns: ["Quantity"], rows: [[0]] },
      { id: "orders", title: "Purchase Orders", columns: ["Product code", "Planned quantity"], rows: [["000102", 10]] },
    ],
    limitations: ["Sample data; estimates < outcomes."]
  };
}

it("writes an actual XLSX workbook with textual SKU/formula-like cells and numeric zero", async () => {
  const bytes = await buildAnalysisWorkbookBytes(report());
  expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]);
  const book = XLSX.read(bytes, { type: "array" });
  expect(book.SheetNames).toEqual(["Metadata", "Product Results", "Recorded Outcomes", "Purchase Orders"]);
  const sheet = book.Sheets["Product Results"];
  expect(sheet.A2.t).toBe("s"); expect(sheet.A2.f).toBeUndefined();
  expect(sheet.A2.v).toBe('=HYPERLINK("https://example.invalid")');
  expect(sheet.B2.t).toBe("s"); expect(sheet.B2.v).toBe("000101");
  expect(sheet.D2.t).toBe("n"); expect(sheet.D2.v).toBe(0);
  expect(sheet.D3.v).toBe("Not entered");
});

it("exports only metadata and the current order table; empty planned orders show an actionable error", async () => {
  const bytes = await buildAnalysisWorkbookBytes(report(), { plannedOrdersOnly: true });
  const book = XLSX.read(bytes, { type: "array" });
  expect(book.SheetNames).toEqual(["Metadata", "Purchase Orders"]);
  const source = report();
  const empty = { ...source, tables: source.tables.map(table => table.id === "orders" ? { ...table, rows: [] } : table) };
  await expect(buildAnalysisWorkbookBytes(empty, { plannedOrdersOnly: true })).rejects.toBeInstanceOf(NoPlannedOrdersError);
});

it("print summary escapes all supplied text, preserves Unicode, labels source and keeps zero planned quantities", () => {
  const html = renderAnalysisReportHtml(report());
  expect(html).toContain("小店 &lt;script&gt;alert(1)&lt;/script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img src=x");
  expect(html).toContain("Roti &lt;img src=x onerror=alert(1)&gt;");
  expect(html).toContain("Sample data");
  expect(html).toContain("2026-09-01 to 2026-10-06");
  expect(html).not.toContain("Saved Decisions");
  expect(html).toContain("<td>0</td>");
  expect(html).toContain("Save as PDF");
  expect(html).toContain("<meta charset=\"utf-8\">");
});

it("prints weekly bars as SVG shapes while keeping missing weeks and zero sales distinct", () => {
  const source = report();
  const history = { id: "history", title: "Weekly Demand History", columns: ["Product name", "Product code", "Pack size", "Product key", "Week start", "Week end", "Positive sales"], rows: [
    ["Milo 3in1", "MM0002", "15 sticks", "ID|MM0002", "2026-09-14", "2026-09-20", 4],
    ["Milo 3in1", "MM0002", "15 sticks", "ID|MM0002", "2026-09-21", "2026-09-27", "Missing"],
    ["Milo 3in1", "MM0002", "15 sticks", "ID|MM0002", "2026-09-28", "2026-10-04", 0],
  ] };
  const html = renderAnalysisReportHtml({ ...source, tables: [...source.tables, history] });
  expect(html).toContain('<svg class="bar-chart"');
  expect(html).toContain('fill="#167D74"');
  expect(html).toContain('<span class="bar-value">-</span>');
  expect(html).toContain('<span class="bar-value">0</span>');
  expect(html).toContain('PEAK 4 · 2/3 WEEKS RECORDED');
  expect(html).toContain('Bars use a separate scale for each product');
  expect(html).toContain('is-latest');
  expect(html).toContain('report/stocky-hello.svg');
  expect(html).not.toContain("<i style=");
});
