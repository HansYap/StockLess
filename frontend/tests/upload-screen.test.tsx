import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UploadScreen } from "../src/screens/UploadScreen.tsx";
import { createCsvImportError, UPLOAD_REQUIREMENTS } from "../src/engine.ts";
import { setLanguage } from "../src/i18n/index.ts";
import type { ComponentProps } from "react";

type ImportSource = ComponentProps<typeof UploadScreen>["onSource"];

beforeEach(() => setLanguage("en"));
afterEach(() => { cleanup(); vi.restoreAllMocks(); setLanguage("en"); });

function salesFile(name = "sales.csv") {
  const bytes = new TextEncoder().encode("date,product,quantity\n2026-09-20,A1,2");
  const file = new File([bytes], name, { type: "text/csv" });
  Object.defineProperty(file, "stream", { value: () => new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }) });
  return file;
}

function upload(onSource = vi.fn<ImportSource>(async () => {}), onCancel = vi.fn()) {
  render(<UploadScreen onSource={onSource} onCancel={onCancel} />);
  return { onSource, onCancel, input: screen.getByLabelText("Choose CSV or Excel file") };
}

it("stages dropped data until Continue and keeps the file when the language changes", async () => {
  const { onSource } = upload();
  const file = salesFile();
  fireEvent.drop(screen.getByRole("heading", { name: "Drop your CSV or Excel file here" }).parentElement!, { dataTransfer: { files: [file] } });
  expect(onSource).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue to matching →" }));
  act(() => setLanguage("ms"));
  expect(screen.getByText("sales.csv")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Teruskan →" }));
  await waitFor(() => expect(onSource).toHaveBeenCalledOnce());
  expect(onSource.mock.calls[0]?.[1]).toBe("sales.csv");
});

it("rejects unsupported and oversized replacements before importing", () => {
  const { input, onSource } = upload();
  fireEvent.change(input, { target: { files: [salesFile()] } });
  fireEvent.change(input, { target: { files: [salesFile("sales.pdf")] } });
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Continue to matching →" })).toBeNull();
  const large = salesFile();
  Object.defineProperty(large, "size", { value: UPLOAD_REQUIREMENTS.maxBytes + 1 });
  fireEvent.change(input, { target: { files: [large] } });
  expect(screen.getByRole("alert").textContent).toContain("Larger than 10 MiB");
  expect(onSource).not.toHaveBeenCalled();
});

it("shows import recovery and allows retrying the selected file", async () => {
  const onSource = vi.fn().mockRejectedValueOnce(createCsvImportError("INVALID_UTF8", "sales.csv")).mockResolvedValueOnce(undefined);
  const { input } = upload(onSource);
  fireEvent.change(input, { target: { files: [salesFile()] } });
  fireEvent.click(screen.getByRole("button", { name: "Continue to matching →" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("sales.csv")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Continue to matching →" }));
  await waitFor(() => expect(onSource).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

it("cancels an active import and prevents its late rejection from appearing", async () => {
  let signal: AbortSignal | undefined;
  const onSource = vi.fn<ImportSource>((_bytes, _name, _mode, _mime, _progress, activeSignal) => {
    signal = activeSignal;
    return new Promise<void>((_resolve, reject) => activeSignal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true }));
  });
  const onCancel = vi.fn();
  const { input } = upload(onSource, onCancel);
  fireEvent.change(input, { target: { files: [salesFile()] } });
  fireEvent.click(screen.getByRole("button", { name: "Continue to matching →" }));
  await waitFor(() => expect(onSource).toHaveBeenCalledOnce());
  expect(screen.getByRole("progressbar")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(signal?.aborted).toBe(true);
  expect(onCancel).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByText("sales.csv")).toBeNull();
});

it("continues directly with sample data", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, text: async () => "date,sku,qty\n2026-09-15,A1,2" } as Response);
  const onSource = vi.fn<ImportSource>(async () => {});
  render(<UploadScreen onSource={onSource} onCancel={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Use sample file" }));
  await waitFor(() => expect(onSource).toHaveBeenCalledOnce());
  expect(onSource.mock.calls[0]?.[2]).toBe("sample");
});
