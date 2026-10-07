import { t, useLanguage } from "../i18n/index.ts";
import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { inspectExcelWorkbook, importExcelWorksheet, type ExcelWorksheet } from "./excel-import.ts";
import "./upload.css";
import { WorkflowIcon } from "../components/WorkflowIcon.tsx";
import {
  CsvImportError,
  PRIVACY_NOTICE,
  UPLOAD_REQUIREMENTS,
  addCalendarDays,
  calendarDaysBetween,
  createCsvImportError,
  parseIsoDate,
  type CsvProgress,
  type ImportSourceMetadata,
  type SourceMode,
} from "../engine.ts";

interface UploadScreenProps {
  /** Hands raw bytes to the session layer; rejects with CsvImportError on bad input. */
  readonly onSource: (
    bytes: Uint8Array,
    sourceName: string,
    sourceMode: SourceMode,
    mimeType: string | undefined,
    onProgress: (progress: CsvProgress) => void,
    signal: AbortSignal,
    sourceMetadata?: ImportSourceMetadata,
  ) => Promise<void>;
  readonly onCancel: () => void;
  readonly updating?: boolean;
}

interface ImportFailure {
  readonly message: string;
  readonly recovery: string;
}

const PHASE_LABEL: Readonly<Record<CsvProgress["phase"], string>> = {
  decode: "Reading the file",
  detect_delimiter: "Detecting the delimiter",
  parse: "Parsing rows",
  complete: "Finishing up",
};

// The bundled sample marks 2026-09-15 as its analysis day (SMP-TODAY-001).
const SAMPLE_REFERENCE_DATE = "2026-09-15";

/** Keeps the built-in example useful without removing its intentional old/future-date cases. */
export function rebaseSampleCsvDates(csv: string, targetAnalysisDate: string): string {
  const offset = calendarDaysBetween(SAMPLE_REFERENCE_DATE, targetAnalysisDate);
  return csv.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (value) =>
    parseIsoDate(value) ? addCalendarDays(value, offset) : value);
}

/** Reads a browser File in cancellable chunks while reporting visible progress. */
async function readFileBytes(
  file: File,
  signal: AbortSignal,
  onProgress: (processed: number) => void,
): Promise<Uint8Array> {
  const reader = file.stream().getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const cancelReader = () => void reader.cancel(signal.reason);
  signal.addEventListener("abort", cancelReader, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new DOMException("Import cancelled.", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
      onProgress(total);
    }
  } finally {
    signal.removeEventListener("abort", cancelReader);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Screen 01. Accepts retailer CSV/Excel files or the bundled sample. */
export function UploadScreen({
  onSource,
  onCancel,
  updating = false,
}: UploadScreenProps) {
  useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<CsvProgress | null>(null);
  const [finishingSeconds, setFinishingSeconds] = useState(0);
  const [failure, setFailure] = useState<ImportFailure | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<{ bytes: Uint8Array; sheets: readonly ExcelWorksheet[] } | null>(null);
  const [worksheetName, setWorksheetName] = useState("");
  const chosenSheet = workbook?.sheets.find(sheet => sheet.name === worksheetName);

  const [compactTitle, setCompactTitle] = useState(false);
  const continueRef = useRef<HTMLButtonElement>(null);

  const megabyteLimit = Math.round(UPLOAD_REQUIREMENTS.maxBytes / (1024 * 1024));

  useEffect(() => {
    const update = () => setCompactTitle((compact) => window.scrollY > 140 || (compact && window.scrollY >= 40));
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => { if (selectedFile) continueRef.current?.focus(); }, [selectedFile]);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!busy || progress?.phase !== "complete") {
      setFinishingSeconds(0);
      return;
    }
    const timer = window.setInterval(() => setFinishingSeconds((seconds) => seconds + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [busy, progress?.phase]);

  async function run(
    name: string,
    mode: SourceMode,
    mimeType: string | undefined,
    expectedBytes: number,
    loadBytes: (signal: AbortSignal, onReadProgress: (processed: number) => void) => Promise<Uint8Array>,
    sourceMetadata?: ImportSourceMetadata,
  ) {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setFailure(null);
    setBusy(true);
    setProgress({ phase: "decode", processed: 0, total: expectedBytes });
    try {
      const bytes = await loadBytes(controller.signal, (processed) => {
        setProgress({ phase: "decode", processed, total: expectedBytes });
      });
      await onSource(bytes, name, mode, mimeType, setProgress, controller.signal, sourceMetadata);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        setFailure(null);
      } else if (error instanceof CsvImportError) {
        setFailure({ message: error.message, recovery: error.recovery });
      } else {
        const rejection = createCsvImportError("INVALID_UTF8", name);
        setFailure({ message: rejection.message, recovery: rejection.recovery });
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setBusy(false);
        setProgress(null);
      }
    }
  }

  async function handleFile(file: File) {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (isExcel) {
      if (!workbook || !chosenSheet || chosenSheet.problem) return;
      const controller = new AbortController(); abortRef.current = controller;
      setBusy(true); setFailure(null); setProgress({ phase: "decode", processed: 0, total: file.size });
      try {
        const converted = await importExcelWorksheet(workbook.bytes, file.name, worksheetName, controller.signal,
          () => setProgress({ phase: "parse", processed: 0, total: 0 }));
        if (controller.signal.aborted) return;
        await onSource(converted.bytes, file.name, "user", "text/csv;converted-from=excel", setProgress, controller.signal, converted.sourceMetadata);
      } catch (error) {
        if (!controller.signal.aborted) setFailure(error instanceof CsvImportError ? { message: error.message, recovery: error.recovery }
          : { message: `The Excel workbook cannot be read: “${file.name}”`, recovery: "Choose another worksheet or correct the workbook." });
      } finally { if (abortRef.current === controller) { abortRef.current = null; setBusy(false); setProgress(null); } }
      return;
    }
    await run(file.name, "user", file.type || undefined, file.size, (signal, onReadProgress) => readFileBytes(file, signal, onReadProgress));
  }

  async function handleSample() {
    await run("sample_with_issues.csv", "sample", "text/csv", 0, async (signal) => {
      const response = await fetch("/samples/sample_with_issues.csv", { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Sample unavailable");
      const csv = await response.text();
      const analysisDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
      return new TextEncoder().encode(rebaseSampleCsvDates(csv, analysisDate));
    });
  }

  function cancelImport() {
    abortRef.current?.abort();
    setFailure(null);
    setBusy(false);
    setProgress(null);
    setSelectedFile(null);
    setWorkbook(null); setWorksheetName("");
    onCancel();
  }

  async function selectFile(file: File) {
    if (busy) return;
    setFailure(null); setWorkbook(null); setWorksheetName("");
    const code = !/\.(csv|xlsx|xls)$/i.test(file.name) ? "UNSUPPORTED_FILE_TYPE"
      : file.size > UPLOAD_REQUIREMENTS.maxBytes ? "FILE_TOO_LARGE" : null;
    if (code) {
      const rejection = createCsvImportError(code, file.name);
      setSelectedFile(null);
      setFailure({ message: rejection.message, recovery: rejection.recovery });
      return;
    }
    setSelectedFile(file);
    if (!/\.(xlsx|xls)$/i.test(file.name)) return;
    const controller = new AbortController(); abortRef.current = controller;
    setBusy(true); setProgress({ phase: "decode", processed: 0, total: file.size });
    try {
      const bytes = await readFileBytes(file, controller.signal, processed => setProgress({ phase: "decode", processed, total: file.size }));
      const sheets = await inspectExcelWorkbook(bytes, file.name, controller.signal, () => setProgress({ phase: "parse", processed: 0, total: 0 }));
      if (controller.signal.aborted) return;
      if (!sheets.some(sheet => !sheet.problem)) throw new CsvImportError("INVALID_UTF8", `No data found in the Excel workbook: “${file.name}”`, "Add a header row and sales records to a worksheet, then try again.");
      setWorkbook({ bytes, sheets });
      setWorksheetName(sheets.length === 1 ? sheets[0].name : "");
    } catch (error) {
      if (!controller.signal.aborted) { setSelectedFile(null); setFailure(error instanceof CsvImportError ? { message: error.message, recovery: error.recovery }
        : { message: `The Excel workbook cannot be read: “${file.name}”`, recovery: "Correct the workbook and choose it again." }); }
    } finally { if (abortRef.current === controller) { abortRef.current = null; setBusy(false); setProgress(null); } }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void selectFile(file);
  }

  return (
    <div className="upload-screen">
      <header className={compactTitle ? "upload-hero upload-hero--compact" : "upload-hero"}>
        <div className="upload-wrap upload-hero__inner">
          <p className="upload-hero__eyebrow"><span aria-hidden="true">🌱</span> {t("Step 1 of 3")}</p>
          <h1>{t(updating ? "Reupload your sales file" : "Upload your sales file")}</h1>
          <p className="upload-hero__lede">{t(updating ? "Upload one CSV or Excel sales file for your store. Your previous file stays in Upload History, up to 12 uploads." : "Use the CSV or Excel export from your POS, marketplace or spreadsheet. Column names don't need to match ours.")}</p>
        </div>
      </header>
      <main className="upload-wrap upload-main">
        <div className="upload-grid">
          <section className="upload-card upload-drop" aria-label={t("Upload")}>
            <div className={"upload-zone" + (dragging ? " upload-zone--active" : "") + (failure ? " upload-zone--error" : "")}
              onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
              onDrop={handleDrop} aria-busy={busy}>
              <div className="upload-file-badge" aria-hidden="true"><span>CSV /<br />XLS</span></div>
              {busy ? <>
                <h2>{t(progress ? PHASE_LABEL[progress.phase] : "Reading the file")}</h2>
                <p role="status">{t(progress && progress.total > 0
                  ? Math.min(100, Math.round(progress.processed / progress.total * 100)) + "% complete" + (progress.phase === "complete" ? " · still working (" + finishingSeconds + "s)" : "")
                  : "Working in this browser…")}</p>
                <div className="progress" role="progressbar" aria-label={t("Import progress")}
                  aria-valuemin={0} aria-valuemax={100}
                  aria-valuenow={progress && progress.total > 0 ? Math.min(100, Math.round(progress.processed / progress.total * 100)) : 0}>
                  <span className="progress__fill" style={{ width: progress && progress.total > 0 ? Math.min(100, progress.processed / progress.total * 100) + "%" : "10%" }} />
                </div>
                <button type="button" className="btn btn--ghost" onClick={cancelImport}>{t("Cancel")}</button>
              </> : <>
                <h2>{t("Drop your CSV or Excel file here")}</h2>
                <p>{t("Use the export from your POS, marketplace or spreadsheet.")}</p>
                <div className="upload-actions">
                  <button type="button" className="btn btn--primary" onClick={() => inputRef.current?.click()}>{t("Choose CSV or Excel file")}</button>
                  {!updating && <button type="button" className="btn btn--ghost" onClick={() => void handleSample()}>{t("Use sample file")}</button>}
                </div>
                <p className="upload-limits">{t(".csv, .xlsx or .xls")} {t("up to ")}{megabyteLimit} {t("MiB ·")} {UPLOAD_REQUIREMENTS.maxRows.toLocaleString("en")} {t("rows ·")} {t("Choose which Excel worksheet to analyse")}</p>
                <ol className="upload-flow" aria-label={t("What happens to your file")}>
                  {FLOW.map(([icon, label]) => <li key={label}><WorkflowIcon name={icon} /><span>{t(label)}</span></li>)}
                </ol>
              </>}
              <input ref={inputRef} type="file" aria-label={t("Choose CSV or Excel file")}
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                hidden disabled={busy} onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void selectFile(file);
                  event.target.value = "";
                }} />
            </div>
            {selectedFile && !busy && <div className="upload-picked">
              <span className="upload-picked__icon" aria-hidden="true">{selectedFile.name.split(".").pop()?.toUpperCase()}</span>
              <div className="upload-picked__details"><b>{selectedFile.name}</b><small>{(selectedFile.size / 1024).toFixed(selectedFile.size < 102400 ? 1 : 0)} KB</small></div>
              <span className="upload-tag" role="status">{t("Ready to match")}</span>
              <button ref={continueRef} type="button" className="btn btn--primary" disabled={!!workbook && (!chosenSheet || !!chosenSheet.problem)} onClick={() => void handleFile(selectedFile)}>{t("Continue to matching →")}</button>
            </div>}
            {workbook && !busy && <section className="upload-sheet" aria-label={t("Worksheet preview")}>
              <label htmlFor="upload-worksheet">{t("Worksheet")}</label><select id="upload-worksheet" value={worksheetName} onChange={event => setWorksheetName(event.target.value)}><option value="">{t("Choose a worksheet")}</option>{workbook.sheets.map(sheet => <option key={sheet.name} value={sheet.name}>{sheet.name} ({sheet.rowCount})</option>)}</select>
              {chosenSheet?.problem && <p role="alert">{t(chosenSheet.problem)} {t("Choose another worksheet or correct the workbook.")}</p>}
              {chosenSheet && !chosenSheet.problem && <><p>{chosenSheet.name} · {chosenSheet.rowCount} {t("rows")} · {t("Only this worksheet will be analysed.")}</p><div className="upload-sheet__table"><table><thead><tr>{chosenSheet.headers.map((header, i) => <th key={i}>{header}</th>)}</tr></thead><tbody>{chosenSheet.previewRows.map((row, i) => <tr key={i}>{row.map((value, j) => <td key={j}>{value}</td>)}</tr>)}</tbody></table></div></>}
            </section>}
            {failure && <div className="alert alert--error" role="alert">
              <span className="alert__icon" aria-hidden="true">!</span>
              <div><p className="alert__title">{t(failure.message)}</p><p className="alert__body">{t(failure.recovery)}</p></div>
            </div>}
            <div className="upload-privacy">
              <span className="upload-privacy__tick" aria-hidden="true">✓</span>
              <div><b>{t("Your data stays on your device.")}</b><p>{t(PRIVACY_NOTICE.beforeUpload)}</p></div>
            </div>
          </section>
          <aside className="upload-guidance" aria-label={t("Required and optional columns")}>
            <section className="upload-card upload-needed">
              <h2><span aria-hidden="true">🌱</span> {t("Your file needs three columns")}</h2>
              <p>{t("You'll pair them up in the next step.")}</p>
              <ul>{REQUIRED_COLUMNS.map(([icon, title, description, example]) => <li key={title}>
                <span className="upload-guidance__icon"><WorkflowIcon name={icon} /></span>
                <span className="upload-guidance__text"><b>{t(title)}</b><small>{t(description)}</small></span>
                <span className="upload-example">{example}</span>
              </li>)}</ul>
            </section>
            <section className="upload-card upload-optional">
              <h2><span aria-hidden="true">🪴</span> {t("Optional columns add more")}</h2>
              <ul>{OPTIONAL_COLUMNS.map(([icon, title, description, tag]) => <li key={title}>
                <span className="upload-guidance__icon"><WorkflowIcon name={icon} /></span>
                <span className="upload-guidance__text"><b>{t(title)}</b><small>{t(description)}</small></span>
                {tag && <span className="upload-tag upload-tag--muted">{t(tag)}</span>}
              </li>)}</ul>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

const REQUIRED_COLUMNS = [
  ["calendar", "Sale date", "Each sale or return", "2026-02-02"],
  ["barcode", "Product", "Code, or name + pack size", "MM0001"],
  ["cart", "Quantity sold", "Returns as negatives", "2"],
] as const;
const OPTIONAL_COLUMNS = [
  ["box", "Stock on hand + count date", "See how many weeks stock will last", null],
  ["document", "Planned orders, incoming stock", "Check an order before you place it", null],
  ["expiry", "Expiry dates", "Flag batches close to expiry", null],
  ["cost", "Unit cost", "Purchase cost per unit in MYR; checked in Step 3", null],
  ["truck", "Supplier details", "Minimum order, case size, lead time", "Typed in purchase plan"],
] as const;
const FLOW = [["document", "Your sales data"], ["chart", "Demand insights"], ["box", "Smarter restocking"], ["leaf", "Less waste"]] as const;
