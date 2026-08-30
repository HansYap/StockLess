import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  CsvImportError,
  CAPABILITY_LABELS,
  PRIVACY_NOTICE,
  UPLOAD_ATTRIBUTE_GUIDE,
  UPLOAD_REQUIREMENTS,
  createCsvImportError,
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
export function UploadScreen({ onSource, onCancel }: UploadScreenProps) {
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
      return new Uint8Array(await response.arrayBuffer());
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
                <div
                  className="progress"
                  role="progressbar"
                  aria-label="Import progress"
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
                  Cancel
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
                  {UPLOAD_REQUIREMENTS.supportedExtension} up to {megabyteLimit} MiB ·
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
