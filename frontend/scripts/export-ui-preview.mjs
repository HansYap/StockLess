import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const frontend = fileURLToPath(new URL("../", import.meta.url));
const output = path.resolve(frontend, "../../StockLess-UI-Clickable-Preview.html");
const entry = `
import '@fontsource-variable/inter';
import '@fontsource-variable/manrope';
import '@fontsource-variable/source-sans-3';
import './src/styles.css';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PurchasePlanScreen } from './src/screens/PurchasePlanScreen.tsx';
import { buildDemandForecastReview } from './src/engine.ts';
import { makeEvidence } from './tests/fixtures.ts';

const base = makeEvidence().snapshot;
const names = { A: ['Kopi O Kaw 2in1', 'MM0001'], B: ['Milo 3in1', 'MM0002'], C: ['Roti Gardenia', 'MM0007'] };
const snapshot = {
  ...base,
  analysisDate: '2026-10-04',
  rows: base.rows.map(row => ({ ...row, interpretedValues: {
    ...row.interpretedValues,
    productName: names[row.productKey][0],
    productCode: names[row.productKey][1],
    stockAsOfDate: '2026-10-01',
  }})),
  productStock: base.productStock.map(stock => ({ ...stock,
    stockAsOfDate: '2026-10-01',
    freshness: { analysisDate: '2026-10-04', snapshotDate: '2026-10-01', ageDays: 3, state: 'current' },
  })),
};
const forecast = buildDemandForecastReview(snapshot);
function Preview() {
  const [drafts, setDrafts] = useState({});
  const [selectedKey, setSelectedKey] = useState(null);
  return <div className="frame"><div className="page">
    <div className="preview-banner"><strong>StockLess</strong><span>Interactive UI preview · example products</span></div>
    <PurchasePlanScreen snapshot={snapshot} forecast={forecast} drafts={drafts}
      selectedKey={selectedKey} onSelect={setSelectedKey}
      onDraftChange={(key, inputs) => setDrafts(previous => ({...previous, [key]: inputs}))}
      onBack={() => {}} />
  </div></div>;
}
createRoot(document.getElementById('root')).render(<Preview />);
`;
const result = await build({
  absWorkingDir: frontend,
  stdin: { contents: entry, loader: "tsx", resolveDir: frontend },
  bundle: true,
  write: false,
  outfile: "ui-preview.js",
  format: "iife",
  jsx: "automatic",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".woff2": "dataurl", ".woff": "dataurl" },
});
const css = result.outputFiles.find(file => file.path.endsWith(".css")).text;
const js = result.outputFiles.find(file => file.path.endsWith(".js")).text.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StockLess · Clickable UI preview</title><style>${css}\n.preview-banner{display:flex;align-items:center;gap:16px;padding:18px 0;margin-bottom:16px;border-bottom:1px solid #dce8e4;color:#176e68}.preview-banner strong{font-size:22px}.preview-banner span{font-size:13px;color:#617771}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
await writeFile(output, html);
console.log(`Exported ${output} (${Math.round(Buffer.byteLength(html) / 1024)} KB)`);
