import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { AnalysisReport, AnalysisReportCell, AnalysisReportTable } from '../engine.ts';
import { analysisReportFilename, downloadReportBytes } from './analysis-report-export.ts';

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TOP = 520;
const BOTTOM = 49;
const color = {
  ink: rgb(22 / 255, 49 / 255, 59 / 255),
  muted: rgb(102 / 255, 118 / 255, 125 / 255),
  teal: rgb(22 / 255, 125 / 255, 116 / 255),
  deep: rgb(17 / 255, 101 / 255, 94 / 255),
  mint: rgb(143 / 255, 210 / 255, 200 / 255),
  band: rgb(238 / 255, 246 / 255, 242 / 255),
  tint: rgb(232 / 255, 243 / 255, 240 / 255),
  line: rgb(215 / 255, 224 / 255, 221 / 255),
  lineSoft: rgb(232 / 255, 238 / 255, 236 / 255),
  amber: rgb(139 / 255, 92 / 255, 16 / 255),
  amberTint: rgb(255 / 255, 244 / 255, 223 / 255),
  white: rgb(1, 1, 1),
};
type PdfColor = ReturnType<typeof rgb>;
type Cell = AnalysisReportCell | undefined;

/** Same-origin assets only: report data never leaves the browser. */
export async function downloadAnalysisPdf(report: AnalysisReport) {
  const base = import.meta.env.BASE_URL;
  const [fontResponse, mascotResponse] = await Promise.all([
    fetch(base + 'fonts/NotoSansSC.ttf'),
    fetch(base + 'report/stocky-hello.png'),
  ]);
  if (!fontResponse.ok) throw new Error('The local PDF font could not be loaded. Keep your results and try again.');
  const mascotBytes = mascotResponse.ok ? new Uint8Array(await mascotResponse.arrayBuffer()) : undefined;
  const bytes = await buildAnalysisPdfBytes(report, new Uint8Array(await fontResponse.arrayBuffer()), mascotBytes);
  downloadReportBytes(bytes, analysisReportFilename(report, 'analysis', 'pdf'), 'application/pdf');
}

/** Searchable, paginated report generated from the same immutable contract as Excel. */
export async function buildAnalysisPdfBytes(report: AnalysisReport, fontBytes: Uint8Array, mascotBytes?: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const unicode = await doc.embedFont(fontBytes, { subset: false });
  const latin = await doc.embedFont(StandardFonts.Helvetica);
  const boldLatin = await doc.embedFont(StandardFonts.HelveticaBold);
  const mascot = mascotBytes ? await doc.embedPng(mascotBytes) : undefined;
  const latinChars = new Set(latin.getCharacterSet());
  const supported = new Set([...unicode.getCharacterSet(), ...latinChars]);
  const safe = (value: unknown): string => Array.from(String(value ?? '')).map(ch => {
    if (ch === '\n') return ch;
    if (ch === '\t') return ' ';
    const point = ch.codePointAt(0)!;
    return point < 32 ? '' : supported.has(point) ? ch : '[U+' + point.toString(16).toUpperCase() + ']';
  }).join('');
  const face = (ch: string, bold: boolean): PDFFont => latinChars.has(ch.codePointAt(0)!) ? bold ? boldLatin : latin : unicode;
  const measure = (value: string, size: number, bold = false): number => Array.from(value).reduce((sum, ch) => sum + face(ch, bold).widthOfTextAtSize(ch, size), 0);
  const wrap = (value: unknown, width: number, size: number, bold = false): string[] => {
    const lines: string[] = [];
    for (const paragraph of safe(value).split('\n')) {
      let line = '';
      for (const ch of paragraph) {
        if (line && measure(line + ch, size, bold) > width - 1) {
          const gap = line.lastIndexOf(' ');
          if (gap > line.length / 2) {
            lines.push(line.slice(0, gap));
            line = line.slice(gap + 1) + ch;
          } else {
            lines.push(line);
            line = ch;
          }
        } else line += ch;
      }
      lines.push(line);
    }
    return lines;
  };
  const shortened = (value: unknown, width: number, size: number, bold = false): string => {
    let text = safe(value).replace(/\n/g, ' ');
    if (measure(text, size, bold) <= width) return text;
    while (text && measure(text + '...', size, bold) > width) text = text.slice(0, -1);
    return text.trimEnd() + '...';
  };
  let page!: PDFPage;
  let y = TOP;
  const draw = (value: unknown, x: number, baseline: number, size: number, fill: PdfColor = color.ink, bold = false): void => {
    let run = '';
    let runFont: PDFFont | undefined;
    let cursor = x;
    const flush = () => {
      if (run && runFont) {
        page.drawText(run, { x: cursor, y: baseline, font: runFont, size, color: fill });
        cursor += runFont.widthOfTextAtSize(run, size);
        run = '';
      }
    };
    for (const ch of safe(value).replace(/\n/g, ' ')) {
      const next = face(ch, bold);
      if (runFont && next !== runFont) flush();
      runFont = next;
      run += ch;
    }
    flush();
  };
  const roundRect = (x: number, top: number, width: number, height: number, radius: number, fill: PdfColor, stroke?: PdfColor): void => {
    const r = Math.min(radius, width / 2, height / 2);
    const path = 'M ' + r + ' 0 H ' + (width - r) + ' Q ' + width + ' 0 ' + width + ' ' + r +
      ' V ' + (height - r) + ' Q ' + width + ' ' + height + ' ' + (width - r) + ' ' + height +
      ' H ' + r + ' Q 0 ' + height + ' 0 ' + (height - r) + ' V ' + r + ' Q 0 0 ' + r + ' 0 Z';
    page.drawSvgPath(path, { x, y: top, color: fill, borderColor: stroke, borderWidth: stroke ? .8 : 0 });
  };
  const addPage = (): void => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = TOP;
    roundRect(MARGIN, PAGE_H - 20, 26, 26, 6, color.deep);
    page.drawRectangle({ x: MARGIN + 7, y: PAGE_H - 37, width: 13, height: 2, color: color.white });
    page.drawRectangle({ x: MARGIN + 5, y: PAGE_H - 15, width: 4, height: 12, color: color.deep });
    page.drawRectangle({ x: MARGIN + 11, y: PAGE_H - 14, width: 4, height: 10, color: color.teal });
    page.drawRectangle({ x: MARGIN + 17, y: PAGE_H - 11, width: 4, height: 7, color: color.mint });
    page.drawEllipse({ x: MARGIN + 25, y: PAGE_H - 8, xScale: 3, yScale: 3, color: color.amber });
    draw('Stock', MARGIN + 34, PAGE_H - 36, 13, color.ink, true);
    draw('Less', MARGIN + 69, PAGE_H - 36, 13, color.deep, true);
    const label = 'RETAILER FILE ANALYSIS';
    draw(label, PAGE_W - MARGIN - measure(label, 8), PAGE_H - 34, 8, color.muted);
    page.drawLine({ start: { x: MARGIN, y: PAGE_H - 53 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - 53 }, thickness: .6, color: color.lineSoft });
    page.drawLine({ start: { x: MARGIN, y: 37 }, end: { x: PAGE_W - MARGIN, y: 37 }, thickness: .6, color: color.lineSoft });
    draw(shortened(report.metadata.shopName + '  ·  Analysis date ' + report.metadata.analysisDate + '  ·  Estimates where labelled', CONTENT_W - 45, 7.4), MARGIN, 22, 7.4, color.muted);
  };
  const ensure = (space: number): void => { if (y - space < BOTTOM) addPage(); };
  const section = (number: string, title: string, subtitle: string): void => {
    ensure(72);
    draw(number + '  /  RETAILER ANALYSIS', MARGIN, y - 10, 8, color.deep, true);
    draw(shortened(title, CONTENT_W, 23, true), MARGIN, y - 37, 23, color.ink, true);
    draw(shortened(subtitle, CONTENT_W, 8.8), MARGIN, y - 56, 8.8, color.muted);
    y -= 72;
  };
  const note = (title: string, body: string, amber = false, height = 49): void => {
    ensure(height);
    roundRect(MARGIN, y, CONTENT_W, height, 12, amber ? color.amberTint : color.tint);
    roundRect(MARGIN, y, 4, height, 2, amber ? color.amber : color.deep);
    draw(title, MARGIN + 14, y - 18, 9, amber ? color.amber : color.deep, true);
    wrap(body, CONTENT_W - 30, 8.2).slice(0, 2).forEach((line, index) => draw(line, MARGIN + 14, y - 33 - index * 10, 8.2));
    y -= height + 12;
  };
  const metrics = (items: readonly (readonly [string, string, string, boolean])[]): void => {
    ensure(104);
    const gap = 11;
    const cardW = (CONTENT_W - gap * 3) / 4;
    items.forEach(([label, value, detail, amber], index) => {
      const x = MARGIN + index * (cardW + gap);
      roundRect(x, y, cardW, 92, 12, amber ? color.amberTint : color.white, amber ? color.amberTint : color.line);
      draw(shortened(label, cardW - 24, 7.2, true), x + 12, y - 22, 7.2, amber ? color.amber : color.deep, true);
      draw(shortened(value, cardW - 24, 18, true), x + 12, y - 56, 18, color.ink, true);
      draw(shortened(detail, cardW - 24, 7.1), x + 12, y - 75, 7.1, color.muted);
    });
    y -= 104;
  };
  const table = (headers: readonly string[], rows: readonly (readonly string[])[], widths: readonly number[], highlighted = new Set<number>()): void => {
    if (!rows.length) { note('No records available', 'There are no rows for this section in the current report.'); return; }
    const fontSize = 7.5;
    const leading = 10.1;
    const pad = 8;
    const labelLines = headers.map((label, index) => wrap(label, widths[index] - pad * 2, 7.2, true));
    const headH = Math.max(...labelLines.map(lines => lines.length)) * 9.4 + 15;
    const header = (): void => {
      if (y - headH < BOTTOM + 22) addPage();
      page.drawRectangle({ x: MARGIN, y: y - headH, width: CONTENT_W, height: headH, color: color.tint });
      let x = MARGIN;
      labelLines.forEach((lines, index) => {
        lines.forEach((line, lineIndex) => draw(line, x + pad, y - 12 - lineIndex * 9.4, 7.2, color.deep, true));
        x += widths[index];
      });
      y -= headH;
    };
    header();
    rows.forEach((row, rowIndex) => {
      const lines = headers.map((_, index) => wrap(row[index] ?? '', widths[index] - pad * 2, fontSize));
      const maxLines = Math.max(1, ...lines.map(cellLines => cellLines.length));
      let offset = 0;
      while (offset < maxLines) {
        const available = y - BOTTOM;
        if (available < leading + 15) { addPage(); header(); }
        const count = Math.min(maxLines - offset, Math.max(1, Math.floor((y - BOTTOM - 12) / leading)));
        const rowH = count * leading + 12;
        page.drawRectangle({ x: MARGIN, y: y - rowH, width: CONTENT_W, height: rowH,
          color: highlighted.has(rowIndex) ? color.amberTint : rowIndex % 2 ? color.white : rgb(247 / 255, 250 / 255, 248 / 255) });
        let x = MARGIN;
        lines.forEach((cellLines, index) => {
          cellLines.slice(offset, offset + count).forEach((line, lineIndex) => draw(line, x + pad, y - 11 - lineIndex * leading, fontSize));
          x += widths[index];
        });
        y -= rowH;
        page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: .35, color: color.lineSoft });
        offset += count;
        if (offset < maxLines) { addPage(); header(); }
      }
    });
    y -= 15;
  };
  const getTable = (id: string): AnalysisReportTable | undefined => report.tables.find(item => item.id === id);
  const value = (source: AnalysisReportTable | undefined, row: readonly Cell[] | undefined, column: string): Cell => {
    const index = source?.columns.indexOf(column) ?? -1;
    return index < 0 ? undefined : row?.[index];
  };
  const text = (cell: Cell): string => cell === undefined || cell === null || cell === '' ? 'Unavailable' : String(cell);
  const format = (cell: Cell, decimals = 0): string => typeof cell === 'number' ? cell.toLocaleString('en-MY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : text(cell);
  const money = (cell: Cell): string => typeof cell === 'number' ? 'RM ' + format(cell, 2) : text(cell);
  const identity = (source: AnalysisReportTable | undefined, row: readonly Cell[]): string => {
    const name = text(value(source, row, 'Product name'));
    const code = text(value(source, row, 'Product code'));
    const pack = value(source, row, 'Pack size');
    return name + '\n' + code + (pack && pack !== 'Unavailable' ? ' · ' + pack : '');
  };
  const financialTotals = getTable('financialtotals');
  const financialTotal = (measureName: string): readonly Cell[] | undefined => financialTotals?.rows.find(row => String(value(financialTotals, row, 'Measure')) === measureName);
  const financialAmount = (measureName: string): Cell => value(financialTotals, financialTotal(measureName), 'Estimated amount (MYR)');
  const carbonTotals = getTable('carbontotals');
  const carbonPotential = carbonTotals?.rows.find(row => value(carbonTotals, row, 'Measure') === 'potential_excess');
  const carbonAmount = value(carbonTotals, carbonPotential, 'Estimated CO2e (kg)');
  const orders = getTable('orders');
  const orderRows = orders?.rows ?? [];
  const risks = orderRows.filter(row => String(value(orders, row, 'Purchase check')) === 'Overstock risk');
  const results = getTable('results');
  const resultRows = results?.rows ?? [];
  const problems = getTable('problems');

  doc.setTitle('StockLess ' + report.metadata.sourceLabel + ' analysis');
  doc.setAuthor('StockLess');
  doc.setCreationDate(new Date(report.metadata.generatedAt));
  addPage();
  roundRect(MARGIN, y, CONTENT_W, 136, 18, color.band);
  page.drawEllipse({ x: MARGIN + CONTENT_W - 73, y: y - 70, xScale: 55, yScale: 55, color: rgb(217 / 255, 237 / 255, 230 / 255) });
  roundRect(MARGIN + CONTENT_W - 290, y - 15, 139, 30, 9, color.white);
  draw('STOCKLESS  /  RETAILER ANALYSIS', MARGIN + 22, y - 26, 8.6, color.deep, true);
  draw('ANALYSIS REPORT', MARGIN + CONTENT_W - 278, y - 26, 7.2, color.deep, true);
  draw(report.metadata.analysisDate, MARGIN + CONTENT_W - 278, y - 37, 7.4, color.muted);
  draw('A clearer view of your', MARGIN + 22, y - 66, 27, color.ink, true);
  draw('next purchase decision.', MARGIN + 22, y - 98, 27, color.ink, true);
  draw('A practical check before placing the next order', MARGIN + 23, y - 118, 8.5, color.muted);
  if (mascot) page.drawImage(mascot, { x: MARGIN + CONTENT_W - 136, y: y - 129, width: 116, height: 119 });
  y -= 148;
  roundRect(MARGIN, y, CONTENT_W, 54, 13, color.white, color.line);
  const meta = [
    ['SHOP', report.metadata.shopName, 155],
    ['DATASET', report.metadata.datasetName, 170],
    ['RECORDED PERIOD', report.metadata.period.start + ' to ' + report.metadata.period.end, 245],
    ['SOURCE FILE', report.metadata.sourceName, CONTENT_W - 570],
  ] as const;
  let metaX = MARGIN + 14;
  meta.forEach(([label, entry, width], index) => {
    draw(label, metaX, y - 19, 7.2, color.muted, true);
    draw(shortened(entry, width - 16, 8.7), metaX, y - 36, 8.7);
    metaX += width;
    if (index < 3) page.drawLine({ start: { x: metaX - 10, y: y - 44 }, end: { x: metaX - 10, y: y - 11 }, thickness: .6, color: color.lineSoft });
  });
  y -= 66;
  metrics([
    ['PLANNED PURCHASE SPEND', money(financialAmount('Estimated planned purchase spend')), 'Current plan · partial total', false],
    ['POTENTIAL EXCESS COST', money(financialAmount('Estimated excess-stock cost')), 'Estimated · partial total', true],
    ['POTENTIAL EXCESS CO2E', typeof carbonAmount === 'number' ? format(carbonAmount, 2) + ' kg' : text(carbonAmount), 'Estimated · partial coverage', false],
    ['PLANNED ORDER LINES', String(orderRows.length), 'Positive quantities only', false],
  ]);
  roundRect(MARGIN, y, CONTENT_W, 90, 13, color.white, color.line);
  roundRect(MARGIN + 12, y - 12, 132, 25, 10, color.amberTint);
  draw(String(risks.length) + ' ORDERS TO REVIEW', MARGIN + 24, y - 29, 7.5, color.amber, true);
  draw('Check these planned orders before placing them', MARGIN + 158, y - 29, 11, color.ink, true);
  const riskNames = risks.map(row => text(value(orders, row, 'Product name'))).join(', ');
  draw(shortened(riskNames || 'No orders flagged by the current purchase check.', CONTENT_W - 30, 7.9), MARGIN + 15, y - 52, 7.9, color.muted);
  page.drawLine({ start: { x: MARGIN + 15, y: y - 71 }, end: { x: MARGIN + CONTENT_W - 15, y: y - 71 }, thickness: .5, color: color.lineSoft });
  draw(String(problems?.rows.length ?? 0) + ' source issues also need review. Forecasts are ranges; unentered values are not zero.', MARGIN + 15, y - 82, 7.3, color.muted);
  y -= 100;
  note('Read the numbers with context', 'Forecasts, money and CO2e are estimates. Recorded outcomes are separate. Missing values and unentered quantities are not zero.', false, 48);

  addPage();
  section('01', 'Your purchase plan', 'Current positive planned quantities, grouped for a quick order check.');
  note('Review flagged orders first', String(risks.length) + ' of ' + orderRows.length + ' planned order lines show overstock risk. Check the highlighted rows.', true);
  table(['PRODUCT', 'PLANNED QUANTITY', 'PLANNED SPEND', 'PURCHASE CHECK'], orderRows.map(row => [
    identity(orders, row),
    format(value(orders, row, 'Planned quantity')) + ' ' + text(value(orders, row, 'Quantity unit')) + '\n' + text(value(orders, row, 'Quantity source')),
    money(value(orders, row, 'Planned spend (MYR)')),
    text(value(orders, row, 'Purchase check')),
  ]), [300, 180, 130, CONTENT_W - 610], new Set(orderRows.flatMap((row, index) => value(orders, row, 'Purchase check') === 'Overstock risk' ? [index] : [])));
  if (risks.length) {
    section('01B', 'Why these orders were flagged', 'Purchase explanations for the current overstock-risk orders.');
    table(['PRODUCT', 'REASON TO REVIEW'], risks.map(row => {
      const key = value(orders, row, 'Product key');
      const match = resultRows.find(item => value(results, item, 'Product key') === key);
      return [identity(orders, row), text(value(results, match, 'Purchase explanation'))];
    }), [255, CONTENT_W - 255]);
  }

  const history = getTable('history');
  const groups = new Map<string, (readonly AnalysisReportCell[])[]>();
  for (const row of history?.rows ?? []) {
    const key = String(value(history, row, 'Product key'));
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  addPage();
  section('02', 'Recent sales pattern', 'Recorded positive sales by week for the first 12 products; returns remain separate.');
  note('How to read these charts', 'Bars use a separate scale for each product; compare printed values across products. Dash = unavailable, 0 = recorded zero, shade = latest week.');
  const histories = [...groups.values()].slice(0, 12);
  if (!histories.length) note('No weekly history', 'No recent weekly sales values are available in this report.');
  histories.forEach((rows, index) => {
    if (index && index % 4 === 0) {
      addPage();
      section('02', 'Recent sales pattern', 'Continued · products ' + (index + 1) + '-' + Math.min(index + 4, histories.length) + ' of ' + histories.length + '.');
    }
    ensure(79);
    const top = y;
    roundRect(MARGIN, top, CONTENT_W, 72, 11, color.white, color.line);
    roundRect(MARGIN + 7, top - 7, 191, 58, 7, color.tint);
    roundRect(MARGIN + 7, top - 20, 3, 31, 1.5, color.deep);
    const titleLines = wrap(value(history, rows[0], 'Product name'), 174, 9.5, true).slice(0, 2);
    titleLines.forEach((line, lineIndex) => draw(line, MARGIN + 19, top - 23 - lineIndex * 12, 9.5, color.ink, true));
    draw(shortened(text(value(history, rows[0], 'Product code')) + ' · ' + text(value(history, rows[0], 'Pack size')), 174, 7.2), MARGIN + 19, top - 48, 7.2, color.muted);
    const recent = rows.slice(-8);
    const values = recent.map(row => value(history, row, 'Positive sales'));
    const peak = Math.max(1, ...values.map(item => typeof item === 'number' ? item : 0));
    const recorded = values.filter(item => typeof item === 'number').length;
    draw('PEAK ' + format(peak) + '  ·  ' + recorded + '/' + recent.length + ' WEEKS RECORDED', MARGIN + 19, top - 62, 6.8, color.deep, true);
    const left = MARGIN + 211;
    const slot = (CONTENT_W - 223) / 8;
    const baseline = top - 50;
    page.drawLine({ start: { x: left + 2, y: baseline }, end: { x: MARGIN + CONTENT_W - 14, y: baseline }, thickness: .6, color: color.lineSoft });
    recent.forEach((row, weekIndex) => {
      const x = left + weekIndex * slot + 11;
      const barW = slot - 22;
      const amount = value(history, row, 'Positive sales');
      if (weekIndex === recent.length - 1) {
        roundRect(left + weekIndex * slot + 2, top - 5, slot - 4, 61, 6, color.band);
        page.drawLine({ start: { x: left + weekIndex * slot + 2, y: baseline }, end: { x: left + (weekIndex + 1) * slot - 2, y: baseline }, thickness: .6, color: color.lineSoft });
      }
      if (typeof amount === 'number' && amount > 0) roundRect(x, baseline + Math.max(3, amount / peak * 29), barW, Math.max(3, amount / peak * 29), 2, color.teal);
      else if (typeof amount === 'number') page.drawLine({ start: { x, y: baseline + 1 }, end: { x: x + barW, y: baseline + 1 }, thickness: 1, color: color.teal });
      const number = typeof amount === 'number' ? format(amount) : '-';
      draw(number, x + (barW - measure(number, 8, true)) / 2, top - 16, 8, color.ink, true);
      const date = text(value(history, row, 'Week start')).slice(5);
      draw(date, x + (barW - measure(date, 7)) / 2, top - 63, 7, color.muted);
    });
    y -= 79;
  });

  addPage();
  section('03', 'Demand and stock', 'Four-week demand ranges beside the stock and order figures used in the purchase check.');
  note('Estimate, not a guaranteed sale', 'Demand ranges come from recorded history. Ready, Limited and Cannot assess describe data readiness, not purchase outcomes.');
  table(['PRODUCT · READINESS', '4-WEEK DEMAND', 'IN STOCK', 'INCOMING', 'PLANNED', 'PURCHASE CHECK'], resultRows.map(row => [
    identity(results, row) + '\n' + text(value(results, row, 'Readiness')),
    format(value(results, row, 'Demand low (4 weeks)')) + '-' + format(value(results, row, 'Demand high (4 weeks)')),
    format(value(results, row, 'Current stock')),
    format(value(results, row, 'Incoming quantity')),
    format(value(results, row, 'Planned quantity')),
    text(value(results, row, 'Purchase check')),
  ]), [230, 111, 86, 87, 83, CONTENT_W - 597], new Set(resultRows.flatMap((row, index) => value(results, row, 'Purchase check') === 'Overstock risk' ? [index] : [])));
  section('03B', 'Why each order was checked', 'Restock and expiry details remain separate from the headline demand view.');
  table(['PRODUCT', 'RESTOCK', 'BEFORE EXPIRY', 'AFTER EXPIRY', 'SHELF-LIFE CAP', 'EXPLANATION / LIMIT'], resultRows.map(row => [
    identity(results, row), format(value(results, row, 'Restock recommendation')),
    format(value(results, row, 'Before expiry adjustment')), format(value(results, row, 'After expiry adjustment')),
    format(value(results, row, 'Shelf-life cap')),
    text(value(results, row, 'Purchase explanation') || value(results, row, 'Restock limitation')),
  ]), [205, 72, 85, 80, 85, CONTENT_W - 527]);

  if (y < 285) addPage();
  section('04', 'Financial impact', 'Estimated purchase commitment and possible excess-stock cost.');
  metrics([
    ['PLANNED SPEND', money(financialAmount('Estimated planned purchase spend')), 'Current positive orders', false],
    ['EXCESS-STOCK COST', money(financialAmount('Estimated excess-stock cost')), 'Estimated · partial total', true],
    ['COMPARABLE PLAN', money(financialAmount('Current planned spend for comparable products')), 'Comparable products only', false],
    ['RESTOCK SCENARIO', money(financialAmount('Estimated restock-scenario spend')), 'Estimated scenario', false],
  ]);
  note('Partial totals', 'Estimated purchase-spend difference: ' + money(financialAmount('Estimated purchase-spend difference')) + '. This is a scenario estimate, not achieved savings.', true);
  const financial = getTable('impact');
  table(['PRODUCT', 'PLAN SPEND', 'COMMITMENT', 'EXCESS COST', 'SCENARIO', 'DIFFERENCE', 'LIMITATION'], (financial?.rows ?? []).map(row => [
    identity(financial, row), money(value(financial, row, 'Planned spend (MYR)')),
    money(value(financial, row, 'Combined commitment (MYR)')),
    money(value(financial, row, 'Excess-stock cost (MYR)')),
    money(value(financial, row, 'Scenario spend (MYR)')),
    money(value(financial, row, 'Estimated purchase-spend difference (MYR)')),
    text(value(financial, row, 'Exclusion or limitation')),
  ]), [177, 90, 92, 90, 90, 90, CONTENT_W - 629]);

  if (y < 285) addPage();
  section('05', 'Potential carbon impact', 'CO2e is a partial estimate and is not a measured reduction.');
  metrics([
    ['POTENTIAL EXCESS CO2E', typeof carbonAmount === 'number' ? format(carbonAmount, 2) + ' kg' : text(carbonAmount), 'Estimated · partial coverage', false],
    ['LOWER ESTIMATE', typeof value(carbonTotals, carbonPotential, 'CO2e low (kg)') === 'number' ? format(value(carbonTotals, carbonPotential, 'CO2e low (kg)'), 2) + ' kg' : text(value(carbonTotals, carbonPotential, 'CO2e low (kg)')), 'Scenario range', false],
    ['UPPER ESTIMATE', typeof value(carbonTotals, carbonPotential, 'CO2e high (kg)') === 'number' ? format(value(carbonTotals, carbonPotential, 'CO2e high (kg)'), 2) + ' kg' : text(value(carbonTotals, carbonPotential, 'CO2e high (kg)')), 'Scenario range', false],
    ['PRODUCT COVERAGE', String(value(carbonTotals, carbonPotential, 'Included products') ?? 0) + ' / ' + String(Number(value(carbonTotals, carbonPotential, 'Included products') ?? 0) + Number(value(carbonTotals, carbonPotential, 'Excluded products') ?? 0)), 'Included / all products', true],
  ]);
  note('Interpretation', 'Estimated CO2e is separate from recorded waste and achieved reductions. Unavailable product values are not zero.', true);
  const carbon = getTable('carbon');
  const byKey = new Map<string, Map<string, readonly AnalysisReportCell[]>>();
  for (const row of carbon?.rows ?? []) {
    const key = String(value(carbon, row, 'Product key'));
    const kinds = byKey.get(key) ?? new Map<string, readonly AnalysisReportCell[]>();
    kinds.set(String(value(carbon, row, 'Measure')), row);
    byKey.set(key, kinds);
  }
  const carbonState = (row: readonly AnalysisReportCell[] | undefined): string => {
    if (!row) return 'Unavailable';
    const amount = value(carbon, row, 'CO2e (kg)');
    return typeof amount === 'number' ? format(amount, 2) + ' kg · Estimated' : text(value(carbon, row, 'Status'));
  };
  table(['PRODUCT', 'RECORDED WASTE', 'POTENTIAL EXCESS', 'SCENARIO DIFFERENCE'], resultRows.map(row => {
    const kinds = byKey.get(String(value(results, row, 'Product key')));
    return [identity(results, row), carbonState(kinds?.get('recorded_waste')), carbonState(kinds?.get('potential_excess')), carbonState(kinds?.get('scenario_difference'))];
  }), [240, 170, 180, CONTENT_W - 590]);
  const included = (carbon?.rows ?? []).filter(row => value(carbon, row, 'Measure') === 'potential_excess' && value(carbon, row, 'Status') === 'estimated');
  if (included.length) {
    addPage();
    section('05B', 'Evidence behind included estimates', 'Factor labels and source names for potential-excess estimates.');
    table(['PRODUCT', 'MASS (KG)', 'CO2E (KG)', 'FACTOR', 'SOURCE NAMES'], included.map(row => [
      identity(carbon, row), format(value(carbon, row, 'Mass (kg)'), 2), format(value(carbon, row, 'CO2e (kg)'), 2),
      text(value(carbon, row, 'Factor label')), text(value(carbon, row, 'Source names')),
    ]), [250, 85, 85, 110, CONTENT_W - 530]);
  }

  addPage();
  section('06', 'Recorded outcomes and data issues', 'Actual records are kept distinct from forecast and planning estimates.');
  const outcomes = getTable('outcomes');
  table(['PRODUCT', 'KIND', 'DATE', 'QUANTITY', 'CONVERSION SOURCE'], (outcomes?.rows ?? []).map(row => [
    identity(outcomes, row), text(value(outcomes, row, 'Kind')), text(value(outcomes, row, 'Date')),
    format(value(outcomes, row, 'Recorded quantity')) + ' ' + text(value(outcomes, row, 'Unit')),
    text(value(outcomes, row, 'Conversion source')),
  ]), [220, 80, 90, 100, CONTENT_W - 490]);
  section('06B', 'Problems to fix', 'Review source rows and missing costs before relying on affected estimates.');
  table(['PRODUCT', 'SOURCE ROW', 'ISSUE', 'REASON', 'CORRECTIVE ACTION'], (problems?.rows ?? []).map(row => [
    identity(problems, row), format(value(problems, row, 'Source row')), text(value(problems, row, 'Issue')),
    text(value(problems, row, 'Reason')), text(value(problems, row, 'Corrective action')),
  ]), [200, 80, 130, 170, CONTENT_W - 580]);
  note('No supplier price is assumed', 'Supplier scenario rows, when present, describe quantities and timing. They do not establish achieved savings.');

  addPage();
  section('07', 'How to use this report', 'Definitions, limits and source information for an informed purchase decision.');
  report.limitations.forEach((item, index) => {
    const lines = wrap(item, CONTENT_W - 42, 8.3);
    ensure(lines.length * 11 + 9);
    draw(String(index + 1).padStart(2, '0'), MARGIN, y - 10, 8, color.deep, true);
    lines.forEach((line, lineIndex) => draw(line, MARGIN + 31, y - 10 - lineIndex * 11, 8.3));
    y -= lines.length * 11 + 8;
  });
  note('Where the full evidence lives', 'This visual report highlights current decisions. The unchanged analysis workbook contains complete sales rows, weekly history and per-product evidence.', false, 46);
  table(['PROVENANCE', 'VALUE'], [
    ['SOURCE', report.metadata.sourceLabel], ['FILE', report.metadata.sourceName],
    ['DATASET ID', report.metadata.datasetId], ['GENERATED', report.metadata.generatedAt],
    ['SOURCE SHA-256', report.metadata.sourceSha256],
  ], [150, CONTENT_W - 150]);

  doc.getPages().forEach((current, index) => {
    page = current;
    const number = String(index + 1);
    draw(number, PAGE_W - MARGIN - measure(number, 7.5), 22, 7.5, color.muted);
  });
  return doc.save();
}
