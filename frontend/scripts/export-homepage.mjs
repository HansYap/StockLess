import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// A portable copy of the same React homepage, with JS, CSS and photos embedded.
// The actual data workspace is served by Vite, not duplicated in this artifact.
const frontend = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(frontend, "../output/StockLess-Homepage.html");
const workspaceUrl = process.env.STOCKLESS_WORKSPACE_URL || "http://localhost:5173/#workspace";
const imageSources = {};
for (const file of ["food-waste.jpg", "retail-produce-2.jpg", "design-basket.png"]) {
  imageSources[file] = `data:image/${file.endsWith(".png") ? "png" : "jpeg"};base64,${(await readFile(path.join(frontend, "public/homepage", file))).toString("base64")}`;
}
const result = await build({
  absWorkingDir: frontend,
  stdin: {
    contents: `import '@fontsource-variable/inter';
      import '@fontsource-variable/manrope';
      import '@fontsource-variable/source-sans-3';
      import './src/styles.css';
      import {createRoot} from 'react-dom/client';
      import {HomePage} from './src/screens/HomePage.tsx';
      createRoot(document.getElementById('root')).render(<HomePage startHref={${JSON.stringify(workspaceUrl)}} imageSources={${JSON.stringify(imageSources)}}/>);`,
    loader: "tsx", resolveDir: frontend,
  },
  bundle: true, write: false, outfile: "homepage.js", format: "iife", jsx: "automatic", minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".woff2": "dataurl", ".woff": "dataurl" },
});
const css = result.outputFiles.find((file) => file.path.endsWith(".css")).text;
const js = result.outputFiles.find((file) => file.path.endsWith(".js")).text.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Smarter restocking for small retailers. Reduce excess stock, control costs, and help prevent food waste.">
<title>StockLess | Less food waste. Smarter restocking.</title>
<style>html,body{margin:0;min-height:100%}body{-webkit-font-smoothing:antialiased}${css}</style></head>
<body><div id="root"></div><noscript>Please enable JavaScript to view the interactive StockLess homepage.</noscript><script>${js}</script></body></html>`;
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`Exported ${output} (${Math.round(Buffer.byteLength(html) / 1024)} KB)`);
