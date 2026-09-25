import { t, useLanguage } from "../i18n/index.ts";
import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  CsvImportError,
  CAPABILITY_LABELS,
  PRIVACY_NOTICE,
  UPLOAD_ATTRIBUTE_GUIDE,
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

const SAMPLE_REFERENCE_DATE = "2026-09-03";

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

/** Screen 01. Accepts a retailer CSV or the bundled sample and reports failures. */
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

  const megabyteLimit = Math.round(UPLOAD_REQUIREMENTS.maxBytes / (1024 * 1024));
  const requiredAttributes = UPLOAD_ATTRIBUTE_GUIDE.filter((item) => item.requirement === "required");
  const optionalAttributes = UPLOAD_ATTRIBUTE_GUIDE.filter((item) => item.requirement === "optional");

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
    await run(file.name, "user", file.type || undefined, file.size, async (signal, onReadProgress) => {
      if (file.size > UPLOAD_REQUIREMENTS.maxBytes) {
        throw createCsvImportError("FILE_TOO_LARGE", file.name);
      }
      return readFileBytes(file, signal, onReadProgress);
    });
  }

  async function handleSample() {
    await run("sample_with_issues.csv", "sample", "text/csv", 0, async (signal) => {
      const response = await fetch("/samples/sample_with_issues.csv", { signal });
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
    onCancel();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <>
      <p className="eyebrow">{t("Start with what you already have")}</p>
      <h1 className="title">{t("Upload your existing sales file.")}</h1>
      <p className="lede">{t(UPLOAD_REQUIREMENTS.coreDescription)}</p>

      <div className="s1-grid">
        <div>
          <h2 className="card-title">{t("What data can StockLess use?")}</h2>
          <p className="card-sub attribute-guide__intro">
            {t("Start with the three required attributes. The six optional attributes are not needed to continue.")}</p>

          <AttributeSection
            id="required-data"
            title={t("Required data")}
            items={requiredAttributes}
            startIndex={0}
          />
          <AttributeSection
            id="optional-data"
            title={t("Optional data")}
            items={optionalAttributes}
            startIndex={requiredAttributes.length}
          />
        </div>

        <div className="card upload-card">
          <div
            className={`dropzone${dragging ? " dropzone--active" : ""}${failure ? " dropzone--error" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <div className="csv-badge" aria-hidden="true"><span>{t("CSV")}</span></div>

            {t(busy ? (
              <>
                <h3>{t(progress ? PHASE_LABEL[progress.phase] : "Reading the file")}</h3>
                <p>
                  {t(progress && progress.total > 0
                    ? `${Math.min(100, Math.round((progress.processed / progress.total) * 100))}% complete${progress.phase === "complete" ? ` · still working (${finishingSeconds}s)` : ""}`
                    : "Working in this browser…")}
                </p>
                <div
                  className="progress"
                  role="progressbar"
                  aria-label={t("Import progress")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress && progress.total > 0
                    ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
                    : 0}
                >
                  <span
                    className="progress__fill"
                    style={{
                      width: progress && progress.total > 0
                        ? `${Math.min(100, (progress.processed / progress.total) * 100)}%`
                        : "10%",
                    }}
                  />
                </div>
                <button type="button" className="btn btn--ghost btn--small" onClick={cancelImport}>
                  {t("Cancel")}</button>
              </>
            ) : (
              <>
                <h3>{t("Drop your CSV file here")}</h3>
                <p>{t("Use the export from your POS, marketplace or spreadsheet.")}</p>
                <div className="dropzone__actions">
                  <button type="button" className="btn btn--primary" onClick={() => inputRef.current?.click()}>
                    {t("Choose CSV file")}</button>
                  <button type="button" className="btn btn--ghost" onClick={() => void handleSample()}>
                    {t("Use sample file")}</button>
                </div>
                <p className="dropzone__limits">
                  {t(UPLOAD_REQUIREMENTS.supportedExtension)} {t("up to ")}{t(megabyteLimit)} {t("MiB ·")}{t(" ")}{t(UPLOAD_REQUIREMENTS.maxRows.toLocaleString("en"))} {t("rows ·")}{t(" ")}{t("comma, semicolon or tab")}</p>
              </>
            ))}

            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
            />
          </div>

          {t(failure && (
            <div className="alert alert--error" role="alert">
              <span className="alert__icon" aria-hidden="true">!</span>
              <div>
                <p className="alert__title">{t(failure.message)}</p>
                <p className="alert__body">{t(failure.recovery)}</p>
              </div>
            </div>
          ))}

          <div className="privacy">
            <span className="privacy__tick" aria-hidden="true">✓</span>
            <p>
              <b>{t("Your sales figures stay in this browser.")}</b>
              <span>{t(PRIVACY_NOTICE.beforeUpload)}</span>
            </p>
          </div>

          {t(savedMatchingCount > 0 && (
            <div className="saved-setup" aria-label={t("Saved column matching")}>
              <div>
                <b>
                  {t(savedMatchingCount)} {t("saved column ")}{t(savedMatchingCount === 1 ? "matching" : "matchings")}
                </b>
                <span>{t("Only column headings and matching rules are stored for returning use.")}</span>
              </div>
              <button
                type="button"
                className="btn btn--small btn--ghost"
                disabled={deletingSavedMatchings}
                onClick={onDeleteSavedMatchings}
              >
                {t(deletingSavedMatchings ? "Deleting…" : "Delete saved matching")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function AttributeSection({
  id,
  title,
  items,
  startIndex,
}: {
  readonly id: string;
  readonly title: string;
  readonly items: typeof UPLOAD_ATTRIBUTE_GUIDE;
  readonly startIndex: number;
}) {
  useLanguage();
  return (
    <section className="attribute-section" aria-labelledby={id}>
      <div className="attribute-section__head">
        <h3 id={id}>{t(title)}</h3>
        <span className="pill pill--grey">{t(items.length)} {t("attributes")}</span>
      </div>
      <div className="attribute-list">
        {t(items.map((item, index) => (
          <article className="attribute-card" key={item.id}>
            <div className="attribute-card__head">
              <span className="attribute-card__number">{t(String(startIndex + index + 1).padStart(2, "0"))}</span>
              <h4>{t(item.label)}</h4>
              <span className={`attribute-mark attribute-mark--${item.requirement}`}>
                {t(item.requirement === "required" ? "Required" : "Optional")}
              </span>
            </div>
            <p>{t(item.description)}</p>
            {t(item.acceptedForms && (
              <ol className="accepted-forms" aria-label={t("Two accepted ways to name a product")}>
                {t(item.acceptedForms.map((form) => <li key={form}>{t(form)}</li>))}
              </ol>
            ))}
            <div className="attribute-card__features">
              <b>{t("Unlocks")}</b>
              <ul>
                {t(item.capabilities.map((capability) => (
                  <li key={capability}>{t(CAPABILITY_LABELS[capability])}</li>
                )))}
              </ul>
            </div>
          </article>
        )))}
      </div>
    </section>
  );
}
