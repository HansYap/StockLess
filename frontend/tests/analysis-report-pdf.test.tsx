import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { buildAnalysisPdfBytes } from '../src/purchase-plan/analysis-report-pdf.ts';
import type { AnalysisReport } from '../src/engine.ts';

it('generates a real paginated PDF with embedded Chinese font, metadata and long identifiers',async()=>{
  const report:AnalysisReport={schemaVersion:1,metadata:{shopName:'小店',datasetId:'D',datasetName:'测试数据',sourceName:'sales.csv',sourceSha256:'abc123',sourceMode:'sample',sourceLabel:'Sample data',analysisDate:'2026-10-06',period:{start:'2026-09-01',end:'2026-10-06'},generatedAt:'2026-10-08T00:00:00Z',snapshotId:'S',currency:'MYR'},tables:[
    {id:'results',title:'Product Results',columns:['Product name','Product code','Planned quantity'],rows:Array.from({length:90},(_,i)=>['中文商品 '+i,'000101',0])},
    {id:'decisions',title:'Saved Decisions',columns:['Original recommendation','Final quantity'],rows:[[40,0]]},
    {id:'carbon',title:'CO2e Estimates',columns:['Product name','Measure','Status','Mass (kg)','CO2e (kg)','Factor label','Source names','Limitation'],rows:[['米','potential_excess','estimated',5,16.084,'estimate','SEL + AGB + Poore + BCD','a'.repeat(1400)]]}
  ],limitations:['Sample data; no measured reduction claimed.']};
  const fontPath='../public/fonts/NotoSansSC.ttf';
  const font=await readFile(new URL(fontPath, import.meta.url));
  const bytes=await buildAnalysisPdfBytes(report,Uint8Array.from(font));
  expect(new TextDecoder().decode(bytes.slice(0,8))).toMatch(/^%PDF-/);
  const doc=await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBeGreaterThan(2);
  expect(doc.getTitle()).toContain('Sample data');
  expect(doc.getPages().every(p=>Math.abs(p.getWidth()-841.89)<.01)).toBe(true);
},20000);
