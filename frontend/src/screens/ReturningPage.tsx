import { useCallback, useEffect, useState } from "react";
import { LanguageSwitcher } from "../components/LanguageSwitcher.tsx";
import { Logo } from "../components/Logo.tsx";
import { getLocale, useLanguage } from "../i18n/index.ts";
import { homepageDesignMessages } from "../i18n/homepage-design.ts";
import { clearEverything, listSavedDatasets, removeSavedDataset, type SavedDatasetSummary } from "../storage/saved-datasets.ts";
import "./returning.css";

/** Saved datasets replace the prototype's three example files. */
export function ReturningPage() {
  const language = useLanguage();
  const copy = (key: string) => homepageDesignMessages[language]?.[key]
    ?? homepageDesignMessages.en[key] ?? key;
  const [datasets, setDatasets] = useState<readonly SavedDatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDatasets(await listSavedDatasets());
      setError(null);
    } catch {
      setError("Saved datasets could not be read in this browser.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const deleteDataset = async (item: SavedDatasetSummary) => {
    if (!window.confirm(`Delete ${item.shopName} / ${item.datasetName}? Its ${item.rowCount} records, settings, ${item.planCount} plans, ${item.decisionCount} decisions and ${item.outcomeCount} outcomes will be removed. Other datasets will remain.`)) return;
    setBusy(true);
    try {
      await removeSavedDataset(item.id);
      await refresh();
    } catch { setError(`Could not delete ${item.datasetName}. Please try again.`); }
    finally { setBusy(false); }
  };

  const clearAll = async () => {
    if (!window.confirm("Clear Everything? All saved datasets, records, settings, plans, decisions and outcomes will be removed.")) return;
    setBusy(true);
    try {
      await clearEverything();
      try { localStorage.removeItem("stockless.language"); } catch { /* Preference storage may be disabled. */ }
      await refresh();
    } catch { setError("Saved information could not be cleared. Please try again."); }
    finally { setBusy(false); }
  };

  return <div className="returning-page">
    <header className="returning-nav"><div className="returning-nav__inner">
      <a href="#home" aria-label="StockLess home"><Logo height={34} /></a>
      <nav aria-label="Page navigation"><LanguageSwitcher /><a href="#how-it-works">{copy("nav.howItWorks")}</a></nav>
    </div></header>
    <main className="returning-main">
      <p className="returning-eyebrow">{copy("returning.eyebrow")}</p>
      <h1>{copy("returning.heading")}</h1>
      <p className="returning-lead">{copy("returning.subtext")}</p>

      <section className="returning-files" aria-label={copy("files.heading")}>
        <p className="returning-privacy">{copy("files.privacy")}</p>
        <h2>{copy("files.heading")}</h2>
        {error && <p className="returning-error" role="alert">{error} <button type="button" onClick={() => void refresh()}>Retry</button></p>}
        {loading ? <p role="status">Loading saved datasets…</p> : datasets.length === 0 ?
          <div className="returning-empty"><p>Nothing saved</p><p>Upload a file to start your first dataset.</p></div> :
          <div className="returning-list">{datasets.map((item) => <div className="returning-row" key={item.id}>
            <button type="button" className="returning-row__open" onClick={() => { window.location.hash = `dataset/${encodeURIComponent(item.id)}`; }}>
              <strong>{item.datasetName}</strong>
              <span>{item.shopName} · {item.sourceName}</span>
              <small>{item.rowCount.toLocaleString(getLocale())} rows · {new Date(item.updatedAt).toLocaleDateString(getLocale(), { day: "numeric", month: "short", year: "numeric" })}</small>
            </button>
            <div className="returning-row__actions">
              <button type="button" className="returning-update" onClick={() => { window.location.hash = `update/${encodeURIComponent(item.id)}`; }}>Update</button>
              <button type="button" className="returning-delete" disabled={busy} onClick={() => void deleteDataset(item)}>{copy("files.delete")}</button>
            </div>
          </div>)}</div>}
      </section>
      <div className="returning-actions">
        <a className="returning-upload" href="#workspace">{copy("files.uploadNew")}</a>
        {datasets.length > 0 && <button type="button" className="returning-clear" disabled={busy} onClick={() => void clearAll()}>Clear Everything</button>}
      </div>
    </main>
  </div>;
}
