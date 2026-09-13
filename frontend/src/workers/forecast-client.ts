import type { DemandForecastReview, ReadinessSnapshot } from "../engine.ts";
import { registerWorker, releaseWorker } from "./worker-registry.ts";

type ForecastResponse =
  | { readonly type: "complete"; readonly id: string; readonly review: DemandForecastReview }
  | { readonly type: "error"; readonly id: string; readonly message: string };

/** Runs Epic 3 estimation away from the interface thread and supports cancellation. */
export function runDemandForecastInWorker(
  snapshot: ReadinessSnapshot,
  signal: AbortSignal,
): Promise<DemandForecastReview> {
  const worker = new Worker(new URL("./forecast.worker.ts", import.meta.url), {
    type: "module",
    name: "stockless-demand-forecast",
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
      finish(() => reject(new DOMException("Demand estimation cancelled.", "AbortError")));
    }

    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    worker.onerror = (event) => {
      finish(() => reject(new Error(event.message || "The demand-estimation worker stopped unexpectedly.")));
    };
    worker.onmessage = (event: MessageEvent<ForecastResponse>) => {
      const response = event.data;
      if (response.id !== id) return;
      if (response.type === "complete") {
        finish(() => resolve(response.review));
      } else {
        finish(() => reject(new Error(response.message)));
      }
    };

    worker.postMessage({ type: "forecast", id, snapshot });
  });
}
