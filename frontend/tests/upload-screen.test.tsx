import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

it.each([false, true])("continues directly with sample data even with a saved plan: %s", async hasSavedPlan => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, text: async () => "date,sku,qty\n2026-09-15,A1,2" } as Response);
  const onSource = vi.fn<ImportSource>(async () => {});
  render(<UploadScreen onSource={onSource} onCancel={() => {}} hasSavedPlan={hasSavedPlan} />);
  expect(screen.getByText(/Sample dates adjust to today/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Use sample file" }));
  await waitFor(() => expect(onSource).toHaveBeenCalledOnce());
  const call = onSource.mock.calls[0]!;
  expect(call[2]).toBe("sample");
  expect(call[7]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(new TextDecoder().decode(call[0])).toContain(`${call[7]},A1,2`);
});

it("requires an explicit replacement choice and imports only the new file", async () => {
  const onSource = vi.fn<ImportSource>(async () => {});
  render(<UploadScreen onSource={onSource} onCancel={() => {}} currentFileName="September.csv" hasSavedPlan />);
  fireEvent.change(screen.getByLabelText("Choose CSV or Excel file"), { target: { files: [salesFile("October.csv")] } });
  expect(onSource).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Continue to matching →" }));
  const dialog = screen.getByRole("dialog", { name: "Replace your current sales data?" });
  expect(within(dialog).getByText("September.csv")).toBeTruthy();
  expect(within(dialog).getByText("October.csv")).toBeTruthy();
  expect(dialog.textContent).toContain("Previous uploads are not combined");
  expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Keep current plan" }));
  expect(onSource).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Replace and continue" }));
  await waitFor(() => expect(onSource).toHaveBeenCalledOnce());
  expect(onSource.mock.calls[0]?.[1]).toBe("October.csv");
  expect(new TextDecoder().decode(onSource.mock.calls[0]?.[0])).toContain("2026-09-20,A1,2");
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("keeps the saved plan without importing when the user declines", () => {
  const onSource = vi.fn<ImportSource>(async () => {}), onKeepCurrentPlan = vi.fn();
  render(<UploadScreen onSource={onSource} onCancel={() => {}} hasSavedPlan currentFileName="Saved sales" onKeepCurrentPlan={onKeepCurrentPlan} />);
  fireEvent.change(screen.getByLabelText("Choose CSV or Excel file"), { target: { files: [salesFile()] } });
  fireEvent.click(screen.getByRole("button", { name: "Continue to matching →" }));
  fireEvent.click(screen.getByRole("button", { name: "Keep current plan" }));
  expect(onSource).not.toHaveBeenCalled();
  expect(onKeepCurrentPlan).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("cancels the replacement dialog without importing and restores focus", () => {
  const onSource = vi.fn<ImportSource>(async () => {});
  render(<UploadScreen onSource={onSource} onCancel={() => {}} currentFileName="Original.csv" />);
  fireEvent.change(screen.getByLabelText("Choose CSV or Excel file"), { target: { files: [salesFile()] } });
  const next = screen.getByRole("button", { name: "Continue to matching →" });
  fireEvent.click(next);
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toContain("The two files will not be combined");
  expect(dialog.textContent).not.toContain("Upload history");
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(onSource).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(next);
});

it.each(["drop", "picker"])("rejects multiple files from the %s instead of silently choosing the first", async method => {
  const { input, onSource } = upload();
  const files = [salesFile("September.csv"), salesFile("October.csv")];
  if (method === "drop") fireEvent.drop(screen.getByRole("heading", { name: "Drop your CSV or Excel file here" }).parentElement!, { dataTransfer: { files } });
  else fireEvent.change(input, { target: { files } });
  expect(screen.getByRole("alert").textContent).toContain("Choose one file. StockLess doesn’t combine multiple files.");
  expect(screen.queryByRole("button", { name: "Continue to matching →" })).toBeNull();
  expect(onSource).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { files: [salesFile("Both months.csv")] } });
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Continue to matching →" }));
  await waitFor(() => expect(onSource).toHaveBeenCalledOnce());
  expect(onSource.mock.calls[0]?.[1]).toBe("Both months.csv");
});

it.each(["zh", "ms"] as const)("translates the replacement confirmation in %s without losing the selected file", async language => {
  const onSource = vi.fn<ImportSource>(async () => {});
  render(<UploadScreen onSource={onSource} onCancel={() => {}} currentFileName="Original.csv" hasSavedPlan />);
  fireEvent.change(screen.getByLabelText("Choose CSV or Excel file"), { target: { files: [salesFile()] } });
  fireEvent.click(screen.getByRole("button", { name: "Continue to matching →" }));
  act(() => setLanguage(language));
  const dialog = screen.getByRole("dialog", { name: language === "zh" ? "替换当前销售数据？" : "Gantikan data jualan semasa?" });
  expect(within(dialog).getByText("Original.csv")).toBeTruthy();
  expect(within(dialog).getByText("sales.csv")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: language === "zh" ? "替换并继续" : "Gantikan dan teruskan" }));
  await waitFor(() => expect(onSource).toHaveBeenCalledOnce());
});
