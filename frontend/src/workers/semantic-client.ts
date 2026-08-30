import type { SemanticScoreRequest, SemanticScorer } from "../engine.ts";
import { registerWorker, releaseWorker } from "./worker-registry.ts";

type ScoreResponse =
  | { readonly type: "status"; readonly id: string; readonly message: string; readonly progress?: number }
  | { readonly type: "complete"; readonly id: string; readonly scores: readonly number[] }
  | { readonly type: "error"; readonly id: string; readonly message: string };

export function createLocalSemanticScorer(
  signal: AbortSignal,
  onStatus?: (message: string, progress?: number) => void,
): SemanticScorer {
  return {
    kind: "local-browser-model",
    score(requests: readonly SemanticScoreRequest[]): Promise<readonly number[]> {
      const worker = new Worker(new URL("./semantic.worker.ts", import.meta.url), {
        type: "module",
        name: "stockless-local-mapping-model",
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
          finish(() => reject(new DOMException("Mapping cancelled.", "AbortError")));
        }

        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) {
          abort();
          return;
        }

        worker.onerror = (event) => {
          finish(() => reject(new Error(event.message || "The local mapping worker stopped unexpectedly.")));
        };
        worker.onmessage = (event: MessageEvent<ScoreResponse>) => {
          const response = event.data;
          if (response.id !== id) return;
          if (response.type === "status") {
            onStatus?.(response.message, response.progress);
          } else if (response.type === "complete") {
            finish(() => resolve(response.scores));
          } else {
            finish(() => reject(new Error(response.message)));
          }
        };
        worker.postMessage({ type: "score", id, requests });
      });
    },
  };
}
