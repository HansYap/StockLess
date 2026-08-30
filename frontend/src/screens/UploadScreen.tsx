import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  CsvImportError,
  CANONICAL_FIELDS,
  CORE_COLUMN_PATHS,
  FIELD_REGISTRY,
  PRIVACY_NOTICE,
  UPLOAD_REQUIREMENTS,
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
}

interface ImportFailure {
  readonly code: string;
  readonly message: string;
  readonly recovery: string;
}

const PHASE_LABEL: Readonly<Record<CsvProgress["phase"], string>> = {
  decode: "Reading the file",
  detect_delimiter: "Detecting the delimiter",
  parse: "Parsing rows",
  complete: "Finishing up",
};

/** Screen 01. Accepts a retailer CSV or the bundled sample and reports failures. */
export function UploadScreen({ onSource }: UploadScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<CsvProgress | null>(null);
  const [failure, setFailure] = useState<ImportFailure | null>(null);
  const [dragging, setDragging] = useState(false);

  const megabyteLimit = Math.round(UPLOAD_REQUIREMENTS.maxBytes / (1024 * 1024));
  const coreGuidance = useMemo(() => [
    FIELD_REGISTRY.transaction_date,
    {
      field: "product_identity",
      label: "Product identity",
      description: CORE_COLUMN_PATHS.map((path) => path.label).join(" or "),
      unlocks: ["Separate product and pack histories"],
    },
    FIELD_REGISTRY.quantity_sold,
  ], []);
  const additionalFields = useMemo(
    () => CANONICAL_FIELDS
      .filter((field) => !["transaction_date", "product_code", "product_name", "pack_variant", "quantity_sold"].includes(field))
      .map((field) => FIELD_REGISTRY[field]),
    [],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  async function run(
    bytes: Uint8Array,
    name: string,
    mode: SourceMode,
    mimeType: string | undefined,
  ) {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setFailure(null);
    setBusy(true);
    setProgress({ phase: "decode", processed: 0, total: bytes.byteLength });
    try {
      await onSource(bytes, name, mode, mimeType, setProgress, controller.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setFailure({
          code: "IMPORT_CANCELLED",
          message: "Import cancelled.",
          recovery: "Your previous session was left unchanged. Choose a file when you are ready.",
        });
      } else if (error instanceof CsvImportError) {
        setFailure({ code: error.code, message: error.message, recovery: error.recovery });
      } else {
        setFailure({
          code: "UNEXPECTED",
          message: error instanceof Error ? error.message : "The file could not be read.",
          recovery: "Try the file again, or choose a different export.",
        });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleFile(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await run(bytes, file.name, "user", file.type || undefined);
  }

  async function handleSample() {
    setFailure(null);
    setBusy(true);
    try {
      const response = await fetch("/samples/sample_with_issues.csv");
      const bytes = new Uint8Array(await response.arrayBuffer());
      await run(bytes, "sample_with_issues.csv", "sample", "text/csv");
    } catch {
      setFailure({
        code: "SAMPLE_UNAVAILABLE",
        message: "The sample file could not be loaded.",
        recovery: "Reload the page, or choose your own CSV instead.",
      });
      setBusy(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <>
      <p className="eyebrow">Start with what you already have</p>
      <h1 className="title">Upload your existing sales file.</h1>
      <p className="lede">{UPLOAD_REQUIREMENTS.coreDescription}</p>

      <div className="s1-grid">
        <div>
          <h2 className="card-title">What can StockLess work with?</h2>
          <div className="s1-list">
            {coreGuidance.map((item, index) => (
              <div className="s1-item" key={item.field}>
                <span className="s1-item__n">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <div className="s1-item__t">{item.label}</div>
                  <div className="s1-item__d">{item.description}</div>
                  <div className="s1-item__unlock">Unlocks: {item.unlocks.join(" · ")}</div>
                </div>
              </div>
            ))}
          </div>
          <details className="field-guide">
            <summary>Additional fields unlock more capabilities</summary>
            <div className="field-guide__list">
              {additionalFields.map((field) => (
                <div className="field-guide__item" key={field.field}>
                  <b>{field.label}</b>
                  <span>{field.status === "later_locked" ? "Later / feature-dependent" : "Feature-dependent"}</span>
                  <small>{field.unlocks.join(" · ")}</small>
                </div>
              ))}
            </div>
          </details>
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
            <div className="csv-badge" aria-hidden="true"><span>CSV</span></div>

            {busy ? (
              <>
                <h3>{progress ? PHASE_LABEL[progress.phase] : "Reading the file"}</h3>
                <p>
                  {progress && progress.total > 0
                    ? `${Math.min(100, Math.round((progress.processed / progress.total) * 100))}% complete`
                    : "Working in this browser…"}
                </p>
                <div className="progress" role="progressbar" aria-label="Import progress">
                  <span
                    className="progress__fill"
                    style={{
                      width: progress && progress.total > 0
                        ? `${Math.min(100, (progress.processed / progress.total) * 100)}%`
                        : "10%",
                    }}
                  />
                </div>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => abortRef.current?.abort()}>
                  Cancel import
                </button>
              </>
            ) : (
              <>
                <h3>Drop your CSV file here</h3>
                <p>Use the export from your POS, marketplace or spreadsheet.</p>
                <div className="dropzone__actions">
                  <button type="button" className="btn btn--primary" onClick={() => inputRef.current?.click()}>
                    Choose CSV file
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => void handleSample()}>
                    Use sample file
                  </button>
                </div>
                <p className="dropzone__limits">
                  {UPLOAD_REQUIREMENTS.supportedExtension} up to {megabyteLimit} MB ·
                  {" "}{UPLOAD_REQUIREMENTS.maxRows.toLocaleString("en")} rows ·
                  {" "}comma, semicolon or tab
                </p>
              </>
            )}

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

          {failure && (
            <div className="alert alert--error" role="alert">
              <span className="alert__icon" aria-hidden="true">!</span>
              <div>
                <p className="alert__title">{failure.message}</p>
                <p className="alert__body">{failure.recovery}</p>
                <p className="alert__code">{failure.code}</p>
              </div>
            </div>
          )}

          <div className="privacy">
            <span className="privacy__tick" aria-hidden="true">✓</span>
            <p>
              <b>Your sales figures stay in this browser.</b>
              <span>{PRIVACY_NOTICE.beforeUpload}</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
