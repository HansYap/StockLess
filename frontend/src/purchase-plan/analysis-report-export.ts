import type { AnalysisReport, AnalysisReportCell, AnalysisReportTable } from "../engine.ts";

export function analysisReportFilename(report: AnalysisReport, kind: "analysis" | "finalised-orders", extension: string): string {
  const source = report.metadata.sourceMode === "sample" ? "-SAMPLE" : "";
  return `stockless${source}-${kind}-${report.metadata.generatedAt.slice(0, 10)}.${extension}`;
}
export class NoFinalisedOrdersError extends Error {
  constructor() { super("No finalised orders. Return to planning and save a positive final quantity."); this.name = "NoFinalisedOrdersError"; }
}
function selectedTables(report: AnalysisReport, finalOrdersOnly: boolean): readonly AnalysisReportTable[] {
  if (!finalOrdersOnly) return report.tables;
  const orders = report.tables.find(table => table.id === "finalorders");
  if (!orders?.rows.length) throw new NoFinalisedOrdersError();
  return report.tables.filter(table => ["metadata", "finalorders", "limitations"].includes(table.id));
}

/** Explicit string cells prevent formulas and preserve codes such as 000101 verbatim. */
export async function buildAnalysisWorkbookBytes(report: AnalysisReport, options: { readonly finalOrdersOnly?: boolean } = {}): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  for (const table of selectedTables(report, options.finalOrdersOnly ?? false)) {
    const sheet: import("xlsx").WorkSheet = {};
    const rows: readonly (readonly AnalysisReportCell[])[] = [table.columns, ...table.rows];
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
      const value = rows[r][c];
      if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Report contains an unsupported numeric value.");
      if (typeof value === "string" && value.length > 32767) throw new Error("A report cell is too long for Excel. Reduce conflicting source labels and try again.");
      sheet[XLSX.utils.encode_cell({ r, c })] = typeof value === "number" ? { t: "n", v: value }
        : typeof value === "boolean" ? { t: "b", v: value } : { t: "s", v: value, z: "@" };
    }
    sheet["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, rows.length - 1), c: table.columns.length - 1 } });
    sheet["!cols"] = table.columns.map((label, index) => ({ wch: Math.min(60, Math.max(16, label.length + 2, ...table.rows.slice(0, 50).map(row => String(row[index]).length))) }));
    if (table.rows.length) sheet["!autofilter"] = { ref: sheet["!ref"]! };
    XLSX.utils.book_append_sheet(book, sheet, table.title.slice(0, 31));
  }
  book.Props = { Title: `StockLess ${report.metadata.sourceLabel} report`, Subject: report.metadata.datasetName,
    Author: "StockLess", Comments: report.limitations.join("\n"), CreatedDate: new Date(report.metadata.generatedAt) };
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx", compression: true }));
}
export function downloadReportBytes(bytes: Uint8Array, name: string, mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"): void {
  const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: mime }));
  const link = document.createElement("a"); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadAnalysisWorkbook(report: AnalysisReport): Promise<void> {
  downloadReportBytes(await buildAnalysisWorkbookBytes(report), analysisReportFilename(report, "analysis", "xlsx"));
}
export async function downloadFinalisedOrdersWorkbook(report: AnalysisReport): Promise<void> {
  downloadReportBytes(await buildAnalysisWorkbookBytes(report, { finalOrdersOnly: true }), analysisReportFilename(report, "finalised-orders", "xlsx"));
}

const escapeHtml = (value: AnalysisReportCell): string => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const SUMMARY_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  results: ["Product name", "Product code", "Pack size", "Readiness", "Demand low (4 weeks)", "Demand high (4 weeks)", "Planned quantity", "Restock recommendation", "Purchase check", "Purchase explanation", "Restock limitation"],
  impact: ["Product name", "Product code", "Planned spend (MYR)", "Combined commitment (MYR)", "Excess-stock cost (MYR)", "Scenario spend (MYR)", "Estimated purchase-spend difference (MYR)", "Exclusion or limitation"],
  scenarios: ["Product name", "Product code", "Supplier", "Case size", "Minimum order", "Lead time (days)", "Scenario quantity", "Arrival date", "Status", "Reason"],
  decisions: ["Product name", "Product code", "Pack size", "Response", "Original recommendation", "Final quantity", "Decision date", "Reason", "Original source file", "Original analysis date"],
  outcomes: ["Product name", "Product code", "Kind", "Date", "Recorded quantity", "Unit", "Conversion source", "Description"],
  finalorders: ["Product name", "Product code", "Pack size", "Final quantity", "Quantity unit", "Supplier", "Decision date", "Restock date", "Source"],
};
export function compactSummary(table: AnalysisReportTable): AnalysisReportTable {
  const wanted = SUMMARY_COLUMNS[table.id];
  if (!wanted) return table;
  const indices = wanted.map(label => table.columns.indexOf(label)).filter(index => index >= 0);
  return { ...table, columns: indices.map(index => table.columns[index]), rows: table.rows.map(row => indices.map(index => row[index])) };
}
function carbonCards(table: AnalysisReportTable): string {
  if (!table.rows.length) return htmlTable(table);
  return `<section><h2>${escapeHtml(table.title)}</h2>${table.rows.map(row => `<article class="carbon-card"><dl>${table.columns.map((label, i) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(row[i])}</dd>`).join("")}</dl></article>`).join("")}</section>`;
}
function htmlTable(table: AnalysisReportTable): string {
  return `<section><h2>${escapeHtml(table.title)}</h2>${table.rows.length ? `<div class="table-wrap"><table><thead><tr>${table.columns.map(label => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${table.rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : `<p>${table.id === "finalorders" ? "No finalised orders. Return to planning and save a positive final quantity." : table.id === "outcomes" ? "No outcome recorded." : "No records available for this section."}</p>`}</section>`;
}
function demandCharts(report: AnalysisReport): string {
  const history = report.tables.find(table => table.id === "history");
  if (!history) return "";
  const grouped = new Map<string, (readonly AnalysisReportCell[])[]>();
  for (const row of history.rows) { const key = String(row[3]); const rows = grouped.get(key) ?? []; rows.push(row); grouped.set(key, rows); }
  return `<section><h2>Recorded weekly positive sales</h2><p>Returns stay separate. A missing week is labelled missing; a recorded zero remains zero.</p>${[...grouped.values()].slice(0, 12).map(rows => {
    const recent = rows.slice(-8), max = Math.max(1, ...recent.flatMap(row => typeof row[6] === "number" ? [row[6]] : []));
    return `<figure><figcaption>${escapeHtml(rows[0][0])} · ${escapeHtml(rows[0][1])} · ${escapeHtml(rows[0][2])}</figcaption><div class="bars">${recent.map(row => `<div class="bar-item"><span>${escapeHtml(row[6])}</span><i style="height:${typeof row[6] === "number" ? Math.max(0, row[6] / max * 80) : 0}px"></i><small>${escapeHtml(row[4])}</small></div>`).join("")}</div></figure>`;
  }).join("")}${grouped.size > 12 ? "<p>Charts show the first 12 products; the Excel workbook contains every product's complete sales and weekly history.</p>" : ""}</section>`;
}

/** Print-ready Unicode HTML. PDF is produced by the browser's Print / Save as PDF dialog. */
export function renderAnalysisReportHtml(report: AnalysisReport): string {
  const summaryTables = report.tables.filter(table => !["metadata", "sales", "history", "evidence", "limitations"].includes(table.id));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(analysisReportFilename(report, "analysis", "pdf"))}</title><style>
    body{font:12px/1.45 system-ui,"Arial Unicode MS",sans-serif;color:#14211a;margin:24px}h1{font-size:24px}h2{font-size:17px;margin-top:24px}p,li{max-width:95ch}.source{font-weight:700}.table-wrap{overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;font-size:9px;table-layout:auto}th,td{border:1px solid #cad3cc;padding:5px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eef5ee}thead{display:table-header-group}tr{break-inside:avoid}figure{display:inline-block;width:46%;margin:12px 2% 12px 0;break-inside:avoid}figcaption{font-weight:600}.bars{display:flex;align-items:flex-end;gap:4px;height:130px}.bar-item{flex:1;text-align:center;display:flex;flex-direction:column;justify-content:flex-end;height:130px}.bar-item i{display:block;background:#38664d;min-height:0}.bar-item small{font-size:8px;white-space:nowrap}.print-help{padding:12px;background:#eef5ee}.carbon-card{border:1px solid #cad3cc;padding:8px;margin:8px 0;break-inside:avoid}.carbon-card dl{display:grid;grid-template-columns:150px 1fr;gap:3px 10px;margin:0}.carbon-card dt{font-weight:600}.carbon-card dd{margin:0;overflow-wrap:anywhere}@page{size:A4 landscape;margin:12mm}@media print{body{margin:0}.print-help{display:none}section{break-inside:auto}a{color:inherit;text-decoration:none}}
    </style></head><body><h1>StockLess analysis report</h1><p class="source">${escapeHtml(report.metadata.sourceLabel)}</p><p>Shop: ${escapeHtml(report.metadata.shopName)} · Dataset: ${escapeHtml(report.metadata.datasetName)}<br>Source: ${escapeHtml(report.metadata.sourceName)}<br>Reporting period: ${escapeHtml(report.metadata.period.start)} to ${escapeHtml(report.metadata.period.end)} · Analysis date: ${escapeHtml(report.metadata.analysisDate)}<br>Generated: ${escapeHtml(report.metadata.generatedAt)}<br>Source SHA-256: ${escapeHtml(report.metadata.sourceSha256)}</p><p class="print-help">Use your browser's Print dialog and select “Save as PDF” to save this summary. The detailed Excel workbook includes complete sales history and frozen recommendation evidence.</p>${demandCharts(report)}${summaryTables.map(table => table.id === "carbon" ? carbonCards(table) : htmlTable(compactSummary(table))).join("")}<section><h2>Explanations and limitations</h2><ul>${report.limitations.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section></body></html>`;
}

/** Called synchronously from an export button so browser popup policy can allow it. */
export function printAnalysisReport(report: AnalysisReport): void {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("The print window was blocked. Allow this site's print window and try again.");
  popup.opener = null;
  popup.document.open(); popup.document.write(renderAnalysisReportHtml(report)); popup.document.close();
  popup.focus(); popup.print();
}
