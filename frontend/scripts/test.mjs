import { startVitest } from "vitest/node";
import { fileURLToPath } from "node:url";
import { mkdtemp, cp, symlink, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const frontend = fileURLToPath(new URL("../", import.meta.url));
// Vite treats ':' in this workspace path as a URL scheme. Test an exact temporary
// copy of the sources; dependencies remain shared and no generated files are kept.
const root = await realpath(
  await mkdtemp(path.join(tmpdir(), "stockless-ui-tests-")),
);
try {
  for (const name of [
    "src",
    "tests",
    "package.json",
    "tsconfig.json",
    "vitest.config.ts",
  ])
    await cp(path.join(frontend, name), path.join(root, name), {
      recursive: true,
    });
  await cp(path.join(frontend, "../backend/src"), path.join(root, "backend"), {
    recursive: true,
  });
  await symlink(
    path.join(frontend, "../node_modules"),
    path.join(root, "node_modules"),
    "dir",
  );
  const ctx = await startVitest("test", [], {
    root,
    config: path.join(root, "vitest.config.ts"),
    watch: false,
  });
  if (!ctx) process.exitCode = 1;
  else {
    process.exitCode =
      ctx.state.getUnhandledErrors().length ||
      ctx.state.getFiles().some((file) => file.result?.state === "fail")
        ? 1
        : 0;
    await ctx.close();
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
