import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t, useLanguage } from "../i18n/index.ts";
import { listSavedDatasets } from "../storage/saved-datasets.ts";
import { datasetIdFromRoute } from "../visit-routing.ts";
import { availableGuideIndexes, guideLabels, guideRouteFor, guides, readGuidePreferences, rememberGuide, rememberInvitation, resolveGuideStep, visibleGuideTarget, type GuidePage } from "./guides.ts";
import { Stocky, type StockyPose } from "./Stocky.tsx";
import { positionCoach } from "./coach-placement.ts";
import "../components/dialog.css";
import "./onboarding.css";

interface Onboarding {
  readonly available: boolean;
  readonly following: boolean;
  readonly page: GuidePage | null;
  readonly startReplay: (returnId?: string) => Promise<void>;
  readonly startPageGuide: (page?: GuidePage) => Promise<void>;
  readonly enterPage: (page: GuidePage | null, invite?: boolean) => void;
  readonly emit: (event: string) => void;
  readonly stop: () => void;
}
const empty: Onboarding = { available: false, following: false, page: null, startReplay: async () => {}, startPageGuide: async () => {}, enterPage: () => {}, emit: () => {}, stop: () => {} };
const Context = createContext<Onboarding>(empty);
export const useOnboarding = () => useContext(Context);

export function useGuidePage(page: GuidePage | null, invite = false): void {
  const { enterPage } = useOnboarding();
  useEffect(() => { enterPage(page, invite); }, [page, invite, enterPage]);
}

type GuideScope = "page" | "setup" | "sidebar";
export function GuideButton({ onBeforeSetup }: { readonly onBeforeSetup?: () => Promise<string | undefined> }) {
  const onboarding = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [workspace, setWorkspace] = useState(false);
  const [error, setError] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);
  const id = useId();
  const start = async (scope: GuideScope) => {
    setBusy(true); setError(false);
    try {
      // Only a full restart leaves the page and needs pending work saved.
      const returnId = scope === "setup" ? await onBeforeSetup?.() : undefined;
      // Release the native modal before mounting a coach or changing routes.
      menu.current?.close();
      if (scope === "setup") await onboarding.startReplay(returnId);
      else await onboarding.startPageGuide(scope === "sidebar" ? "sidebar" : onboarding.page ?? undefined);
    } catch {
      if (!menu.current?.open) menu.current?.showModal();
      setError(true);
    }
    finally { setBusy(false); }
  };
  if (!onboarding.available) return null;
  return <><button type="button" className="onboarding-guide-button" disabled={busy} aria-busy={busy} aria-haspopup="dialog" onClick={() => {
    setWorkspace(Boolean(visibleGuideTarget('[data-guide="sidebar-navigation"], [data-guide="sidebar-menu"]')));
    setError(false); menu.current?.showModal();
  }}><span className="onboarding-guide-button__face" aria-hidden="true"><Stocky pose="idle" size={28} /></span><span className="onboarding-guide-button__label">{t("Guide")}</span></button>
    <dialog ref={menu} className="stockless-dialog onboarding-guide-menu" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { if (busy) event.preventDefault(); }}>
      <div className="stockless-dialog__header"><div><p className="stockless-dialog__eyebrow">{t("Guide")}</p><h2 className="stockless-dialog__title" id={`${id}-title`}>{t("What would you like help with?")}</h2></div><span className="onboarding-guide-menu__stocky" aria-hidden="true"><Stocky pose="hello" size={64} /></span></div>
        <p className="stockless-dialog__description" id={`${id}-description`}>{t("Take a short guide on this page, or follow the full setup from Upload.")}</p>
        <div className="onboarding-guide-menu__actions">
          {onboarding.page && <button type="button" className="stockless-dialog__button stockless-dialog__button--primary" disabled={busy} onClick={() => void start("page")}>{t("Guide this page")} · {t(guideLabels[onboarding.page])}</button>}
          {workspace && <button type="button" className="stockless-dialog__button" disabled={busy} onClick={() => void start("sidebar")}>{t("Workspace navigation guide")}</button>}
          <button type="button" className="stockless-dialog__button" disabled={busy} onClick={() => void start("setup")}>{t("Restart full setup guide")}</button>
        </div>{error && <p className="stockless-dialog__error" role="alert">{t("The guide could not start. Please try again.")}</p>}
        <div className="stockless-dialog__actions"><button type="button" className="stockless-dialog__button" disabled={busy} onClick={() => menu.current?.close()}>{t("Close")}</button></div>
    </dialog>
  </>;
}

/** Shared controller survives route changes; guides never own or save retailer data. */
export function OnboardingProvider({ children }: { readonly children: ReactNode }) {
  useLanguage();
  const [following, setFollowing] = useState(() => window.location.hash === "#guide" || window.location.hash.startsWith("#guide/"));
  const [welcome, setWelcome] = useState(false);
  const [page, setPage] = useState<GuidePage | null>(null);
  const [screenPage, setScreenPage] = useState<GuidePage | null>(null);
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const followingRef = useRef(following);
  const current = useRef<GuidePage | null>(null);
  const activePage = useRef<GuidePage | null>(null);
  const activeIndex = useRef(0);
  const finished = useRef(new Set<GuidePage>());
  const progress = useRef(new Map<GuidePage, number>());
  const journey = useRef(following);
  const replaying = useRef(following);
  const invitationShown = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const updateFollowing = useCallback((next: boolean) => { followingRef.current = next; setFollowing(next); }, []);
  const stop = useCallback(() => { invitationShown.current = true; activePage.current = null; updateFollowing(false); setActive(false); setWelcome(false); rememberInvitation(); }, [updateFollowing]);
  const enterPage = useCallback((next: GuidePage | null, invite = false) => {
    if (current.current === next && !invite) return;
    if (next && next !== current.current) {
      activePage.current = next; activeIndex.current = progress.current.get(next) ?? 0;
      current.current = next; setScreenPage(next); setPage(next); setIndex(progress.current.get(next) ?? 0);
      setActive(followingRef.current && journey.current && !finished.current.has(next) && (replaying.current || !readGuidePreferences().completed.includes(next)));
      if (followingRef.current && journey.current && next === "purchase" && finished.current.has("purchase") &&
        !finished.current.has("sidebar") && progress.current.has("sidebar")) {
        activePage.current = "sidebar"; activeIndex.current = progress.current.get("sidebar")!;
        setPage("sidebar"); setIndex(progress.current.get("sidebar")!); setActive(true);
      }
      if (!journey.current) updateFollowing(false);
    } else if (!next) { current.current = null; activePage.current = null; setScreenPage(null); setPage(null); setActive(false); }
    // Eligibility comes from saved work. A skip lasts for this visit only until a plan is saved.
    if (invite && !invitationShown.current) { invitationShown.current = true; rememberInvitation(); setWelcome(true); }
  }, [updateFollowing]);
  const startReplay = useCallback(async (returnId?: string) => {
    let id = returnId ?? datasetIdFromRoute(window.location.hash);
    if (!id) { try { id = (await listSavedDatasets())[0]?.id; } catch { /* Upload remains available. */ } }
    finished.current.clear(); progress.current.clear(); journey.current = true; replaying.current = true;
    current.current = null; activePage.current = null; activeIndex.current = 0; setScreenPage(null); setPage(null); setActive(false);
    updateFollowing(true); setWelcome(false); setIndex(0);
    const route = guideRouteFor(id);
    if (window.location.hash === route) window.dispatchEvent(new HashChangeEvent("hashchange"));
    else window.location.hash = route;
  }, [updateFollowing]);
  const startPageGuide = useCallback(async (requested?: GuidePage) => {
    const nextPage = requested ?? current.current;
    if (!nextPage) { await startReplay(); return; }
    journey.current = false; replaying.current = false;
    activePage.current = nextPage; activeIndex.current = 0;
    progress.current.set(nextPage, 0); finished.current.delete(nextPage);
    updateFollowing(true); setWelcome(false); setPage(nextPage); setIndex(0); setActive(true);
  }, [startReplay, updateFollowing]);
  const moveTo = useCallback((nextPage: GuidePage, nextIndex: number) => {
    if (activePage.current !== nextPage) return;
    activeIndex.current = nextIndex;
    progress.current.set(nextPage, nextIndex); setIndex(nextIndex);
  }, []);
  const finish = useCallback((skipped = false) => {
    if (!page || activePage.current !== page) return;
    finished.current.add(page); progress.current.delete(page);
    if (!skipped) rememberGuide(page);
    setActive(false);
    activePage.current = null;
    // Navigation tips follow the core page; they never send owners away to History.
    if (!skipped && page === "purchase" && journey.current && !finished.current.has("sidebar") &&
      (replaying.current || !readGuidePreferences().completed.includes("sidebar")) &&
      visibleGuideTarget('[data-guide="sidebar-navigation"], [data-guide="sidebar-menu"]')) {
      if (!progress.current.has("sidebar")) progress.current.set("sidebar", 0);
      activePage.current = "sidebar"; activeIndex.current = progress.current.get("sidebar")!;
      setPage("sidebar"); setIndex(progress.current.get("sidebar") ?? 0); setActive(true);
    } else if (!journey.current || page === "history") updateFollowing(false);
  }, [page, updateFollowing]);
  const next = useCallback(() => {
    if (!page || activePage.current !== page || activeIndex.current !== index) return;
    const nextIndex = availableGuideIndexes(page).find(value => value > index);
    if (nextIndex !== undefined) moveTo(page, nextIndex);
    else finish();
  }, [page, index, moveTo, finish]);
  const previous = () => {
    if (!page) return;
    const previousIndex = availableGuideIndexes(page).filter(value => value < index).at(-1);
    if (previousIndex !== undefined) moveTo(page, previousIndex);
  };
  const emit = useCallback((event: string) => {
    if (active && page && guides[page][index]?.action === event) next();
  }, [active, page, index, next]);
  useEffect(() => {
    const navigate = () => {
      const hash = window.location.hash;
      if (hash === "#home" || (!hash.startsWith("#guide") && !hash.startsWith("#workspace") && !hash.startsWith("#dataset/") && !hash.startsWith("#update/") && hash !== "#history" && hash !== "#returning")) {
        current.current = null; activePage.current = null; setScreenPage(null); setPage(null); updateFollowing(false); setActive(false); setWelcome(false);
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
    finished.current.clear(); progress.current.clear(); journey.current = true; replaying.current = true;
    activePage.current = current.current; activeIndex.current = 0;
    updateFollowing(true); setWelcome(false); setIndex(0); setActive(true);
  };
  return <Context.Provider value={{ available: true, following, page: screenPage, startReplay, startPageGuide, enterPage, emit, stop }}>
    {children}
    <dialog ref={dialog} className="onboarding-welcome" aria-labelledby="onboarding-welcome-title" aria-describedby="onboarding-welcome-description" onCancel={stop}>
      <div className="onboarding-welcome__art"><Stocky pose="hello" size={168} label={t("Stocky, the StockLess guide")} /><span className="onboarding-welcome__bubble" aria-hidden="true">{t("Hi, I’m Stocky!")}</span></div>
      <div className="onboarding-welcome__copy"><p className="onboarding-eyebrow">{t("Welcome to StockLess")}</p><h2 id="onboarding-welcome-title">{t("Want a hand getting started?")}</h2><p id="onboarding-welcome-description">{t("Follow a few simple tips to check your sales file, plan an order and understand its impact. You can use the page as we go.")}</p>
        <div className="onboarding-welcome__actions"><button type="button" className="onboarding-button" onClick={stop}>{t("Skip for now")}</button><button ref={startButton} type="button" className="onboarding-button onboarding-button--primary" onClick={follow}>{t("Follow along")} <span aria-hidden="true">→</span></button></div>
        <p className="onboarding-welcome__replay">{t("You can start again anytime with Guide.")}</p></div>
    </dialog>
    {active && !welcome && page && <Coachmark key={`${page}:${index}`} page={page} index={index} onNext={next} onPrevious={previous} onSkipPage={() => finish(true)} onStop={stop} />}
  </Context.Provider>;
}

interface Geometry { target: DOMRect; card?: DOMRect; left: number; top: number; host: HTMLElement; }
function scrollToPageActions(target: HTMLElement): void {
  // Phone headers can be taller than the viewport. Bring the actions below
  // the app bar, with their inline tip immediately after them.
  const top = window.innerWidth <= 760 ? Math.max(0, target.getBoundingClientRect().top + window.scrollY - 132) : 0;
  window.scrollTo({ top, behavior: "instant" });
}
/** Use the same Stocky companion throughout the setup and optional page guides. */
const stockyPoses: Record<GuidePage, readonly StockyPose[]> = {
  upload: ["hello", "great"], mapping: ["magnify", "magnify", "great"],
  readiness: ["hello", "magnify", "magnify", "great"],
  purchase: ["hello", "magnify", "idle", "magnify", "magnify", "magnify", "great"],
  impact: ["hello", "magnify", "great", "magnify", "great"],
  sidebar: ["hello", "idle"], history: ["hello", "magnify", "idle"],
};
function Coachmark({ page, index, onNext, onPrevious, onSkipPage, onStop }: { page: GuidePage; index: number; onNext: () => void; onPrevious: () => void; onSkipPage: () => void; onStop: () => void }) {
  const source = guides[page][index];
  const [step, setStep] = useState(source);
  const [indexes, setIndexes] = useState(() => availableGuideIndexes(page));
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const coach = useRef<HTMLElement>(null);
  const shadeId = useId();
  useLayoutEffect(() => {
    let frame = 0, initial = true, floatingHeight = 230, fallbackInline = false;
    const slot = document.createElement("div"); slot.className = "onboarding-slot";
    const update = () => {
      frame = 0;
      if (!source) { setGeometry(null); return; }
      const mobile = window.innerWidth <= 760;
      const target = visibleGuideTarget(mobile ? source.mobileTarget ?? source.target : source.target);
      const modal = document.querySelector<HTMLDialogElement>('dialog[open]');
      // Let the owner use a real dialog without a coach sitting above or behind it.
      if (modal && (!target || !modal.contains(target))) { setGeometry(null); return; }
      const resolved = resolveGuideStep(source);
      setStep(previous => previous.title === resolved.title && previous.body === resolved.body ? previous : resolved);
      const available = availableGuideIndexes(page);
      setIndexes(previous => previous.join() === available.join() ? previous : available);
      if (!target) { slot.remove(); setGeometry(null); if (source.optional) onNext(); return; }
      const height = coach.current?.offsetHeight ?? 230;
      if (coach.current && !coach.current.parentElement?.classList.contains("onboarding-slot")) floatingHeight = height;
      const width = Math.min(330, window.innerWidth - 32);
      let rect = target.getBoundingClientRect();
      // Inline cards are wider and shorter. Keep the floating measurement so
      // their shorter height cannot repeatedly switch them back to floating.
      const tall = !modal && rect.height + floatingHeight > window.innerHeight - 64;
      if (initial) {
        if (source.scroll === "top") scrollToPageActions(target);
        else if (!mobile && !tall && (rect.top < 16 || rect.bottom > window.innerHeight - 16)) target.scrollIntoView({ block: "center", behavior: "instant" });
        rect = target.getBoundingClientRect(); initial = false;
      }
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      if (!mobile && !positionCoach(rect, { width, height: floatingHeight }, viewport)) fallbackInline = true;
      // Once a tip needs a slot, keep it there. Inserting it above a target
      // creates apparent floating space that disappears if the slot is removed.
      const inline = mobile || tall || fallbackInline;
      let anchor = target.closest<HTMLElement>(".pp-hero, .rd-hero") ?? target;
      if (inline) {
        for (let parent = target.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          if (getComputedStyle(parent).position === "sticky") anchor = parent;
        }
      }
      if (inline) {
        // Final tips keep the header buttons above the card on small screens.
        if (source.scroll === "top") {
          if (slot.previousElementSibling !== anchor) anchor.after(slot);
        } else if (slot.nextElementSibling !== anchor) anchor.before(slot);
      } else slot.remove();
      rect = target.getBoundingClientRect();
      const host = inline ? slot : target.closest<HTMLElement>("dialog[open]") ?? document.body;
      const placement = inline ? { left: 16, top: 62 } : positionCoach(rect, { width, height }, viewport);
      if (!placement) { fallbackInline = true; setGeometry(null); frame = requestAnimationFrame(update); return; }
      const { left, top } = placement;
      // Keep the control visible on narrow viewports; large sections remain scrollable.
      const card = coach.current?.getBoundingClientRect();
      setGeometry(previous => previous && previous.host === host && previous.left === left && previous.top === top && previous.target.x === rect.x && previous.target.y === rect.y && previous.target.width === rect.width && previous.target.height === rect.height && previous.card?.x === card?.x && previous.card?.y === card?.y && previous.card?.width === card?.width && previous.card?.height === card?.height ? previous : { target: rect, card, left, top, host });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "class", "hidden", "disabled", "data-guide-state"] });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule); resize?.observe(document.documentElement);
    window.addEventListener("scroll", schedule, true); window.addEventListener("resize", schedule);
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" && !document.querySelector('dialog[open]')) onStop(); };
    window.addEventListener("keydown", key);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); resize?.disconnect(); slot.remove(); window.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule); window.removeEventListener("keydown", key); };
  }, [source, page, onNext, onStop]);
  useLayoutEffect(() => {
    if (!coach.current) return;
    // Wait for the inline card and compact page header to settle before scrolling.
    // Otherwise the browser may anchor the target and push the tip above the viewport.
    const frames: number[] = [];
    const align = (remaining: number) => {
      frames.push(requestAnimationFrame(() => {
        if (source?.scroll === "top") {
          const target = visibleGuideTarget(source.target);
          if (target) scrollToPageActions(target);
        } else if (geometry?.host.classList.contains("onboarding-slot") && coach.current) {
          const top = coach.current.getBoundingClientRect().top + window.scrollY - 88;
          window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        }
        window.dispatchEvent(new Event("resize"));
        // Scrolling compacts Readiness/Purchase headers and changes the document height.
        // Correct that one-time shift, then leave subsequent user scrolling alone.
        if (remaining > 0) align(remaining - 1);
      }));
    };
    align(2);
    return () => frames.forEach(cancelAnimationFrame);
  }, [geometry?.host, geometry?.target.width, source]);
  if (!geometry || !source) return null;
  const position = Math.max(0, indexes.indexOf(index));
  const advance = () => { onNext(); };
  const pose = stockyPoses[page][index] ?? "idle";
  return <>{createPortal(<>
    <svg className="onboarding-shade" aria-hidden="true" width="100%" height="100%"><defs><mask id={shadeId} maskUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="white" />
      <rect x={geometry.target.left - 7} y={geometry.target.top - 7} width={geometry.target.width + 14} height={geometry.target.height + 14} rx="13" fill="black" />
      {geometry.card && <rect x={geometry.card.left} y={geometry.card.top} width={geometry.card.width} height={geometry.card.height} rx="16" fill="black" />}
      {pose && geometry.card && <rect x={geometry.card.right - 84} y={geometry.card.top - 46} width="68" height="72" rx="10" fill="black" />}
    </mask></defs><rect width="100%" height="100%" fill="#16313b38" mask={`url(#${shadeId})`} /></svg>
    <div className="onboarding-spotlight" aria-hidden="true" style={{ top: geometry.target.top - 7, left: geometry.target.left - 7, width: geometry.target.width + 14, height: geometry.target.height + 14 }} /></>,
    geometry.host.closest<HTMLElement>("dialog[open]") ?? document.body)}{createPortal(<>
    <aside ref={coach} className={`onboarding-coach${pose ? " onboarding-coach--stocky" : ""}`} aria-labelledby="onboarding-coach-title" style={{ top: geometry.top, left: geometry.left }}>
      {pose && <span className="onboarding-coach__stocky"><Stocky pose={pose} size={68} /></span>}
      <div className="onboarding-coach__top"><span>{t(guideLabels[page])} · {position + 1} / {indexes.length}</span><button type="button" onClick={onStop}>{t("Skip guide")}</button></div>
      <h2 id="onboarding-coach-title">{t(step.title)}</h2><p>{t(step.body)}</p>
      <div className="onboarding-coach__bottom"><div className="onboarding-dots" aria-hidden="true">{indexes.map(i => <i key={i} className={i === index ? "is-active" : undefined} />)}</div>
        {step.action ? <span>{t(step.hint)}</span> : <button type="button" className="onboarding-button onboarding-button--primary" onClick={advance}>{t(position === indexes.length - 1 ? "Done" : "Got it")} <span aria-hidden="true">→</span></button>}</div>
      <div className="onboarding-coach__links">{position > 0 && page !== "upload" && <button type="button" className="onboarding-text-button" onClick={onPrevious}>{t("Back")}</button>}<button type="button" className="onboarding-text-button" onClick={onSkipPage}>{t("Skip this page")}</button></div>
    </aside><span className="sr-only" role="status" aria-live="polite">{t(step.title)}. {t(step.body)}</span>
  </>, geometry.host)}</>;
}
