/// <reference lib="webworker" />

import {
  CsvImportError,
  replaceSessionSource,
  type CsvProgress,
  type SessionEnvelope,
  type SourceMode,
} from "../engine.ts";

interface ImportRequest {
  readonly type: "import";
  readonly id: string;
  readonly envelope: SessionEnvelope;
  readonly bytes: Uint8Array;
  readonly sourceName: string;
  readonly sourceMode: SourceMode;
  readonly mimeType?: string;
}

type ImportResponse =
  | { readonly type: "progress"; readonly id: string; readonly progress: CsvProgress }
  | { readonly type: "complete"; readonly id: string; readonly envelope: SessionEnvelope }
  | {
      readonly type: "error";
      readonly id: string;
      readonly error: { readonly code?: string; readonly message: string; readonly recovery?: string };
    };

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<ImportRequest>) => {
  const request = event.data;
  if (request.type !== "import") return;

  void replaceSessionSource(request.envelope, request.bytes, {
    sourceMode: request.sourceMode,
    sourceName: request.sourceName,
    mimeType: request.mimeType,
    onProgress(progress) {
      const response: ImportResponse = { type: "progress", id: request.id, progress };
      workerScope.postMessage(response);
    },
  }).then(
    (envelope) => {
      const response: ImportResponse = { type: "complete", id: request.id, envelope };
      workerScope.postMessage(response);
    },
    (error: unknown) => {
      const response: ImportResponse = {
        type: "error",
        id: request.id,
        error: error instanceof CsvImportError
          ? { code: error.code, message: error.message, recovery: error.recovery }
          : { message: error instanceof Error ? error.message : "The file could not be parsed." },
      };
      workerScope.postMessage(response);
    },
  );
};

export {};
