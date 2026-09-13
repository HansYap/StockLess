import { lazy, Suspense, useEffect, useState } from "react";
import { HomePage } from "./screens/HomePage.tsx";

const Workspace = lazy(() => import("./App.tsx"));
const isWorkspace = () => window.location.hash === "#workspace";

/** Hash navigation works on static hosting; the mounted workspace retains its session. */
export default function Site() {
  const [workspace, setWorkspace] = useState(isWorkspace);
  const [opened, setOpened] = useState(isWorkspace);
  useEffect(() => {
    const navigate = () => {
      const next = isWorkspace();
      setWorkspace(next);
      if (next) setOpened(true);
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  useEffect(() => {
    document.title = workspace ? "StockLess | Your restocking workspace" : "StockLess | Less food waste. Smarter restocking.";
    const frame = requestAnimationFrame(() => {
      if (workspace || !window.location.hash || window.location.hash === "#home") window.scrollTo(0, 0);
      else document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
      const heading = document.querySelector<HTMLElement>(workspace ? ".workspace-view h1" : "#home-title");
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
    return () => cancelAnimationFrame(frame);
  }, [workspace]);
  return <>{!workspace && <HomePage />}{opened && <div className="workspace-view" hidden={!workspace}><Suspense fallback={<p className="notice" role="status">Opening your workspace…</p>}><Workspace /></Suspense></div>}</>;
}
