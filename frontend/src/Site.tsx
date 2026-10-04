import { t, useLanguage } from "./i18n/index.ts";
import { lazy, Suspense, useEffect, useState } from "react";
import { HomePage } from "./screens/HomePage.tsx";
import { ReturningPage } from "./screens/ReturningPage.tsx";
import { hasSavedDatasets } from "./storage/saved-datasets.ts";
import { datasetIdFromRoute, isWorkspaceRoute, startRouteFor } from "./visit-routing.ts";

const Workspace = lazy(() => import("./App.tsx"));
const currentRoute = () => window.location.hash || "#home";

/** The landing page is the entry point; its start buttons choose the saved or new flow. */
export default function Site() {
  const language = useLanguage();
  const [route, setRoute] = useState(currentRoute);
  const workspace = isWorkspaceRoute(route);
  const returning = route === "#returning";

  useEffect(() => {
    const navigate = () => setRoute(currentRoute());
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);

  useEffect(() => {
    if (route !== "#start") return;
    let active = true;
    void hasSavedDatasets().then((saved) => {
      if (active) window.location.hash = startRouteFor(saved);
    }).catch(() => {
      // Local storage may be unavailable (for example in an embedded browser).
      // Upload still works, so let the visitor continue as a new session.
      if (active) window.location.hash = "#workspace";
    });
    return () => { active = false; };
  }, [route]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (workspace || returning || route === "#start" || route === "#home") window.scrollTo(0, 0);
      else document.getElementById(route.slice(1))?.scrollIntoView();
      const heading = document.querySelector<HTMLElement>(workspace ? ".workspace-view h1" : returning ? ".returning-page h1" : "#home-title");
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
    return () => cancelAnimationFrame(frame);
  }, [route, workspace, returning]);

  useEffect(() => {
    document.title = t(workspace ? "StockLess | Your restocking workspace" : returning ? "StockLess | Welcome back" : "StockLess | Less food waste. Smarter restocking.");
  }, [workspace, returning, language]);

  if (route === "#start") return <main className="start-routing" role="status"><p>Opening StockLess…</p></main>;

  if (returning) return <ReturningPage />;

  if (workspace) return <div className="workspace-view"><Suspense fallback={<p className="notice" role="status">{t("Opening your workspace…")}</p>}>
    <Workspace key={route} initialDatasetId={route.startsWith("#dataset/") ? datasetIdFromRoute(route) : undefined}
      updateDatasetId={route.startsWith("#update/") ? datasetIdFromRoute(route) : undefined} />
  </Suspense></div>;

  return <HomePage startHref="#start" />;
}
