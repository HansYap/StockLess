import { t, useLanguage } from "./i18n/index.ts";
import { lazy, Suspense, useEffect, useState } from "react";
import { HomePage } from "./screens/HomePage.tsx";
import { ReturningPage } from "./screens/ReturningPage.tsx";
import { listSavedDatasets } from "./storage/saved-datasets.ts";
import { datasetIdFromRoute, isWorkspaceRoute, startRouteFor } from "./visit-routing.ts";
import { OnboardingProvider } from "./onboarding/Onboarding.tsx";

const Workspace = lazy(() => import("./App.tsx"));
const currentRoute = () => window.location.hash || "#home";

/** New visitors see the landing page; returning visitors resume their latest upload. */
export default function Site() { return <OnboardingProvider><SiteContent /></OnboardingProvider>; }

function SiteContent() {
  const language = useLanguage();
  const [route, setRoute] = useState(() => !window.location.hash || window.location.hash === "#home" ? "#entry" : currentRoute());
  const [visit, setVisit] = useState(0);
  const workspace = isWorkspaceRoute(route);
  const returning = route === "#history" || route === "#returning";

  useEffect(() => {
    const navigate = () => { setRoute(currentRoute()); setVisit(value => value + 1); };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);

  useEffect(() => {
    if (route !== "#start" && route !== "#entry") return;
    let active = true;
    void listSavedDatasets().then((saved) => {
      if (!active) return;
      const destination = saved[0] ? startRouteFor(saved[0].id) : route === "#entry" ? "#home" : "#workspace";
      window.history.replaceState(null, "", destination);
      setRoute(destination);
    }).catch(() => {
      // Local storage may be unavailable (for example in an embedded browser).
      // Upload still works, so let the visitor continue as a new session.
      if (active) {
        const destination = route === "#entry" ? "#home" : "#workspace";
        window.history.replaceState(null, "", destination);
        setRoute(destination);
      }
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
    document.title = t(workspace ? "StockLess | Your restocking workspace" : returning ? "StockLess | Upload history" : "StockLess | Less food waste. Smarter restocking.");
  }, [workspace, returning, language]);

  if (route === "#start" || route === "#entry") return <main className="start-routing" role="status"><p>{t("Opening your workspace…")}</p></main>;

  if (returning) return <ReturningPage />;

  if (workspace) return <div className="workspace-view"><Suspense fallback={<p className="notice" role="status">{t("Opening your workspace…")}</p>}>
    <Workspace key={`${route}:${visit}`} initialDatasetId={route.startsWith("#dataset/") ? datasetIdFromRoute(route) : undefined}
      updateDatasetId={route.startsWith("#update/") ? datasetIdFromRoute(route) : undefined}
      guidedImport={route === "#guide" || route.startsWith("#guide/")}
      guideReturnId={route.startsWith("#guide/") ? datasetIdFromRoute(route) : undefined} />
  </Suspense></div>;

  return <HomePage startHref="#start" />;
}
