import type {
  MappingState,
  ParsedDataset,
  ReadinessOptions,
  ReadinessSnapshot,
} from "../engine.ts";
import { registerWorker, releaseWorker } from "./worker-registry.ts";

type ReadinessResponse =
  | { readonly type: "complete"; readonly id: string; readonly snapshot: ReadinessSnapshot }
  | { readonly type: "error"; readonly id: string; readonly message: string };

/** Runs the CPU-heavy data check away from the interface thread. */
export function runReadinessCheckInWorker(
  dataset: ParsedDataset,
  mapping: MappingState,
  options: ReadinessOptions,
  signal: AbortSignal,
): Promise<ReadinessSnapshot> {
  const worker = new Worker(new URL("./readiness.worker.ts", import.meta.url), {
    type: "module",
    name: "stockless-readiness-check",
  });
  registerWorker(worker);

  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    let settled = false;

    function finish(action: () => void): void {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      worker.terminate();
      releaseWorker(worker);
      action();
    }

    function abort(): void {
      finish(() => reject(new DOMException("Readiness check cancelled.", "AbortError")));
    }

    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    worker.onerror = (event) => {
      finish(() => reject(new Error(event.message || "The readiness worker stopped unexpectedly.")));
    };
    worker.onmessage = (event: MessageEvent<ReadinessResponse>) => {
      const response = event.data;
      if (response.id !== id) return;
      if (response.type === "complete") {
        finish(() => resolve(response.snapshot));
      } else {
        finish(() => reject(new Error(response.message)));
      }
    };

    worker.postMessage({ type: "check", id, dataset, mapping, options });
  });
}
