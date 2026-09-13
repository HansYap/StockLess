/// <reference lib="webworker" />

import {
  buildDemandForecastReview,
  type DemandForecastReview,
  type ReadinessSnapshot,
} from "../engine.ts";

interface ForecastRequest {
  readonly type: "forecast";
  readonly id: string;
  readonly snapshot: ReadinessSnapshot;
}

type ForecastResponse =
  | { readonly type: "complete"; readonly id: string; readonly review: DemandForecastReview }
  | { readonly type: "error"; readonly id: string; readonly message: string };

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<ForecastRequest>) => {
  const request = event.data;
  if (request.type !== "forecast") return;

  try {
    const review = buildDemandForecastReview(request.snapshot);
    const response: ForecastResponse = { type: "complete", id: request.id, review };
    workerScope.postMessage(response);
  } catch (error) {
    const response: ForecastResponse = {
      type: "error",
      id: request.id,
      message: error instanceof Error ? error.message : "Demand estimation could not be completed.",
    };
    workerScope.postMessage(response);
  }
};

export {};
