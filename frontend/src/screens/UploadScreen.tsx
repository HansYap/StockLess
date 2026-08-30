import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  CsvImportError,
  CAPABILITY_LABELS,
  PRIVACY_NOTICE,
  UPLOAD_ATTRIBUTE_GUIDE,
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
  const requiredAttributes = UPLOAD_ATTRIBUTE_GUIDE.filter((item) => item.requirement === "required");
  const optionalAttributes = UPLOAD_ATTRIBUTE_GUIDE.filter((item) => item.requirement === "optional");

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
          <h2 className="card-title">What data can StockLess use?</h2>
          <p className="card-sub attribute-guide__intro">
            Start with the three required attributes. The six optional attributes are not needed to continue.
          </p>

          <AttributeSection
            id="required-data"
            title="Required data"
            items={requiredAttributes}
            startIndex={0}
          />
          <AttributeSection
            id="optional-data"
            title="Optional data"
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
  return (
    <section className="attribute-section" aria-labelledby={id}>
      <div className="attribute-section__head">
        <h3 id={id}>{title}</h3>
        <span className="pill pill--grey">{items.length} attributes</span>
      </div>
      <div className="attribute-list">
        {items.map((item, index) => (
          <article className="attribute-card" key={item.id}>
            <div className="attribute-card__head">
              <span className="attribute-card__number">{String(startIndex + index + 1).padStart(2, "0")}</span>
              <h4>{item.label}</h4>
              <span className={`attribute-mark attribute-mark--${item.requirement}`}>
                {item.requirement === "required" ? "Required" : "Optional"}
              </span>
            </div>
            <p>{item.description}</p>
            {item.acceptedForms && (
              <ol className="accepted-forms" aria-label="Two accepted ways to name a product">
                {item.acceptedForms.map((form) => <li key={form}>{form}</li>)}
              </ol>
            )}
            <div className="attribute-card__features">
              <b>Unlocks</b>
              <ul>
                {item.capabilities.map((capability) => (
                  <li key={capability}>{CAPABILITY_LABELS[capability]}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
