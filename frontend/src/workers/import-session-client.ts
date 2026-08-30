import {
  CsvImportError,
  type CsvErrorCode,
  type CsvProgress,
  type SessionEnvelope,
  type SourceMode,
} from "../engine.ts";
import { registerWorker, releaseWorker } from "./worker-registry.ts";

type ImportResponse =
  | { readonly type: "progress"; readonly id: string; readonly progress: CsvProgress }
  | { readonly type: "complete"; readonly id: string; readonly envelope: SessionEnvelope }
  | {
      readonly type: "error";
      readonly id: string;
      readonly error: { readonly code?: string; readonly message: string; readonly recovery?: string };
    };

export function replaceSessionSourceInWorker(
  envelope: SessionEnvelope,
  bytes: Uint8Array,
  input: {
    readonly sourceName: string;
    readonly sourceMode: SourceMode;
    readonly mimeType?: string;
    readonly onProgress: (progress: CsvProgress) => void;
    readonly signal: AbortSignal;
  },
): Promise<SessionEnvelope> {
  const worker = new Worker(new URL("./import-session.worker.ts", import.meta.url), {
    type: "module",
    name: "stockless-csv-import",
  });
  registerWorker(worker);

  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    let settled = false;

    function finish(action: () => void): void {
      if (settled) return;
      settled = true;
      input.signal.removeEventListener("abort", abort);
      worker.terminate();
      releaseWorker(worker);
      action();
    }

    function abort(): void {
      finish(() => reject(new DOMException("Import cancelled.", "AbortError")));
    }

    input.signal.addEventListener("abort", abort, { once: true });
    if (input.signal.aborted) {
      abort();
      return;
    }

    worker.onerror = (event) => {
      finish(() => reject(new Error(event.message || "The import worker stopped unexpectedly.")));
    };
    worker.onmessage = (event: MessageEvent<ImportResponse>) => {
      const response = event.data;
      if (response.id !== id) return;
      if (response.type === "progress") {
        input.onProgress(response.progress);
        return;
      }
      if (response.type === "complete") {
        finish(() => resolve(response.envelope));
        return;
      }
      finish(() => reject(response.error.code && response.error.recovery
        ? new CsvImportError(response.error.code as CsvErrorCode, response.error.message, response.error.recovery)
        : new Error(response.error.message)));
    };

    // Transfer a copy so the caller's original bytes remain readable and unchanged.
    const workerBytes = bytes.slice();
    worker.postMessage({
      type: "import",
      id,
      envelope,
      bytes: workerBytes,
      sourceName: input.sourceName,
      sourceMode: input.sourceMode,
      mimeType: input.mimeType,
    }, [workerBytes.buffer]);
  });
}
