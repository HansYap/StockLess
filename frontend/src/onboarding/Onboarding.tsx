import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t, useLanguage } from "../i18n/index.ts";
import { listSavedDatasets } from "../storage/saved-datasets.ts";
import { datasetIdFromRoute } from "../visit-routing.ts";
import { guideRouteFor, guides, rememberGuide, rememberInvitation, visibleGuideTarget, type GuidePage } from "./guides.ts";
import { Stocky, type StockyPose } from "./Stocky.tsx";
import "./onboarding.css";

interface Onboarding {
  readonly available: boolean;
  readonly following: boolean;
  readonly startReplay: (returnId?: string) => Promise<void>;
  readonly enterPage: (page: GuidePage | null, invite?: boolean) => void;
  readonly emit: (event: string) => void;
  readonly stop: () => void;
}
const empty: Onboarding = { available: false, following: false, startReplay: async () => {}, enterPage: () => {}, emit: () => {}, stop: () => {} };
const Context = createContext<Onboarding>(empty);
export const useOnboarding = () => useContext(Context);

export function useGuidePage(page: GuidePage | null, invite = false): void {
  const { enterPage } = useOnboarding();
  useEffect(() => { enterPage(page, invite); }, [page, invite, enterPage]);
}

export function GuideButton({ onStart }: { readonly onStart?: () => Promise<void> }) {
  const onboarding = useOnboarding();
  const [busy, setBusy] = useState(false);
  if (!onboarding.available) return null;
  return <button type="button" className="onboarding-guide-button" disabled={busy} aria-busy={busy} onClick={() => {
    setBusy(true);
    void (onStart ? onStart() : onboarding.startReplay()).finally(() => setBusy(false));
  }}><span className="onboarding-guide-button__face" aria-hidden="true"><Stocky pose="idle" size={28} /></span><span className="onboarding-guide-button__label">{t("Guide")}</span></button>;
}

/** Shared controller survives route changes; guides never own or save retailer data. */
export function OnboardingProvider({ children }: { readonly children: ReactNode }) {
  useLanguage();
  const [following, setFollowing] = useState(() => window.location.hash === "#guide" || window.location.hash.startsWith("#guide/"));
  const [welcome, setWelcome] = useState(false);
  const [page, setPage] = useState<GuidePage | null>(null);
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const followingRef = useRef(following);
  const current = useRef<GuidePage | null>(null);
  const seen = useRef(new Set<GuidePage>());
  const invitationShown = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const updateFollowing = useCallback((next: boolean) => { followingRef.current = next; setFollowing(next); }, []);
  const stop = useCallback(() => { invitationShown.current = true; updateFollowing(false); setActive(false); setWelcome(false); rememberInvitation(); }, [updateFollowing]);
  const enterPage = useCallback((next: GuidePage | null, invite = false) => {
    if (current.current === next && !invite) return;
    if (next && next !== current.current) {
      current.current = next; setPage(next); setIndex(0);
      if (followingRef.current && !seen.current.has(next)) { seen.current.add(next); setActive(true); }
      else setActive(false);
    } else if (!next) { current.current = null; setPage(null); setActive(false); }
    // Eligibility comes from saved work. A skip lasts for this visit only until a plan is saved.
    if (invite && !invitationShown.current) { invitationShown.current = true; rememberInvitation(); setWelcome(true); }
  }, []);
  const startReplay = useCallback(async (returnId?: string) => {
    let id = returnId ?? datasetIdFromRoute(window.location.hash);
    if (!id) { try { id = (await listSavedDatasets())[0]?.id; } catch { /* Upload remains available. */ } }
    seen.current.clear(); current.current = null; setPage(null); setActive(false);
    updateFollowing(true); setWelcome(false); setIndex(0);
    const route = guideRouteFor(id);
    if (window.location.hash === route) window.dispatchEvent(new HashChangeEvent("hashchange"));
    else window.location.hash = route;
  }, [updateFollowing]);
  const next = useCallback(() => {
    if (!page) return;
    if (index + 1 < guides[page].length) setIndex(value => value + 1);
    else { rememberGuide(page); setActive(false); if (page === "history") updateFollowing(false); }
  }, [page, index, updateFollowing]);
  const emit = useCallback((event: string) => {
    if (active && page && guides[page][index]?.action === event) next();
  }, [active, page, index, next]);
  useEffect(() => {
    const navigate = () => {
      const hash = window.location.hash;
      if (hash === "#home" || (!hash.startsWith("#guide") && !hash.startsWith("#workspace") && !hash.startsWith("#dataset/") && !hash.startsWith("#update/") && hash !== "#history" && hash !== "#returning")) {
        current.current = null; setPage(null); updateFollowing(false); setActive(false); setWelcome(false);
      }
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, [updateFollowing]);
  useEffect(() => {
    if (welcome) { dialog.current?.showModal(); startButton.current?.focus(); }
    else dialog.current?.close();
  }, [welcome]);
  const follow = () => {
    seen.current.clear(); if (current.current) seen.current.add(current.current);
    updateFollowing(true); setWelcome(false); setIndex(0); setActive(true);
  };
  return <Context.Provider value={{ available: true, following, startReplay, enterPage, emit, stop }}>
    {children}
    <dialog ref={dialog} className="onboarding-welcome" aria-labelledby="onboarding-welcome-title" aria-describedby="onboarding-welcome-description" onCancel={stop}>
      <div className="onboarding-welcome__art"><Stocky pose="hello" size={168} label={t("Stocky, the StockLess guide")} /><span className="onboarding-welcome__bubble" aria-hidden="true">{t("Hi, I’m Stocky!")}</span></div>
      <div className="onboarding-welcome__copy"><p className="onboarding-eyebrow">{t("Welcome to StockLess")}</p><h2 id="onboarding-welcome-title">{t("Want a hand getting started?")}</h2><p id="onboarding-welcome-description">{t("Follow a few simple tips as you upload and check your sales file. You can use the buttons as we go.")}</p>
        <div className="onboarding-welcome__actions"><button type="button" className="onboarding-button" onClick={stop}>{t("Skip for now")}</button><button ref={startButton} type="button" className="onboarding-button onboarding-button--primary" onClick={follow}>{t("Follow along")} <span aria-hidden="true">→</span></button></div>
        <p className="onboarding-welcome__replay">{t("You can start again anytime with Guide.")}</p></div>
    </dialog>
    {active && !welcome && page && <Coachmark key={`${page}:${index}`} page={page} index={index} onNext={next} onStop={stop} />}
  </Context.Provider>;
}

interface Geometry { target: DOMRect; left: number; top: number; host: HTMLElement; }
/** Stocky appears only in the Step 1 and Step 2 tips; other pages keep the plain card. */
const stockyPoses: Partial<Record<GuidePage, readonly StockyPose[]>> = { upload: ["hello", "great"], mapping: ["magnify", "magnify", "great"] };
function Coachmark({ page, index, onNext, onStop }: { page: GuidePage; index: number; onNext: () => void; onStop: () => void }) {
  const step = guides[page][index];
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const coach = useRef<HTMLElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    let frame = 0, initial = true;
    const slot = document.createElement("div"); slot.className = "onboarding-slot";
    const update = () => {
      frame = 0;
      const mobile = window.innerWidth <= 760;
      const target = visibleGuideTarget(mobile ? step.mobileTarget ?? step.target : step.target);
      if (!target) { setGeometry(null); return; }
      targetRef.current = target;
      if (mobile && slot.nextElementSibling !== target) target.parentNode?.insertBefore(slot, target);
      else if (!mobile) slot.remove();
      const height = coach.current?.offsetHeight ?? 230;
      const width = Math.min(330, window.innerWidth - 32);
      let rect = target.getBoundingClientRect();
      if (initial && (rect.bottom < 100 || rect.top > window.innerHeight - 100)) {
        initial = false; target.scrollIntoView({ block: "center", behavior: "instant" }); rect = target.getBoundingClientRect();
      } else initial = false;
      const host = mobile ? slot : target.closest<HTMLElement>("dialog[open]") ?? document.body;
      let left = rect.right + 22, top = rect.top;
      if (left + width > window.innerWidth - 16) { left = rect.left + (rect.width - width) / 2; top = rect.bottom + 20; }
      if (top + height > window.innerHeight - 16) top = rect.top - height - 20;
      top = Math.max(16, Math.min(top, window.innerHeight - height - 16));
      left = Math.max(16, Math.min(left, window.innerWidth - width - 16));
      // Keep the control visible on narrow viewports; large sections remain scrollable.
      setGeometry(previous => previous && previous.host === host && previous.left === left && previous.top === top && previous.target.x === rect.x && previous.target.y === rect.y && previous.target.width === rect.width && previous.target.height === rect.height ? previous : { target: rect, left, top, host });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "class", "hidden", "disabled"] });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule); resize?.observe(document.documentElement);
    window.addEventListener("scroll", schedule, true); window.addEventListener("resize", schedule);
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" && !document.querySelector('dialog[open]')) onStop(); };
    window.addEventListener("keydown", key);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); resize?.disconnect(); slot.remove(); window.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule); window.removeEventListener("keydown", key); };
  }, [step, onStop]);
  useLayoutEffect(() => {
    if (!coach.current) return;
    if (window.innerWidth <= 760) coach.current.scrollIntoView({ block: "center", behavior: "instant" });
    window.dispatchEvent(new Event("resize"));
  }, [geometry?.host]);
  if (!geometry) return null;
  const label = { upload: "Upload", mapping: "Match columns", sidebar: "Your workspace", history: "Upload history" }[page];
  const advance = () => { onNext(); };
  const pose = stockyPoses[page]?.[index];
  return createPortal(<>
    <div className="onboarding-spotlight" aria-hidden="true" style={{ top: geometry.target.top - 7, left: geometry.target.left - 7, width: geometry.target.width + 14, height: geometry.target.height + 14 }} />
    <aside ref={coach} className={`onboarding-coach${pose ? " onboarding-coach--stocky" : ""}`} aria-labelledby="onboarding-coach-title" style={{ top: geometry.top, left: geometry.left }}>
      {pose && <span className="onboarding-coach__stocky"><Stocky pose={pose} size={68} /></span>}
      <div className="onboarding-coach__top"><span>{t(label)} · {index + 1} / {guides[page].length}</span><button type="button" onClick={onStop}>{t("Skip guide")}</button></div>
      <h2 id="onboarding-coach-title">{t(step.title)}</h2><p>{t(step.body)}</p>
      <div className="onboarding-coach__bottom"><div className="onboarding-dots" aria-hidden="true">{guides[page].map((_, i) => <i key={i} className={i === index ? "is-active" : undefined} />)}</div>
        {step.action ? <span>{t(step.hint)}</span> : <button type="button" className="onboarding-button onboarding-button--primary" onClick={advance}>{t(index === guides[page].length - 1 ? "Done" : "Got it")} <span aria-hidden="true">→</span></button>}</div>
    </aside><span className="sr-only" role="status" aria-live="polite">{t(step.title)}. {t(step.body)}</span>
  </>, geometry.host);
}
