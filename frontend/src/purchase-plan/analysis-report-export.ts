import type { AnalysisReport, AnalysisReportCell, AnalysisReportTable } from "../engine.ts";

export function analysisReportFilename(report: AnalysisReport, kind: "analysis" | "planned-orders", extension: string): string {
  const source = report.metadata.sourceMode === "sample" ? "-SAMPLE" : "";
  return `stockless${source}-${kind}-${report.metadata.generatedAt.slice(0, 10)}.${extension}`;
}
export class NoPlannedOrdersError extends Error {
  constructor() { super("No planned orders. Enter a positive quantity in Purchase plan."); this.name = "NoPlannedOrdersError"; }
}
function selectedTables(report: AnalysisReport, plannedOrdersOnly: boolean): readonly AnalysisReportTable[] {
  if (!plannedOrdersOnly) return report.tables;
  const orders = report.tables.find(table => table.id === "orders");
  if (!orders?.rows.length) throw new NoPlannedOrdersError();
  return report.tables.filter(table => ["metadata", "orders", "limitations"].includes(table.id));
}

/** Explicit string cells prevent formulas and preserve codes such as 000101 verbatim. */
export async function buildAnalysisWorkbookBytes(report: AnalysisReport, options: { readonly plannedOrdersOnly?: boolean } = {}): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  for (const table of selectedTables(report, options.plannedOrdersOnly ?? false)) {
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
export async function downloadPlannedOrdersWorkbook(report: AnalysisReport): Promise<void> {
  downloadReportBytes(await buildAnalysisWorkbookBytes(report, { plannedOrdersOnly: true }), analysisReportFilename(report, "planned-orders", "xlsx"));
}

const escapeHtml = (value: AnalysisReportCell): string => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const SUMMARY_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  results: ["Product name", "Product code", "Pack size", "Readiness", "Demand low (4 weeks)", "Demand high (4 weeks)", "Planned quantity", "Restock recommendation", "Purchase check", "Purchase explanation", "Restock limitation"],
  impact: ["Product name", "Product code", "Planned spend (MYR)", "Combined commitment (MYR)", "Excess-stock cost (MYR)", "Scenario spend (MYR)", "Estimated purchase-spend difference (MYR)", "Exclusion or limitation"],
  scenarios: ["Product name", "Product code", "Supplier", "Case size", "Minimum order", "Lead time (days)", "Scenario quantity", "Arrival date", "Status", "Reason"],
  outcomes: ["Product name", "Product code", "Kind", "Date", "Recorded quantity", "Unit", "Conversion source", "Description"],
  orders: ["Product name", "Product code", "Pack size", "Planned quantity", "Quantity unit", "Quantity source", "Planned spend (MYR)", "Purchase check"],
};
export function compactSummary(table: AnalysisReportTable): AnalysisReportTable {
  const wanted = SUMMARY_COLUMNS[table.id];
  if (!wanted) return table;
  const indices = wanted.map(label => table.columns.indexOf(label)).filter(index => index >= 0);
  return { ...table, columns: indices.map(index => table.columns[index]), rows: table.rows.map(row => indices.map(index => row[index])) };
}
function htmlTable(table: AnalysisReportTable): string {
  const checkIndex = table.columns.indexOf('Purchase check');
  const body = table.rows.length
    ? '<div class="table-wrap"><table><thead><tr>' + table.columns.map(label => '<th>' + escapeHtml(label) + '</th>').join('') + '</tr></thead><tbody>' + table.rows.map(row => {
      const flagged = checkIndex >= 0 && row[checkIndex] === 'Overstock risk';
      return '<tr' + (flagged ? ' class="is-risk"' : '') + '>' + row.map(value => '<td>' + escapeHtml(value) + '</td>').join('') + '</tr>';
    }).join('') + '</tbody></table></div>'
    : '<p class="empty-row">' + (table.id === 'orders' ? 'No planned orders. Enter a positive quantity in Purchase plan.' : table.id === 'outcomes' ? 'No outcome recorded.' : 'No records available for this section.') + '</p>';
  return '<section class="report-section"><h2>' + escapeHtml(table.title) + '</h2>' + body + '</section>';
}
function carbonOverview(report: AnalysisReport): string {
  const source = report.tables.find(table => table.id === 'carbon');
  if (!source) return '';
  const index = (label: string) => source.columns.indexOf(label);
  const byKey = new Map<string, Map<string, readonly AnalysisReportCell[]>>();
  for (const row of source.rows) {
    const key = String(row[index('Product key')]);
    const kinds = byKey.get(key) ?? new Map<string, readonly AnalysisReportCell[]>();
    kinds.set(String(row[index('Measure')]), row);
    byKey.set(key, kinds);
  }
  const state = (row: readonly AnalysisReportCell[] | undefined): string => !row ? 'Unavailable' : typeof row[index('CO2e (kg)')] === 'number'
    ? Number(row[index('CO2e (kg)')]).toFixed(2) + ' kg · Estimated' : String(row[index('Status')]);
  const rows = [...byKey.values()].map(kinds => {
    const first = kinds.values().next().value as readonly AnalysisReportCell[];
    return [first[index('Product name')], state(kinds.get('recorded_waste')), state(kinds.get('potential_excess')), state(kinds.get('scenario_difference'))];
  });
  const overview: AnalysisReportTable = { id: 'carbon-overview', title: 'Potential carbon impact', columns: ['Product', 'Recorded waste', 'Potential excess', 'Scenario difference'], rows };
  const included = source.rows.filter(row => row[index('Measure')] === 'potential_excess' && row[index('Status')] === 'estimated');
  const evidence: AnalysisReportTable = { id: 'carbon-evidence', title: 'Evidence behind included estimates', columns: ['Product', 'Mass (kg)', 'CO2e (kg)', 'Factor', 'Source names'], rows: included.map(row => [
    row[index('Product name')], row[index('Mass (kg)')], row[index('CO2e (kg)')], row[index('Factor label')], row[index('Source names')],
  ]) };
  return htmlTable(overview) + (included.length ? htmlTable(evidence) : '');
}
function demandCharts(report: AnalysisReport): string {
  const history = report.tables.find(table => table.id === 'history');
  if (!history) return '';
  const grouped = new Map<string, (readonly AnalysisReportCell[])[]>();
  for (const row of history.rows) {
    const key = String(row[3]);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const charts = [...grouped.values()].slice(0, 12).map(rows => {
    const recent = rows.slice(-8);
    const values = recent.map(row => typeof row[6] === 'number' ? row[6] : undefined);
    const peak = Math.max(1, ...values.map(value => value ?? 0));
    const recorded = values.filter(value => value !== undefined).length;
    const bars = recent.map((row, index) => {
      const amount = values[index];
      const barHeight = amount && amount > 0 ? Math.max(2, amount / peak * 42) : 0;
      const label = amount === undefined ? '-' : String(amount);
      return '<div class="bar-item' + (index === recent.length - 1 ? ' is-latest' : '') + '"><span class="bar-value">' + escapeHtml(label) + '</span>' +
        '<svg class="bar-chart" viewBox="0 0 60 46" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="45.5" x2="60" y2="45.5" stroke="#E8EEEC"/><rect x="10" y="' + (46 - barHeight) + '" width="40" height="' + barHeight + '" fill="#167D74"/></svg>' +
        '<small>' + escapeHtml(String(row[4]).slice(5)) + '</small></div>';
    }).join('');
    return '<figure class="trend-row"><figcaption><b>' + escapeHtml(rows[0][0]) + '</b><small>' + escapeHtml(rows[0][1]) + ' · ' + escapeHtml(rows[0][2]) + '</small><em>PEAK ' + peak + ' · ' + recorded + '/' + recent.length + ' WEEKS RECORDED</em></figcaption><div class="bars">' + bars + '</div></figure>';
  }).join('');
  return '<section class="report-section trend-section"><p class="eyebrow">02 / RETAILER ANALYSIS</p><h2>Recent sales pattern</h2><p class="subhead">Recorded positive sales by week for the first 12 products; returns remain separate.</p><aside class="report-note"><b>How to read these charts</b><span>Bars use a separate scale for each product; compare printed values across products. Dash = unavailable, 0 = recorded zero, shade = latest week.</span></aside>' +
    (charts || '<p class="empty-row">No recent weekly sales values are available.</p>') +
    (grouped.size > 12 ? '<p class="source-note">Charts show the first 12 products. The Excel workbook contains complete weekly history.</p>' : '') + '</section>';
}
const PRINT_STYLES = [
  '@page{size:A4 landscape;margin:12mm}',
  '*{box-sizing:border-box}body{margin:0;background:#fff;color:#16313B;font:12px/1.45 system-ui,-apple-system,sans-serif}',
  'h1,h2,p,figure{margin:0}h2{font-size:23px;line-height:1.18;letter-spacing:-.3px}p{max-width:100ch}',
  '.report-cover{page-break-after:always}.hero{position:relative;min-height:150px;padding:23px 175px 22px 24px;border-radius:18px;background:#EEF6F2;overflow:hidden}',
  '.eyebrow{color:#11655E;font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}.hero h1{margin:20px 0 5px;font-size:29px;line-height:1.12;letter-spacing:-.5px}',
  '.hero .subhead,.report-section .subhead{color:#66767D}.hero img{position:absolute;right:22px;bottom:8px;width:125px;height:auto}',
  '.hero-date{position:absolute;right:156px;top:17px;padding:8px 14px;border-radius:9px;background:#fff;color:#11655E;font-size:10px;font-weight:700}',
  '.meta-strip{display:grid;grid-template-columns:1fr 1.1fr 1.6fr 1.1fr;gap:0;margin-top:12px;padding:15px;border:1px solid #D7E0DD;border-radius:13px}',
  '.meta-strip div{padding:0 12px;border-right:1px solid #E8EEEC;min-width:0;overflow-wrap:anywhere}.meta-strip div:last-child{border:0}.meta-strip small{display:block;color:#66767D;font-size:9px;font-weight:700}.meta-strip b{display:block;margin-top:6px;font-size:11px;font-weight:500}',
  '.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.metric{padding:14px;border:1px solid #D7E0DD;border-radius:12px;min-height:99px}.metric.is-amber,.report-note.is-amber,.is-risk{background:#FFF4DF}.metric.is-amber{border-color:#EFD9A6}.metric small{display:block;color:#11655E;font-size:9px;font-weight:700}.metric.is-amber small{color:#8B5C10}.metric b{display:block;margin:12px 0 5px;font-size:21px;line-height:1}.metric span{color:#66767D;font-size:9px}',
  '.action-panel{margin-top:12px;padding:14px 16px;border:1px solid #D7E0DD;border-radius:12px}.action-panel strong{display:inline-block;margin-right:18px;padding:7px 12px;border-radius:9px;background:#FFF4DF;color:#8B5C10;font-size:10px}.action-panel b{font-size:14px}.action-panel p{margin:8px 0;color:#66767D;font-size:10px}.action-panel small{display:block;padding-top:9px;border-top:1px solid #E8EEEC;color:#66767D}',
  '.report-note{display:flex;flex-direction:column;gap:4px;margin:12px 0;padding:12px 15px;border-left:4px solid #11655E;border-radius:8px;background:#E8F3F0;font-size:10px}.report-note.is-amber{border-left-color:#8B5C10}.report-note b{color:#11655E}.report-note.is-amber b{color:#8B5C10}',
  '.report-section{margin-top:22px;break-inside:auto}.report-section>h2{margin:0 0 8px}.report-section .eyebrow{margin-bottom:9px}.report-section .subhead{margin-bottom:14px}',
  '.table-wrap{width:100%;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8px}thead{display:table-header-group}tr{break-inside:avoid}th{padding:8px 7px;text-align:left;background:#E8F3F0;color:#11655E;font-size:8px}td{padding:7px;border-bottom:1px solid #E8EEEC;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even):not(.is-risk){background:#F7FAF8}',
  '.trend-row{display:grid;grid-template-columns:190px 1fr;gap:9px;padding:7px;margin:7px 0;border:1px solid #D7E0DD;border-radius:11px;break-inside:avoid}',
  '.trend-row figcaption{display:flex;flex-direction:column;justify-content:center;min-height:73px;padding:10px 12px;border-radius:7px;border-left:3px solid #11655E;background:#E8F3F0}.trend-row figcaption b{font-size:11px}.trend-row figcaption small{margin:6px 0;color:#66767D;font-size:8px}.trend-row figcaption em{color:#11655E;font-size:8px;font-style:normal;font-weight:700}',
  '.bars{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;min-width:0}.bar-item{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-width:0;padding:4px 0;border-radius:6px}.bar-item.is-latest{background:#EEF6F2}.bar-value{font-size:9px;font-weight:700}.bar-chart{display:block;width:100%;height:46px}.bar-item small{font-size:8px;color:#66767D;white-space:nowrap}',
  '.source-note,.empty-row{padding:11px 14px;background:#E8F3F0;color:#66767D}.limits{padding-left:22px}.limits li{margin:5px 0;break-inside:avoid}',
  '.print-help{margin:12px 0;padding:10px 14px;border-radius:8px;background:#E8F3F0;color:#11655E;font-size:10px}',
  '@media print{.print-help{display:none}.report-cover{break-after:page}figure,section{orphans:2;widows:2}}',
].join('');

/** Print-ready HTML using the same brand hierarchy as the downloaded PDF. */
export function renderAnalysisReportHtml(report: AnalysisReport): string {
  const table = (id: string) => report.tables.find(item => item.id === id);
  const findValue = (id: string, measure: string, valueColumn: string): AnalysisReportCell | undefined => {
    const source = table(id);
    const measureIndex = source?.columns.indexOf('Measure') ?? -1;
    const valueIndex = source?.columns.indexOf(valueColumn) ?? -1;
    return measureIndex < 0 || valueIndex < 0 ? undefined : source?.rows.find(row => row[measureIndex] === measure)?.[valueIndex];
  };
  const money = (value: AnalysisReportCell | undefined) => typeof value === 'number' ? 'RM ' + value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value ?? 'Unavailable');
  const carbon = findValue('carbontotals', 'potential_excess', 'Estimated CO2e (kg)');
  const orders = table('orders');
  const checkIndex = orders?.columns.indexOf('Purchase check') ?? -1;
  const nameIndex = orders?.columns.indexOf('Product name') ?? -1;
  const risks = (orders?.rows ?? []).filter(row => checkIndex >= 0 && row[checkIndex] === 'Overstock risk');
  const asset = new URL((import.meta.env.BASE_URL ?? '/') + 'report/stocky-hello.svg', window.location.href).href;
  const metric = (label: string, value: string, detail: string, amber = false) => '<div class="metric' + (amber ? ' is-amber' : '') + '"><small>' + escapeHtml(label) + '</small><b>' + escapeHtml(value) + '</b><span>' + escapeHtml(detail) + '</span></div>';
  const cover = '<header class="report-cover"><div class="hero"><p class="eyebrow">STOCKLESS / RETAILER ANALYSIS</p><h1>A clearer view of your<br>next purchase decision.</h1><p class="subhead">A practical check before placing the next order</p><div class="hero-date">ANALYSIS REPORT<br>' + escapeHtml(report.metadata.analysisDate) + '</div><img src="' + escapeHtml(asset) + '" alt=""></div>' +
    '<div class="meta-strip"><div><small>SHOP</small><b>' + escapeHtml(report.metadata.shopName) + '</b></div><div><small>DATASET</small><b>' + escapeHtml(report.metadata.datasetName) + '</b></div><div><small>RECORDED PERIOD</small><b>' + escapeHtml(report.metadata.period.start) + ' to ' + escapeHtml(report.metadata.period.end) + '</b></div><div><small>SOURCE FILE</small><b>' + escapeHtml(report.metadata.sourceName) + '</b></div></div>' +
    '<div class="metrics">' + metric('PLANNED PURCHASE SPEND', money(findValue('financialtotals', 'Estimated planned purchase spend', 'Estimated amount (MYR)')), 'Current plan · partial total') + metric('POTENTIAL EXCESS COST', money(findValue('financialtotals', 'Estimated excess-stock cost', 'Estimated amount (MYR)')), 'Estimated · partial total', true) + metric('POTENTIAL EXCESS CO2E', typeof carbon === 'number' ? carbon.toFixed(2) + ' kg' : String(carbon ?? 'Unavailable'), 'Estimated · partial coverage') + metric('PLANNED ORDER LINES', String(orders?.rows.length ?? 0), 'Positive quantities only') + '</div>' +
    '<div class="action-panel"><strong>' + risks.length + ' ORDERS TO REVIEW</strong><b>Check these planned orders before placing them</b><p>' + escapeHtml(risks.map(row => nameIndex >= 0 ? row[nameIndex] : '').join(', ') || 'No orders flagged by the current purchase check.') + '</p><small>' + (table('problems')?.rows.length ?? 0) + ' source issues also need review. Forecasts are ranges; unentered values are not zero.</small></div>' +
    '<aside class="report-note"><b>Read the numbers with context</b><span>Forecasts, money and CO2e are estimates. Recorded outcomes are separate. Missing values and unentered quantities are not zero.</span></aside></header>';
  const summary = report.tables.filter(item => !['metadata', 'sales', 'history', 'evidence', 'limitations', 'carbon', 'carbontotals', 'financialtotals'].includes(item.id));
  const beforeCarbon = summary.filter(item => !['outcomes', 'problems'].includes(item.id));
  const afterCarbon = summary.filter(item => ['outcomes', 'problems'].includes(item.id));
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHtml(analysisReportFilename(report, 'analysis', 'pdf')) + '</title><style>' + PRINT_STYLES + '</style></head><body>' + cover +
    '<p class="print-help">Use your browser\'s Print dialog and select “Save as PDF”. The detailed Excel workbook includes complete sales history and planning evidence.</p>' +
    demandCharts(report) + beforeCarbon.map(item => htmlTable(compactSummary(item))).join('') + carbonOverview(report) + afterCarbon.map(item => htmlTable(compactSummary(item))).join('') +
    '<section class="report-section"><h2>Explanations and limitations</h2><ol class="limits">' + report.limitations.map(item => '<li>' + escapeHtml(item) + '</li>').join('') + '</ol></section>' +
    '<section class="report-section"><h2>Source and provenance</h2><p>' + escapeHtml(report.metadata.sourceLabel) + ' · Generated ' + escapeHtml(report.metadata.generatedAt) + '<br>Source SHA-256: ' + escapeHtml(report.metadata.sourceSha256) + '</p></section></body></html>';
}

/** Called synchronously from an export button so browser popup policy can allow it. */
export function printAnalysisReport(report: AnalysisReport): void {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error("The print window was blocked. Allow this site's print window and try again.");
  popup.opener = null;
  popup.document.open(); popup.document.write(renderAnalysisReportHtml(report)); popup.document.close();
  popup.focus(); popup.print();
}
