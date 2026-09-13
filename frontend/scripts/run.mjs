import { build, createServer, preview } from "vite";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// A colon in a POSIX project path splits npm's generated PATH. Resolve tools
// directly, rather than relying on the node_modules/.bin PATH entry.
const root = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2];
if (mode === "typecheck") {
  const require = createRequire(import.meta.url);
  const result = spawnSync(process.execPath, [require.resolve("typescript/bin/tsc"), "--noEmit"], { cwd: root, stdio: "inherit" });
  process.exit(result.status ?? 1);
} else if (mode === "build") {
  await build({ root });
} else if (mode === "dev" && root.includes(":") && process.platform !== "win32") {
  // Vite's development file guard rejects colon-containing paths. Serve a
  // production build without weakening the filesystem guard or moving sources.
  console.log("This folder contains a colon. Building a local preview; rerun after edits, or move the project to a path without a colon for hot reload.");
  await build({ root });
  (await preview({ root, preview: { host: "127.0.0.1", port: 5173, strictPort: true } })).printUrls();
} else if (mode === "preview") {
  (await preview({ root, preview: { host: "127.0.0.1", port: 5173, strictPort: true } })).printUrls();
} else if (mode === "dev") {
  const server = await createServer({ root, server: { host: "127.0.0.1", port: 5173, strictPort: true } });
  await server.listen();
  server.printUrls();
} else {
  throw new Error("Use dev, build, preview, or typecheck.");
}
