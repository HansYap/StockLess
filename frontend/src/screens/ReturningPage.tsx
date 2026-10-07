import { useCallback, useEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "../components/LanguageSwitcher.tsx";
import { Logo } from "../components/Logo.tsx";
import { WorkspaceDecor } from "../components/WorkspaceDecor.tsx";
import { getLocale, useLanguage } from "../i18n/index.ts";
import { returningMessages } from "../i18n/returning.ts";
import { clearEverything, listSavedDatasets, removeSavedDataset, type SavedDatasetSummary } from "../storage/saved-datasets.ts";
import "../components/workflow-shell.css";
import "./returning.css";

const iconPaths = {
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8m-8 4h5",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  upload: "M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5",
  plus: "M12 4v16M4 12h16",
  lock: "M5 10h14v11H5ZM8 10V7a4 4 0 0 1 8 0v3m-4 5v2",
  search: "M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0m-1 5.5 5 5",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  leaf: "M20 3C8 1 1 7 5 15c4 8 16 5 15-12ZM4 21 16 8",
} as const;
function ReturningIcon({ name }: { readonly name: keyof typeof iconPaths }) {
  return <svg className="returning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]} /></svg>;
}

/** Upload history for one store, opened from the workspace sidebar. */
export function ReturningPage() {
  const language = useLanguage();
  const copy = (key: keyof typeof returningMessages.en) => returningMessages[language][key];
  const [datasets, setDatasets] = useState<readonly SavedDatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"readError" | "deleteError" | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [pending, setPending] = useState<SavedDatasetSummary | "all" | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setDatasets(await listSavedDatasets()); setError(null); }
    catch { setError("readError"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (pending) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialogRef.current?.showModal();
      cancelRef.current?.focus();
    }
  }, [pending]);
  const closeDialog = () => {
    dialogRef.current?.close(); setPending(null);
    if (previousFocus.current?.isConnected) previousFocus.current.focus();
    else searchRef.current?.focus();
  };
  const remove = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      if (pending === "all") {
        await clearEverything();
        try { localStorage.removeItem("stockless.language"); } catch { /* Storage may be disabled. */ }
      } else await removeSavedDataset(pending.id);
      await refresh(); closeDialog();
    } catch { setError("deleteError"); closeDialog(); }
    finally { setBusy(false); }
  };
  const recent = [...datasets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const search = query.trim().toLocaleLowerCase(getLocale());
  const shown = datasets.filter(item => [item.datasetName, item.sourceName, item.shopName]
    .some(value => value.toLocaleLowerCase(getLocale()).includes(search)))
    .sort((a, b) => sort === "name" ? a.datasetName.localeCompare(b.datasetName, getLocale())
      : sort === "rows" ? b.rowCount - a.rowCount : b.createdAt.localeCompare(a.createdAt));
  const href = (item: SavedDatasetSummary) => `#dataset/${encodeURIComponent(item.id)}`;
  const date = (item: SavedDatasetSummary) => new Date(item.createdAt).toLocaleDateString(getLocale(), { day: "numeric", month: "short", year: "numeric" });
  const meta = (item: SavedDatasetSummary) => `${item.rowCount.toLocaleString(getLocale())} ${copy("rows")} · ${date(item)}`;
  return <div className="returning-page">
    <WorkspaceDecor />
    <header className="topbar">
      <a className="brand" href="#home" aria-label="StockLess"><Logo height={36} /></a>
      <a className="workspace-home-link" href="#home" aria-label={copy("homepage")}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7" /></svg><span>{copy("homepage")}</span></a>
      <LanguageSwitcher compact />
    </header>
    <main>
      <section className="returning-hero" aria-labelledby="returning-title"><div className="returning-width returning-hero__inner">
        <div><p className="returning-eyebrow">{copy("welcome")}</p><h1 id="returning-title">{copy("heading")}</h1><p className="returning-lead">{copy("lead")}</p></div>
        <div className="returning-art" aria-hidden="true"><div className="returning-paper" /><div className="returning-paper returning-paper--front"><ReturningIcon name="file" /><i /><i /></div><div className="returning-art__leaf" /></div>
      </div></section>
      <div className="returning-width returning-main">
        {error && <p className="returning-error" role="alert">{copy(error)} <button type="button" disabled={busy} onClick={() => void refresh()}>{copy("retry")}</button></p>}
        <div className="returning-welcome-actions">
          <section className="returning-card returning-resume" aria-label={copy("resume")}>
            <div className="returning-resume__heading"><p className="returning-eyebrow">{copy("resume")}</p>{recent && <span className="returning-pill"><span className="returning-dot" />{copy("recent")}</span>}</div>
            {loading ? <p role="status">{copy("loading")}</p> : recent ? <>
              <div className="returning-resume__file"><span className="returning-file-icon"><ReturningIcon name="file" /></span><div><h3>{recent.datasetName}</h3><p className="returning-file-meta">{meta(recent)}</p></div></div>
              <div className="returning-resume__bottom"><span className="returning-last-step">{recent.shopName} · {copy("lastSaved")} <strong>{date(recent)}</strong></span><a className="returning-btn returning-btn--primary" href={href(recent)}>{copy("continue")}<ReturningIcon name="arrow" /></a></div>
            </> : <div className="returning-resume__empty"><h2>{copy("ready")}</h2><p>{copy("savedAppear")}</p></div>}
          </section>
          <section className="returning-new-file"><ReturningIcon name="upload" /><h3>{copy("newFile")}</h3><p>{copy("newFileLead")}</p><a className="returning-btn" href={recent ? `#update/${encodeURIComponent(recent.id)}` : "#workspace"}><ReturningIcon name="plus" />{copy("upload")}</a></section>
        </div>
        <div className="returning-section-title"><h2 id="returning-datasets-title">{copy("datasets")}<span className="returning-count">{datasets.length.toLocaleString(getLocale())} / 12</span></h2><span className="returning-privacy"><ReturningIcon name="lock" />{copy("privacy")}</span></div>
        <section className="returning-card returning-files" aria-labelledby="returning-datasets-title" aria-busy={loading}>
          <div className="returning-toolbar">
            <label className="returning-search"><ReturningIcon name="search" /><input ref={searchRef} type="search" aria-label={copy("search")} placeholder={copy("searchPlaceholder")} value={query} onChange={event => setQuery(event.target.value)} /></label>
            <label className="returning-sort">{copy("sort")}<select value={sort} onChange={event => setSort(event.target.value)}><option value="recent">{copy("recent")}</option><option value="name">{copy("fileName")}</option><option value="rows">{copy("rowCount")}</option></select></label>
          </div>
          {loading ? <p className="returning-empty" role="status">{copy("loading")}</p> : shown.length > 0 ? <div className="returning-list">{shown.map(item => <article className="returning-row" key={item.id}>
            <span className="returning-file-icon"><ReturningIcon name="file" /></span>
            <div className="returning-row__details"><h3><a href={href(item)}>{item.datasetName}</a></h3><p className="returning-file-meta">{meta(item)}</p><p className="returning-source">{item.shopName} · {item.sourceName}</p></div>
            <div className="returning-row__status"><span className="returning-pill returning-pill--neutral">{copy(item.id === recent?.id ? "resume" : "savedDataset")}</span></div>
            <div className="returning-row__actions"><a className="returning-btn" aria-label={`${copy("open")} ${item.datasetName}`} href={href(item)}>{copy("open")}<ReturningIcon name="arrow" /></a><button className="returning-delete" type="button" disabled={busy} aria-label={`${copy("delete")} ${item.datasetName}`} onClick={() => setPending(item)}><ReturningIcon name="trash" /></button></div>
          </article>)}</div> : <div className="returning-empty"><h3>{copy(search ? "noMatches" : "fresh")}</h3><p>{copy(search ? "tryName" : "emptyLead")}</p>{search ? <button type="button" className="returning-btn" onClick={() => { setQuery(""); searchRef.current?.focus(); }}>{copy("clearSearch")}</button> : <a className="returning-btn returning-btn--primary" href="#workspace">{copy("upload")}</a>}</div>}
        </section>
        <div className="returning-list-footer"><span role="status">{copy("showing").replace("{shown}", shown.length.toLocaleString(getLocale())).replace("{total}", datasets.length.toLocaleString(getLocale()))}</span>{datasets.length > 0 && <button type="button" className="returning-clear" disabled={busy || loading} onClick={() => setPending("all")}>{copy("clearAll")}</button>}</div>
        <footer className="returning-bottom-note"><ReturningIcon name="leaf" />{copy("tagline")}</footer>
      </div>
    </main>
    <dialog ref={dialogRef} className="returning-dialog" aria-labelledby="returning-confirm-title" aria-describedby="returning-confirm-copy" onCancel={event => { event.preventDefault(); if (!busy) closeDialog(); }}>
      <h2 id="returning-confirm-title">{copy(pending === "all" ? "clearTitle" : "removeTitle")}</h2>
      <p id="returning-confirm-copy">{pending === "all" ? copy("clearCopy") : pending && copy("removeCopy").replace("{name}", `${pending.shopName} / ${pending.datasetName}`)}</p>
      <div className="returning-dialog__actions"><button ref={cancelRef} className="returning-btn" type="button" disabled={busy} onClick={closeDialog}>{copy("cancel")}</button><button className="returning-btn returning-btn--danger" type="button" disabled={busy} onClick={() => void remove()}>{copy(busy ? "removing" : pending === "all" ? "clearAll" : "remove")}</button></div>
    </dialog>
  </div>;
}
