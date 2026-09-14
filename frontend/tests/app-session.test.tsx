import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App.tsx";
import { makeEvidence } from "./fixtures.ts";
import { runDemandForecastInWorker } from "../src/workers/forecast-client.ts";
import type { SessionEnvelope } from "../src/engine.ts";

vi.mock("../src/engine.ts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  proposeMappings: vi.fn(async () => ({ proposals: [] })),
}));
vi.mock("../src/workers/semantic-client.ts", () => ({
  createLocalSemanticScorer: () => undefined,
}));
vi.mock("../src/workers/forecast-client.ts", () => ({
  runDemandForecastInWorker: vi.fn(async () => makeEvidence().forecast),
}));
vi.mock("../src/workers/readiness-client.ts", () => ({
  runReadinessCheckInWorker: vi.fn(async () => makeEvidence().snapshot),
}));
vi.mock("../src/workers/import-session-client.ts", () => ({
  replaceSessionSourceInWorker: vi.fn(async (envelope: SessionEnvelope) => ({
    ...envelope,
    session: {
      ...envelope.session,
      sourceMode: "user",
      dataset: {
        sourceMode: "user",
        sourceName: "test.csv",
        sourceSha256: "hash",
        sourceByteLength: 0,
        delimiter: ",",
        columns: [],
        rows: [],
        normalizations: [],
      },
    },
  })),
}));
vi.mock("../src/screens/UploadScreen.tsx", () => ({
  UploadScreen: ({
    onSource,
  }: ComponentProps<
    typeof import("../src/screens/UploadScreen.tsx").UploadScreen
  >) => (
    <button
      onClick={() =>
        void onSource(
          new Uint8Array(),
          "test.csv",
          "user",
          "text/csv",
          () => {},
          new AbortController().signal,
        )
      }
    >
      Load test file
    </button>
  ),
}));
vi.mock("../src/screens/MappingScreen.tsx", () => ({
  MappingScreen: ({ onContinue }: { onContinue: () => void }) => (
    <button onClick={onContinue}>Check test readiness</button>
  ),
}));
vi.mock("../src/screens/ReadinessScreen.tsx", () => ({
  ReadinessScreen: ({ onContinue }: { onContinue: () => void }) => (
    <button onClick={onContinue}>Run test forecast</button>
  ),
}));

async function reachPurchase() {
  fireEvent.click(screen.getByText("Load test file"));
  fireEvent.click(await screen.findByText("Check test readiness"));
  fireEvent.click(await screen.findByText("Run test forecast"));
  await screen.findByRole("heading", { name: "Your purchase plan" });
}
const open = () =>
  fireEvent.click(
    screen.getByRole("button", { name: /Open purchase plan.*000101/ }),
  );

describe("App forecast and draft lifecycle", () => {
  it("input edits never rerun forecasting; navigation retains drafts; Clear session and replacement discard drafts", async () => {
    vi.mocked(runDemandForecastInWorker).mockClear();
    const store = vi.spyOn(Storage.prototype, "setItem");
    render(<App />);
    await reachPurchase();
    expect(runDemandForecastInWorker).toHaveBeenCalledTimes(1);
    open();
    fireEvent.change(screen.getByLabelText("Planned order"), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText("Incoming stock"), {
      target: { value: "4" },
    });
    expect(runDemandForecastInWorker).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(
      screen.getByRole("button", { name: "← Back to readiness" }),
    );
    fireEvent.click(screen.getByText("Run test forecast"));
    open();
    expect(
      (screen.getByLabelText("Planned order") as HTMLInputElement).value,
    ).toBe("20");
    expect(runDemandForecastInWorker).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear session" }));
    await reachPurchase();
    open();
    expect(
      (screen.getByLabelText("Planned order") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByLabelText("Incoming stock") as HTMLInputElement).value,
    ).toBe("");
    fireEvent.change(screen.getByLabelText("Planned order"), {
      target: { value: "9" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "StockLess — upload" }));
    await reachPurchase();
    open();
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Planned order") as HTMLInputElement).value,
      ).toBe(""),
    );
    expect(store).not.toHaveBeenCalled();
    store.mockRestore();
  });
});
