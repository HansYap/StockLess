import { CsvImportError } from "../engine.ts";
import { registerWorker, releaseWorker } from "../workers/worker-registry.ts";
import { processExcelWorkbook, type ExcelWorksheet, type ExcelImportResult } from "./excel-workbook.ts";
export { processExcelWorkbook, type ExcelWorksheet, type ExcelImportResult } from "./excel-workbook.ts";

async function runExcelOperation(bytes: Uint8Array, sourceName: string, worksheetName?: string, signal?: AbortSignal, onProgress?: () => void) {
  if (signal?.aborted) throw new DOMException("Import cancelled.", "AbortError");
  if (typeof Worker === "undefined") return processExcelWorkbook(bytes, sourceName, worksheetName);
  const worker = new Worker(new URL("../workers/excel-import.worker.ts", import.meta.url), { type: "module", name: "stockless-excel-import" });
  registerWorker(worker);
  return new Promise<readonly ExcelWorksheet[] | ExcelImportResult>((resolve, reject) => {
    const heartbeat = setInterval(() => onProgress?.(), 1_000);
    let settled = false;
    function finish(action: () => void) { if (settled) return; settled = true; clearInterval(heartbeat); signal?.removeEventListener("abort", abort); worker.terminate(); releaseWorker(worker); action(); }
    const abort = () => finish(() => reject(new DOMException("Import cancelled.", "AbortError")));
    signal?.addEventListener("abort", abort, { once: true });
    worker.onerror = () => finish(() => reject(new CsvImportError("INVALID_UTF8", `The Excel workbook cannot be read: “${sourceName}”`, "Correct the workbook and choose it again.")));
    worker.onmessage = event => {
      const response = event.data;
      if (response.error) finish(() => reject(new CsvImportError(response.error.code ?? "INVALID_UTF8", response.error.message, response.error.recovery)));
      else finish(() => resolve(response.result));
    };
    const copy = bytes.slice(); worker.postMessage({ bytes: copy, sourceName, worksheetName }, [copy.buffer]);
  });
}
export async function inspectExcelWorkbook(bytes: Uint8Array, sourceName: string, signal?: AbortSignal, onProgress?: () => void): Promise<readonly ExcelWorksheet[]> {
  return await runExcelOperation(bytes, sourceName, undefined, signal, onProgress) as readonly ExcelWorksheet[];
}
export async function importExcelWorksheet(bytes: Uint8Array, sourceName: string, worksheetName: string, signal?: AbortSignal, onProgress?: () => void): Promise<ExcelImportResult> {
  return await runExcelOperation(bytes, sourceName, worksheetName, signal, onProgress) as ExcelImportResult;
}
/** Compatibility helper. Multi-sheet workbooks require an explicit choice. */
export async function excelToCsvBytes(bytes: Uint8Array, sourceName: string, worksheetName?: string): Promise<Uint8Array> {
  const sheets = await inspectExcelWorkbook(bytes, sourceName);
  const usable = sheets.filter(sheet => !sheet.problem);
  if (!usable.length) throw new CsvImportError("INVALID_UTF8", "No data found in the Excel workbook", "Add a header row and sales records to a worksheet, then try again.");
  if (!worksheetName && usable.length > 1) throw new CsvImportError("INVALID_UTF8", "Choose a worksheet", "Select the worksheet to analyse before continuing.");
  return (await importExcelWorksheet(bytes, sourceName, worksheetName ?? usable[0].name)).bytes;
}
