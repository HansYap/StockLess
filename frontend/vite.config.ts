import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const onnxDist = dirname(require.resolve("onnxruntime-web"));

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ["stockless-onnx-wasm", "stockless-onnx-module", "stockless-onnx-wasm?url", "stockless-onnx-module?url"] },
  resolve: { alias: [
    { find: /^stockless-onnx-wasm(?=\?|$)/, replacement: join(onnxDist, "ort-wasm-simd-threaded.jsep.wasm") },
    { find: /^stockless-onnx-module(?=\?|$)/, replacement: join(onnxDist, "ort-wasm-simd-threaded.jsep.mjs") },
  ] },
  worker: { format: "es" },
});
