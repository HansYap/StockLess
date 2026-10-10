import type { Cell, Workbook, Worksheet } from "exceljs";
import type { AnalysisReport, AnalysisReportCell, AnalysisReportTable } from "../engine.ts";

const PALETTE = {
  ink: "FF16313B", muted: "FF66767D", teal: "FF167D74", deep: "FF11655E",
  pale: "FFEEF6F2", tint: "FFE8F3F0", line: "FFD7E0DD", soft: "FFF7FAF8",
  amber: "FF8B5C10", amberPale: "FFFFF4DF", red: "FF9F3D3D", redPale: "FFFCEAEA", white: "FFFFFFFF",
} as const;
const DAY = 86_400_000;
const WEEKS = 8;

export class NoPlannedOrdersError extends Error {
  constructor() { super("No planned orders. Enter a positive quantity in Purchase plan."); this.name = "NoPlannedOrdersError"; }
}

function selectedTables(report: AnalysisReport, plannedOrdersOnly: boolean): readonly AnalysisReportTable[] {
  if (!plannedOrdersOnly) return report.tables;
  const orders = report.tables.find(table => table.id === "orders");
  if (!orders?.rows.length) throw new NoPlannedOrdersError();
  return report.tables.filter(table => ["metadata", "orders", "limitations"].includes(table.id));
}

function fill(cell: Cell, argb: string): void {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function text(cell: Cell, value: AnalysisReportCell, options: {
  readonly size?: number; readonly bold?: boolean; readonly color?: string; readonly align?: "left" | "center" | "right";
} = {}): void {
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Report contains an unsupported numeric value.");
  if (typeof value === "string" && value.length > 32767) throw new Error("A report cell is too long for Excel. Reduce conflicting source labels and try again.");
  cell.value = value;
  cell.font = { name: "Arial", size: options.size ?? 10, bold: options.bold ?? false, color: { argb: options.color ?? PALETTE.ink } };
  cell.alignment = { vertical: "middle", horizontal: options.align ?? (typeof value === "number" ? "right" : "left") };
  if (typeof value === "string") cell.numFmt = "@";
}

function band(sheet: Worksheet, startRow: number, endRow: number, startCol: number, endCol: number, argb: string): void {
  for (let row = startRow; row <= endRow; row++) for (let col = startCol; col <= endCol; col++) fill(sheet.getCell(row, col), argb);
}

function mergedText(sheet: Worksheet, range: string, value: AnalysisReportCell, options: Parameters<typeof text>[2] = {}): void {
  sheet.mergeCells(range);
  text(sheet.getCell(range.split(":")[0]), value, options);
}

function pngDataUrl(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return `data:image/png;base64,${btoa(binary)}`;
}

function addPng(book: Workbook, sheet: Worksheet, bytes: Uint8Array | undefined, from: { col: number; row: number }, width: number, height: number): void {
  if (!bytes?.length) return;
  const image = book.addImage({ base64: pngDataUrl(bytes), extension: "png" });
  sheet.addImage(image, { tl: from, ext: { width, height } });
}

function lastCompleteWeekStarts(analysisDate: string): string[] {
  const day = new Date(`${analysisDate}T00:00:00Z`);
  const currentMonday = day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY;
  return Array.from({ length: WEEKS }, (_, index) => new Date(currentMonday - (WEEKS - index) * 7 * DAY).toISOString().slice(0, 10));
}

function weekLabel(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function getColumn(table: AnalysisReportTable | undefined, label: string): number { return table?.columns.indexOf(label) ?? -1; }
function getValue(table: AnalysisReportTable | undefined, row: readonly AnalysisReportCell[] | undefined, label: string): AnalysisReportCell | undefined {
  const column = getColumn(table, label);
  return column < 0 ? undefined : row?.[column];
}

interface WeeklyRow {
  readonly name: string;
  readonly code: string;
  readonly pack: string;
  readonly values: readonly (number | "—")[];
  readonly weeks: number;
  readonly readiness: string;
}

function weeklyRows(report: AnalysisReport, weeks: readonly string[]): WeeklyRow[] {
  const results = report.tables.find(table => table.id === "results");
  const history = report.tables.find(table => table.id === "history");
  if (!results) return [];
  const sales = new Map<string, Map<string, number>>();
  for (const row of history?.rows ?? []) {
    const key = getValue(history, row, "Product key");
    const week = getValue(history, row, "Week start");
    const amount = getValue(history, row, "Positive sales");
    if (typeof key !== "string" || typeof week !== "string" || typeof amount !== "number") continue;
    const product = sales.get(key) ?? new Map<string, number>();
    product.set(week, amount);
    sales.set(key, product);
  }
  return results.rows.map(row => {
    const key = String(getValue(results, row, "Product key") ?? "");
    const values = weeks.map(week => sales.get(key)?.get(week) ?? "—");
    return {
      name: String(getValue(results, row, "Product name") ?? "Not supplied"),
      code: String(getValue(results, row, "Product code") ?? ""),
      pack: String(getValue(results, row, "Pack size") ?? ""),
      values,
      weeks: values.filter(value => typeof value === "number").length,
      readiness: String(getValue(results, row, "Readiness") ?? "Unavailable"),
    };
  });
}

function prepareCanvas(sheet: Worksheet): void {
  sheet.views = [{ showGridLines: false }];
  sheet.getColumn(1).width = 3;
  for (let col = 2; col <= 14; col++) sheet.getColumn(col).width = 12;
  sheet.getColumn(15).width = 3;
  for (let row = 1; row <= 40; row++) sheet.getRow(row).height = 21;
  sheet.getRow(1).height = 13;
}

function addOverview(book: Workbook, report: AnalysisReport, rows: readonly WeeklyRow[], weeks: readonly string[], logo?: Uint8Array, mascot?: Uint8Array): void {
  const sheet = book.addWorksheet("Overview", { properties: { tabColor: { argb: PALETTE.deep } } });
  prepareCanvas(sheet);
  band(sheet, 2, 12, 2, 14, PALETTE.pale);
  addPng(book, sheet, logo, { col: 1.15, row: 2.15 }, 218, 55);
  addPng(book, sheet, mascot, { col: 11.25, row: 3.4 }, 142, 146);
  mergedText(sheet, "B6:K8", "A clearer view of your next purchase decision", { size: 21, bold: true });
  mergedText(sheet, "B9:K9", "StockLess retailer analysis", { size: 11, bold: true, color: PALETTE.deep });
  mergedText(sheet, "B11:H11", report.metadata.sourceLabel.toUpperCase(), { size: 9, bold: true, color: PALETTE.muted });
  band(sheet, 11, 11, 9, 11, PALETTE.white);
  mergedText(sheet, "I11:K11", report.metadata.analysisDate, { size: 9, bold: true, color: PALETTE.deep, align: "center" });

  const metadata = [
    ["B14:D14", "SHOP", "B15:D15", report.metadata.shopName],
    ["E14:G14", "DATASET", "E15:G15", report.metadata.datasetName],
    ["H14:J14", "RECORDED PERIOD", "H15:J15", `${report.metadata.period.start} to ${report.metadata.period.end}`],
    ["K14:N14", "ANALYSIS DATE", "K15:N15", report.metadata.analysisDate],
  ];
  for (const [labelRange, label, valueRange, value] of metadata) {
    mergedText(sheet, labelRange, label, { size: 8, bold: true, color: PALETTE.muted });
    mergedText(sheet, valueRange, value, { size: 10, bold: true });
  }
  for (let col = 2; col <= 14; col++) sheet.getCell(16, col).border = { bottom: { style: "thin", color: { argb: PALETTE.line } } };

  const orders = report.tables.find(table => table.id === "orders");
  const risks = orders?.rows.filter(row => getValue(orders, row, "Purchase check") === "Overstock risk").length ?? 0;
  const cards = [
    { from: 2, to: 4, label: "PRODUCTS IN REPORT", value: rows.length, warning: false },
    { from: 5, to: 7, label: "PLANNED ORDER LINES", value: orders?.rows.length ?? 0, warning: false },
    { from: 8, to: 10, label: "COMPLETE SALES HISTORIES", value: rows.filter(row => row.weeks === WEEKS).length, warning: false },
    { from: 11, to: 14, label: "ORDERS TO REVIEW", value: risks, warning: risks > 0 },
  ];
  for (const card of cards) {
    band(sheet, 18, 23, card.from, card.to, card.warning ? PALETTE.amberPale : PALETTE.white);
    const border = { style: "thin" as const, color: { argb: card.warning ? PALETTE.amberPale : PALETTE.line } };
    for (let col = card.from; col <= card.to; col++) {
      sheet.getCell(18, col).border = { top: border };
      sheet.getCell(23, col).border = { bottom: border };
    }
    for (let row = 18; row <= 23; row++) {
      sheet.getCell(row, card.from).border = { ...sheet.getCell(row, card.from).border, left: border };
      sheet.getCell(row, card.to).border = { ...sheet.getCell(row, card.to).border, right: border };
    }
    sheet.mergeCells(19, card.from, 19, card.to);
    text(sheet.getCell(19, card.from), card.label, { size: 8, bold: true, color: card.warning ? PALETTE.amber : PALETTE.deep });
    sheet.mergeCells(20, card.from, 22, card.to);
    text(sheet.getCell(20, card.from), card.value, { size: 23, bold: true });
  }

  mergedText(sheet, "B26:H26", "Recent sales pattern", { size: 15, bold: true });
  mergedText(sheet, "I26:N26", "Last eight complete weeks", { size: 9, color: PALETTE.muted, align: "right" });
  mergedText(sheet, "B27:N27", "Dash = unavailable week. 0 = recorded zero sales. Full history is on the Weekly sales sheet.", { size: 9, color: PALETTE.muted });
  band(sheet, 28, 28, 2, 14, PALETTE.deep);
  sheet.mergeCells("B28:D28");
  text(sheet.getCell("B28"), "Product", { size: 9, color: PALETTE.white, bold: true });
  weeks.forEach((week, index) => text(sheet.getCell(28, index + 5), weekLabel(week), { size: 9, color: PALETTE.white, bold: true, align: "center" }));
  sheet.mergeCells("M28:N28");
  text(sheet.getCell("M28"), "Coverage", { size: 9, color: PALETTE.white, bold: true, align: "center" });

  const complete = rows.filter(row => row.weeks === WEEKS);
  const partial = rows.filter(row => row.weeks < WEEKS);
  const picked = [...complete.slice(0, 2), ...partial.slice(0, 2)];
  for (const row of rows) if (picked.length < 4 && !picked.includes(row)) picked.push(row);
  picked.slice(0, 4).forEach((item, index) => {
    const row = index + 29;
    sheet.getRow(row).height = 26;
    band(sheet, row, row, 2, 14, index % 2 ? PALETTE.soft : PALETTE.white);
    sheet.mergeCells(row, 2, row, 4);
    text(sheet.getCell(row, 2), item.name, { bold: true });
    item.values.forEach((value, i) => {
      const cell = sheet.getCell(row, i + 5);
      fill(cell, value === "—" ? PALETTE.amberPale : value === 0 ? PALETTE.soft : PALETTE.tint);
      text(cell, value, { align: "center", color: value === "—" ? PALETTE.muted : PALETTE.ink });
    });
    sheet.mergeCells(row, 13, row, 14);
    text(sheet.getCell(row, 13), `${item.weeks} / 8`, { size: 9, bold: true, color: item.weeks === WEEKS ? PALETTE.deep : PALETTE.amber, align: "center" });
    for (let col = 2; col <= 14; col++) sheet.getCell(row, col).border = { bottom: { style: "thin", color: { argb: PALETTE.line } } };
  });
  if (!picked.length) mergedText(sheet, "B29:N30", "No weekly sales history is available for this report.", { color: PALETTE.muted });

  band(sheet, 35, 38, 2, 14, PALETTE.tint);
  mergedText(sheet, "B35:N35", "What needs attention", { size: 11, bold: true, color: PALETTE.deep });
  const problems = report.tables.find(table => table.id === "problems")?.rows.length ?? 0;
  mergedText(sheet, "B36:N37", `${risks} planned order lines show overstock risk. ${problems} source issues need review. See Purchase Orders and Problems to Fix for details.`, { size: 10 });
  mergedText(sheet, "B38:N38", "Forecasts and CO₂e are estimates. Missing values are not treated as zero.", { size: 9, color: PALETTE.muted });
  sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
  sheet.pageSetup.printArea = "B2:N38";
}

function addWeeklySales(book: Workbook, rows: readonly WeeklyRow[], weeks: readonly string[]): void {
  const sheet = book.addWorksheet("Weekly sales", { properties: { tabColor: { argb: PALETTE.teal } } });
  sheet.views = [{ state: "frozen", ySplit: 6, xSplit: 4, showGridLines: false }];
  sheet.getColumn(1).width = 3;
  sheet.getColumn(2).width = 24;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 17;
  for (let col = 5; col <= 12; col++) sheet.getColumn(col).width = 12;
  sheet.getColumn(13).width = 17;
  sheet.getColumn(14).width = 18;
  mergedText(sheet, "B2:N2", "Weekly sales history", { size: 16, bold: true });
  mergedText(sheet, "B3:N3", "Missing weeks are not treated as zero. Complete source history remains in Weekly Demand History.", { size: 9, color: PALETTE.muted });
  for (let col = 2; col <= 14; col++) sheet.getCell(4, col).border = { bottom: { style: "medium", color: { argb: PALETTE.teal } } };
  const headers = ["Product", "SKU", "Pack", ...weeks.map(weekLabel), "Weeks", "Sales status"];
  sheet.getRow(6).height = 26;
  headers.forEach((value, index) => {
    const cell = sheet.getCell(6, index + 2);
    fill(cell, PALETTE.deep);
    text(cell, value, { size: 9, bold: true, color: PALETTE.white, align: "center" });
  });
  rows.forEach((item, index) => {
    const row = index + 7;
    sheet.getRow(row).height = 26;
    const values: AnalysisReportCell[] = [item.name, item.code, item.pack, ...item.values, `${item.weeks} / 8`, item.readiness];
    values.forEach((value, column) => {
      const cell = sheet.getCell(row, column + 2);
      fill(cell, index % 2 ? PALETTE.soft : PALETTE.white);
      if (column >= 3 && column <= 10) fill(cell, value === "—" ? PALETTE.amberPale : value === 0 ? PALETTE.soft : PALETTE.tint);
      text(cell, value, { size: 10, align: column >= 3 && column <= 11 ? "center" : "left", color: value === "—" ? PALETTE.muted : PALETTE.ink });
      cell.border = { bottom: { style: "thin", color: { argb: PALETTE.line } } };
    });
    const status = sheet.getCell(row, 14);
    if (item.readiness === "Cannot assess") { fill(status, PALETTE.redPale); status.font = { ...status.font, color: { argb: PALETTE.red }, bold: true }; }
    else if (item.readiness === "Limited") { fill(status, PALETTE.amberPale); status.font = { ...status.font, color: { argb: PALETTE.amber }, bold: true }; }
  });
  sheet.autoFilter = { from: { row: 6, column: 2 }, to: { row: Math.max(7, rows.length + 6), column: 14 } };
  const noteRow = rows.length + 9;
  sheet.mergeCells(noteRow, 2, noteRow, 14);
  text(sheet.getCell(noteRow, 2), "Teal = recorded value. Amber = missing week. A numeric 0 is a recorded zero.", { size: 9, color: PALETTE.muted });
  sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

function addOrderSummary(book: Workbook, report: AnalysisReport, logo?: Uint8Array): void {
  const sheet = book.addWorksheet("Order summary", { properties: { tabColor: { argb: PALETTE.deep } } });
  prepareCanvas(sheet);
  band(sheet, 2, 10, 2, 14, PALETTE.pale);
  addPng(book, sheet, logo, { col: 1.15, row: 2.15 }, 218, 55);
  mergedText(sheet, "B6:N7", "Current purchase orders", { size: 21, bold: true });
  mergedText(sheet, "B9:N9", `${report.metadata.shopName}   ·   ${report.metadata.analysisDate}   ·   ${report.metadata.sourceLabel}`, { size: 10, color: PALETTE.deep });
  const count = report.tables.find(table => table.id === "orders")?.rows.length ?? 0;
  mergedText(sheet, "B13:N14", `${count} planned order lines`, { size: 16, bold: true });
  mergedText(sheet, "B16:N17", "The Purchase Orders sheet contains the complete order list. Quantities are current plan entries; this export does not place an order.", { size: 10, color: PALETTE.muted });
  sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
  sheet.pageSetup.printArea = "B2:N17";
}

function addDataSheet(book: Workbook, table: AnalysisReportTable): void {
  const sheet = book.addWorksheet(table.title.slice(0, 31), { properties: { tabColor: { argb: PALETTE.teal } } });
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: table.columns.length > 6 ? 3 : 0, showGridLines: false }];
  sheet.getRow(1).height = 32;
  table.columns.forEach((label, index) => {
    const column = sheet.getColumn(index + 1);
    column.width = Math.min(60, Math.max(16, label.length + 2, ...table.rows.slice(0, 50).map(row => String(row[index] ?? "").length)));
    const cell = sheet.getCell(1, index + 1);
    fill(cell, PALETTE.deep);
    text(cell, label, { size: 9, bold: true, color: PALETTE.white, align: "center" });
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  table.rows.forEach((values, index) => {
    const row = sheet.getRow(index + 2);
    row.height = 24;
    values.forEach((value, column) => {
      const cell = row.getCell(column + 1);
      fill(cell, index % 2 ? PALETTE.soft : PALETTE.white);
      if (value === "Missing week" || value === "Unavailable" || value === "Not entered" || value === "Unconfirmed") fill(cell, PALETTE.amberPale);
      else if (value === "Overstock risk") fill(cell, PALETTE.amberPale);
      else if (value === "Cannot assess") fill(cell, PALETTE.redPale);
      text(cell, value);
      cell.border = { bottom: { style: "thin", color: { argb: PALETTE.line } } };
    });
  });
  if (table.rows.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: table.rows.length + 1, column: table.columns.length } };
  sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

/** Same immutable report data as PDF; visual sheets are added without changing source tables. */
export async function buildAnalysisWorkbookBytes(report: AnalysisReport, options: {
  readonly plannedOrdersOnly?: boolean;
  readonly logoPng?: Uint8Array;
  readonly mascotPng?: Uint8Array;
} = {}): Promise<Uint8Array> {
  const tables = selectedTables(report, options.plannedOrdersOnly ?? false);
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  book.creator = "StockLess";
  book.title = `StockLess ${report.metadata.sourceLabel} report`;
  book.subject = report.metadata.datasetName;
  book.created = new Date(report.metadata.generatedAt);
  book.properties.date1904 = false;
  if (options.plannedOrdersOnly) addOrderSummary(book, report, options.logoPng);
  else {
    const weeks = lastCompleteWeekStarts(report.metadata.analysisDate);
    const rows = weeklyRows(report, weeks);
    addOverview(book, report, rows, weeks, options.logoPng, options.mascotPng);
    addWeeklySales(book, rows, weeks);
  }
  tables.forEach(table => addDataSheet(book, table));
  return new Uint8Array(await book.xlsx.writeBuffer());
}

/** Bundled, same-origin report artwork keeps all source data in the browser. */
export async function loadWorkbookImages(plannedOrdersOnly = false): Promise<{ logoPng: Uint8Array; mascotPng?: Uint8Array }> {
  const base = import.meta.env.BASE_URL;
  const logoResponse = await fetch(base + "report/stockless-logo.png");
  if (!logoResponse.ok) throw new Error("The StockLess report logo could not be loaded. Keep your results and try again.");
  const mascotResponse = plannedOrdersOnly ? undefined : await fetch(base + "report/stocky-hello.png");
  return {
    logoPng: new Uint8Array(await logoResponse.arrayBuffer()),
    mascotPng: mascotResponse?.ok ? new Uint8Array(await mascotResponse.arrayBuffer()) : undefined,
  };
}
