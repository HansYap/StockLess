import { useRef } from "react";
import { getLocale, t, useLanguage } from "../i18n/index.ts";
import type { SavedDatasetSummary } from "../storage/saved-datasets.ts";
import "./saved-workspace-sidebar.css";

export interface SavedWorkspaceSidebarProps {
  readonly dataset: Pick<SavedDatasetSummary, "datasetName" | "shopName" | "rowCount">;
  readonly saved?: boolean;
  readonly currentSection?: "reupload" | "purchase" | "impact";
  readonly onReupload: () => void;
  readonly onPurchasePlan: () => void;
  readonly onImpact: () => void;
}
const paths = {
  upload: "M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5",
  plan: "M4 5h16v16H4ZM8 3v4m8-4v4M8 12h8m-8 4h5",
  chart: "M4 3v17h17M9 16v-5m5 5V7m5 9V3",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  lock: "M5 10h14v11H5ZM8 10V7a4 4 0 0 1 8 0v3m-4 5v2",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
} as const;
function Icon({ name }: { readonly name: keyof typeof paths }) {
  return <svg className="saved-sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

/** One dataset stays selected throughout preparation and the results workspace. */
export function SavedWorkspaceSidebar({ dataset, saved = true, currentSection = "reupload", onReupload, onPurchasePlan, onImpact }: SavedWorkspaceSidebarProps) {
  useLanguage();
  const drawer = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const close = () => { drawer.current?.close(); menu.current?.focus(); };
  const navigate = (action: () => void) => { drawer.current?.close(); action(); };
  const sections = [
    { id: "reupload", label: "Reupload", icon: "upload", action: onReupload },
    { id: "purchase", label: "Purchase plan", icon: "plan", action: onPurchasePlan },
    { id: "impact", label: "Impact dashboard", icon: "chart", action: onImpact },
  ] as const;
  const content = <>
    <div><p className="saved-sidebar__label">{t("Your workspace")}</p>
      <nav className="saved-sidebar__nav" data-guide="sidebar-navigation" aria-label={t("Dataset sections")}>
        {sections.map(section => <button key={section.id} type="button" data-guide={section.id === "reupload" ? "sidebar-reupload" : undefined}
          className={`saved-sidebar__item${section.id === currentSection ? " saved-sidebar__item--active" : ""}`}
          aria-current={section.id === currentSection ? "page" : undefined} onClick={() => navigate(section.action)}>
          <Icon name={section.icon} /><span>{t(section.label)}</span>
        </button>)}
      </nav>
    </div>
    <div className="saved-sidebar__bottom">
      <section className="saved-sidebar__dataset" aria-label={t("Viewing upload")}>
        <p className="saved-sidebar__eyebrow">{t("Viewing upload")}</p>
        <p className="saved-sidebar__name">{dataset.datasetName}</p>
        {dataset.shopName && <p className="saved-sidebar__meta">{dataset.shopName === "My store" ? t("Your store") : dataset.shopName}</p>}
        <p className="saved-sidebar__meta">{dataset.rowCount.toLocaleString(getLocale())} {t("rows")} · {t(saved ? "Available on this device" : "This session only")}</p>
        <a className="saved-sidebar__switch" data-guide="sidebar-history" href="#history">{t("Upload history")}<Icon name="arrow" /></a>
      </section>
      <p className="saved-sidebar__privacy"><Icon name="lock" /><span>{t("Your data stays with you.")}<br />{t("No account needed.")}</span></p>
    </div>
  </>;
  return <>
    <aside className="saved-sidebar" aria-label={t("Workspace navigation")}>{content}</aside>
    <div className="saved-sidebar-mobile"><button ref={menu} data-guide="sidebar-menu" type="button" className="saved-sidebar__menu" aria-label={t("Open navigation")} aria-haspopup="dialog" onClick={() => drawer.current?.showModal()}><Icon name="menu" /></button><span>{t(sections.find(section => section.id === currentSection)!.label)}</span></div>
    <dialog ref={drawer} className="saved-sidebar-drawer" aria-label={t("Workspace navigation")} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } }}>
      <button type="button" className="saved-sidebar__close" aria-label={t("Close navigation")} onClick={close}><Icon name="close" /></button>
      {content}
    </dialog>
  </>;
}
