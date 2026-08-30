/// <reference lib="webworker" />

import {
  runReadinessCheck,
  type MappingState,
  type ParsedDataset,
  type ReadinessOptions,
  type ReadinessSnapshot,
} from "../engine.ts";

interface ReadinessRequest {
  readonly type: "check";
  readonly id: string;
  readonly dataset: ParsedDataset;
  readonly mapping: MappingState;
  readonly options: ReadinessOptions;
}

type ReadinessResponse =
  | { readonly type: "complete"; readonly id: string; readonly snapshot: ReadinessSnapshot }
  | { readonly type: "error"; readonly id: string; readonly message: string };

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<ReadinessRequest>) => {
  const request = event.data;
  if (request.type !== "check") return;

  void runReadinessCheck(request.dataset, request.mapping, request.options).then(
    (snapshot) => {
      const response: ReadinessResponse = { type: "complete", id: request.id, snapshot };
      workerScope.postMessage(response);
    },
    (error: unknown) => {
      const response: ReadinessResponse = {
        type: "error",
        id: request.id,
        message: error instanceof Error ? error.message : "The readiness check could not be completed.",
      };
      workerScope.postMessage(response);
    },
  );
};

export {};
