import { t, useLanguage } from "../i18n/index.ts";
import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { excelToCsvBytes } from "./excel-import.ts";
import "./upload.css";
import {
  CsvImportError,
  PRIVACY_NOTICE,
  UPLOAD_REQUIREMENTS,
  addCalendarDays,
  calendarDaysBetween,
  createCsvImportError,
  parseIsoDate,
  type CsvProgress,
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
  ) => Promise<void>;
  readonly onCancel: () => void;
  readonly savedMatchingCount: number;
  readonly deletingSavedMatchings: boolean;
  readonly onDeleteSavedMatchings: () => void;
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
  savedMatchingCount,
  deletingSavedMatchings,
  onDeleteSavedMatchings,
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
      await onSource(bytes, name, mode, mimeType, setProgress, controller.signal);
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
    await run(file.name, "user", isExcel ? "text/csv;converted-from=excel" : file.type || undefined, file.size, async (signal, onReadProgress) => {
      if (file.size > UPLOAD_REQUIREMENTS.maxBytes) {
        throw createCsvImportError("FILE_TOO_LARGE", file.name);
      }
      const bytes = await readFileBytes(file, signal, onReadProgress);
      if (signal.aborted) throw new DOMException("Import cancelled.", "AbortError");
      if (!isExcel) return bytes;
      setProgress({ phase: "decode", processed: file.size, total: file.size });
      const csv = await excelToCsvBytes(bytes, file.name);
      if (signal.aborted) throw new DOMException("Import cancelled.", "AbortError");
      return csv;
    });
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
    onCancel();
  }

  function selectFile(file: File) {
    if (busy) return;
    setFailure(null);
    const code = !/\.(csv|xlsx|xls)$/i.test(file.name) ? "UNSUPPORTED_FILE_TYPE"
      : file.size > UPLOAD_REQUIREMENTS.maxBytes ? "FILE_TOO_LARGE" : null;
    if (code) {
      const rejection = createCsvImportError(code, file.name);
      setSelectedFile(null);
      setFailure({ message: rejection.message, recovery: rejection.recovery });
      return;
    }
    setSelectedFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) selectFile(file);
  }

  return (
    <div className="upload-screen">
      <header className={compactTitle ? "upload-hero upload-hero--compact" : "upload-hero"}>
        <div className="upload-wrap upload-hero__inner">
          <p className="upload-hero__eyebrow"><span aria-hidden="true">🌱</span> {t("Step 1 of 4")}</p>
          <h1>{t("Upload your sales file")}</h1>
          <p className="upload-hero__lede">{t("Use the CSV or Excel export from your POS, marketplace or spreadsheet. Column names don't need to match ours.")}</p>
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
                  <button type="button" className="btn btn--ghost" onClick={() => void handleSample()}>{t("Use sample file")}</button>
                </div>
                <p className="upload-limits">{t(".csv, .xlsx or .xls")} {t("up to ")}{megabyteLimit} {t("MiB ·")} {UPLOAD_REQUIREMENTS.maxRows.toLocaleString("en")} {t("rows ·")} {t("Excel uses the first worksheet with data")}</p>
                <ol className="upload-flow" aria-label={t("What happens to your file")}>
                  {FLOW.map(([icon, label]) => <li key={label}><UploadIcon name={icon} /><span>{t(label)}</span></li>)}
                </ol>
              </>}
              <input ref={inputRef} type="file" aria-label={t("Choose CSV or Excel file")}
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                hidden disabled={busy} onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) selectFile(file);
                  event.target.value = "";
                }} />
            </div>
            {selectedFile && !busy && <div className="upload-picked">
              <span className="upload-picked__icon" aria-hidden="true">{selectedFile.name.split(".").pop()?.toUpperCase()}</span>
              <div className="upload-picked__details"><b>{selectedFile.name}</b><small>{(selectedFile.size / 1024).toFixed(selectedFile.size < 102400 ? 1 : 0)} KB</small></div>
              <span className="upload-tag" role="status">{t("Ready to match")}</span>
              <button ref={continueRef} type="button" className="btn btn--primary" onClick={() => void handleFile(selectedFile)}>{t("Continue to matching →")}</button>
            </div>}
            {failure && <div className="alert alert--error" role="alert">
              <span className="alert__icon" aria-hidden="true">!</span>
              <div><p className="alert__title">{t(failure.message)}</p><p className="alert__body">{t(failure.recovery)}</p></div>
            </div>}
            <div className="upload-privacy">
              <span className="upload-privacy__tick" aria-hidden="true">✓</span>
              <div><b>{t("Your data stays on your device.")}</b><p>{t(PRIVACY_NOTICE.beforeUpload)}</p></div>
            </div>
            {savedMatchingCount > 0 && <div className="saved-setup" aria-label={t("Saved column matching")}>
              <div><b>{savedMatchingCount} {t("saved column ")}{t(savedMatchingCount === 1 ? "matching" : "matchings")}</b>
                <span>{t("Only column headings and matching rules are stored for returning use.")}</span></div>
              <button type="button" className="btn btn--small btn--ghost" disabled={deletingSavedMatchings} onClick={onDeleteSavedMatchings}>
                {t(deletingSavedMatchings ? "Deleting…" : "Delete saved matching")}</button>
            </div>}
          </section>
          <aside className="upload-guidance" aria-label={t("Required and optional columns")}>
            <section className="upload-card upload-needed">
              <h2><span aria-hidden="true">🌱</span> {t("Your file needs three columns")}</h2>
              <p>{t("You'll pair them up in the next step.")}</p>
              <ul>{REQUIRED_COLUMNS.map(([icon, title, description, example]) => <li key={title}>
                <span className="upload-guidance__icon"><UploadIcon name={icon} /></span>
                <span className="upload-guidance__text"><b>{t(title)}</b><small>{t(description)}</small></span>
                <span className="upload-example">{example}</span>
              </li>)}</ul>
            </section>
            <section className="upload-card upload-optional">
              <h2><span aria-hidden="true">🪴</span> {t("Optional columns add more")}</h2>
              <ul>{OPTIONAL_COLUMNS.map(([icon, title, description, tag]) => <li key={title}>
                <span className="upload-guidance__icon"><UploadIcon name={icon} /></span>
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
  ["cost", "Unit cost", "Price your impact in ringgit", "Not yet available"],
  ["truck", "Supplier details", "Minimum order, case size, lead time", "Typed in Step 4"],
] as const;
const FLOW = [["document", "Your sales data"], ["chart", "Demand insights"], ["box", "Smarter restocking"], ["leaf", "Less waste"]] as const;
const ICON_PATHS = {
  calendar: "M4 5h16v15H4ZM4 10h16M8 3v4m8-4v4",
  barcode: "M4 5v14M7 5v14M10 5v14M14 5v14M17 5v14M20 5v14",
  cart: "M3 4h2l2.2 10.5h10.9L20 8H6.2M10.4 19a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 1 1 2.8 0m8 0a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 1 1 2.8 0",
  box: "m3 7 9-4 9 4v10l-9 4-9-4ZM3 7l9 4 9-4M12 11v10",
  document: "M6 3h8l4 4v14H6ZM14 3v5h4M9 12h6M9 16h6",
  expiry: "M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9m8-18c0 5-8 5-8 9s8 4 8 9",
  cost: "M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2m0 8v2",
  truck: "M3 6h11v10H3ZM14 9h4l3 3v4h-7M8.6 17.5a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 1 1 3.2 0m10 0a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 1 1 3.2 0",
  chart: "M3 21h18M5 20V12h3v8M11 20V7h3v13M17 20V3h3v17",
  leaf: "M20 4C5 3 2 9 5 16c7 8 15-2 15-12ZM4 21 16 8",
} as const;
function UploadIcon({ name }: { readonly name: keyof typeof ICON_PATHS }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON_PATHS[name]} /></svg>;
}
