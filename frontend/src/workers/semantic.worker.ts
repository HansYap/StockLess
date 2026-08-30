/// <reference lib="webworker" />

import { env, pipeline } from "@huggingface/transformers";
import type { SemanticScoreRequest } from "../engine.ts";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const workerScope = self as DedicatedWorkerGlobalScope;

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = "/models/";
env.useBrowserCache = true;

interface ScoreRequest {
  readonly type: "score";
  readonly id: string;
  readonly requests: readonly SemanticScoreRequest[];
}

type ScoreResponse =
  | { readonly type: "status"; readonly id: string; readonly message: string; readonly progress?: number }
  | { readonly type: "complete"; readonly id: string; readonly scores: readonly number[] }
  | { readonly type: "error"; readonly id: string; readonly message: string };

interface EmbeddingTensor {
  tolist(): number[][];
}

let extractorPromise: Promise<unknown> | undefined;

function getExtractor(id: string): Promise<unknown> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_ID, {
      dtype: "q8",
      local_files_only: true,
      progress_callback(progress: { status?: string; progress?: number }) {
        const response: ScoreResponse = {
          type: "status",
          id,
          message: progress.status ?? "Loading the local mapping model",
          progress: progress.progress,
        };
        workerScope.postMessage(response);
      },
    });
  }
  return extractorPromise;
}

function dot(left: readonly number[], right: readonly number[]): number {
  let total = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    total += left[index] * right[index];
  }
  return Math.max(0, Math.min(1, total));
}

workerScope.onmessage = (event: MessageEvent<ScoreRequest>) => {
  const request = event.data;
  if (request.type !== "score") return;

  void getExtractor(request.id).then(async (extractor) => {
    const texts = [...new Set(request.requests.flatMap((item) => [item.sourceHeader, ...item.targetPrompts]))];
    const run = extractor as (
      input: readonly string[],
      options: { readonly pooling: "mean"; readonly normalize: true },
    ) => Promise<EmbeddingTensor>;
    const output = await run(texts, { pooling: "mean", normalize: true });
    const vectors = output.tolist();
    const byText = new Map(texts.map((text, index) => [text, vectors[index]]));
    const scores = request.requests.map((item) => {
      const source = byText.get(item.sourceHeader) ?? [];
      return Math.max(0, ...item.targetPrompts.map((prompt) => dot(source, byText.get(prompt) ?? [])));
    });
    const response: ScoreResponse = { type: "complete", id: request.id, scores };
    workerScope.postMessage(response);
  }).catch((error: unknown) => {
    extractorPromise = undefined;
    const response: ScoreResponse = {
      type: "error",
      id: request.id,
      message: error instanceof Error ? error.message : "The local mapping model could not be loaded.",
    };
    workerScope.postMessage(response);
  });
};

export {};
