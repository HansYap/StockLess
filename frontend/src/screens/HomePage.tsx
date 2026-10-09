import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Logo } from "../components/Logo.tsx";
import { GrowthIcon } from "../components/GrowthIcon.tsx";
import { BrandIcon } from "../components/BrandIcon.tsx";
import { HeroBasket } from "../components/HeroBasket.tsx";
import { Stocky, type StockyPose } from "../onboarding/Stocky.tsx";
import { localizedWorkspaceHref, setLanguage, t, useLanguage, type Language } from "../i18n/index.ts";
import { homepageRefreshMessages } from "../i18n/homepage-refresh.ts";
import "../homepage.css";
import "../purchase-plan/purchase-plan.css";
import { PurchaseDemandChart } from "../purchase-plan/PurchaseDemandChart.tsx";
import { PurchaseStockChart } from "../purchase-plan/PurchaseStockChart.tsx";
import { addCalendarDays, previousCompleteWeekStarts, type WeeklyEvidence } from "../engine.ts";

const exampleWeeks: readonly WeeklyEvidence[] = previousCompleteWeekStarts("2026-09-15").map((start, i) => {
  const quantity = [4, 2, 6, 2, 4, 6, 6, 6][i];
  return { productKey: "MM0002", weekStart: start, weekEnd: addCalendarDays(start, 6), positiveQuantity: quantity,
    negativeQuantity: 0, netQuantity: quantity, recordCount: 1, state: "observed_demand", sourceRows: [i + 2] };
});

function ExampleForecastSummary() {
  return <div className="hp-simple-forecast" role="img" aria-label={`${t("Earlier 4 weeks")}: 14; ${t("Latest 4 weeks")}: 22; ${t("Next 4 weeks")}: 15–21 ${t("units")}`}>
    <p>{t("Sales in 4-week periods")} · {t("units")}</p>
    <div className="hp-simple-forecast-bars" aria-hidden="true">
      {[14, 22, 21].map((quantity, i) => <div key={i}><b>{i === 2 ? "15–21" : quantity}</b><span className={i === 2 ? "hp-simple-forecast-bar hp-simple-forecast-bar--estimate" : "hp-simple-forecast-bar"} style={{ height: quantity * 3 }}>
        {i === 2 && <i style={{ height: 6 * 3 }} />}
      </span><small>{t(i === 0 ? "Earlier 4 weeks" : i === 1 ? "Latest 4 weeks" : "Next 4 weeks")}</small></div>)}
    </div>
    <p className="hp-simple-forecast-key"><span>{t("Recorded sales")}</span><span>{t("Estimated sales")}</span></p>
  </div>;
}

type HomePageProps = {
  startHref?: string;
};
type HomeView = {
  language: Language;
  startHref: string;
  asset: (name: string) => string;
  copy: (key: string, values?: Record<string, string | number>) => string;
};
const HomeContext = createContext<HomeView | null>(null);
function useHomeView() {
  const view = useContext(HomeContext);
  if (!view) throw new Error("Homepage content needs its view context.");
  return view;
}

export function HomePage({ startHref = "#workspace" }: HomePageProps) {
  const language = useLanguage();
  const view = useMemo<HomeView>(() => ({
    language,
    startHref: localizedWorkspaceHref(startHref),
    asset: name => `/homepage/${name}`,
    copy: (key, values) => {
      const text = homepageRefreshMessages[language][key] ?? homepageRefreshMessages.en[key] ?? key;
      return values ? text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`)) : text;
    },
  }), [language, startHref]);
  return <HomeContext.Provider value={view}>
    <div className="sl-home" id="home">
      <a className="sl-skip" href="#top">{t("Skip to content")}</a>
      <HomeHeader />
      <main id="top">
        <Hero /><WasteContext /><Workflow /><Comparison /><PurchaseExample />
        <Benefits /><StartBanner /><Sustainability /><FAQs />
      </main>
      <HomeFooter />
    </div>
  </HomeContext.Provider>;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** The hero story is illustrative; it never edits the visitor's real plan. */
function useHeroStory() {
  const reducedMotion = useReducedMotion();
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (reducedMotion || !playing) return;
    const timer = window.setInterval(() => setFrame(value => (value + 1) % 3), 2500);
    return () => window.clearInterval(timer);
  }, [playing, reducedMotion]);
  const phase = reducedMotion ? 2 : frame;
  const order = [37, 24, 10][phase];
  return { order, phase, playing, reducedMotion, verdict: order + 8 > 21 ? "hi" : "ok", toggle: () => setPlaying(value => !value) };
}

function CountUp({ value, decimals, suffix }: { value: number; decimals: number; suffix: string }) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (reducedMotion || !window.IntersectionObserver || !ref.current) { setDisplay(value); return; }
    let frame = 0;
    let started = false;
    setDisplay(0);
    const observer = new IntersectionObserver(entries => {
      if (started || !entries.some(entry => entry.isIntersecting)) return;
      started = true;
      observer.disconnect();
      let start: number | undefined;
      const step = (timestamp: number) => {
        start ??= timestamp;
        const progress = Math.min(1, (timestamp - start) / 1400);
        setDisplay(value * (1 - (1 - progress) ** 3));
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, { threshold: .4 });
    observer.observe(ref.current);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value, reducedMotion]);
  return <b className="hp-count" ref={ref}>{display.toFixed(decimals)}{suffix}</b>;
}

function nonnegativeInteger(value: string | number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}
function clampOrder(value: string | number) { return Math.min(60, nonnegativeInteger(value)); }

function scrollToHomepageSection(id: "top" | "example", reducedMotion: boolean) {
  document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
}

function followSmoothAnchor(event: MouseEvent<HTMLAnchorElement>, id: "top" | "example", reducedMotion: boolean) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  scrollToHomepageSection(id, reducedMotion);
}

function HomeHeader() {
  const { copy, startHref, language } = useHomeView();
  return (
    <header className="topbar">
      <a className="brand" href="#home" aria-label="StockLess">
        <Logo height={36} />
      </a>
      <span className="topbar__spacer" />
      <nav className="hp-nav" aria-label="Sections">
        <a href="#why">
          <span>
            {copy("hp.nav.why")}
          </span>
        </a>
        <a href="#how">
          <span>
            {copy("hp.nav.how")}
          </span>
        </a>
        <a href="#diff">
          <span>
            {copy("hp.nav.diff")}
          </span>
        </a>
        <a href="#example">
          <span>
            {copy("hp.nav.ex")}
          </span>
        </a>
        <a href="#faq">
          <span>
            {copy("hp.nav.faq")}
          </span>
        </a>
      </nav>
      <label className="lang">
        <span className="sr-only">
          {"Language"}
        </span>
        <select aria-label={t("Language")} value={language} onChange={event => setLanguage(event.target.value as Language)}>
          <option value="en" lang="en">
            {"English"}
          </option>
          <option value="ms" lang="ms">
            {"Bahasa Melayu"}
          </option>
          <option value="zh" lang="zh-Hans">
            {"中文"}
          </option>
        </select>
      </label>
      <a className="btn btn--primary hp-topcta" href={startHref}>
        <span>
          {copy("hp.cta")}
        </span>
      </a>
    </header>
  );
}

function Hero() {
  const { copy, startHref } = useHomeView();
  const story = useHeroStory();
  const openDemo = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("a, button")) return;
    scrollToHomepageSection("example", story.reducedMotion);
  };
  return (
    <section className="hp-hero">
      <svg className="hp-hero__leaf hp-hero__leaf--2 hp-sway" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 4C12 12 8 24 12 36c10 2 22-2 28-14C36 12 30 6 24 4Z" fill="#A9D3B0" />
      </svg>
      <svg className="hp-hero__leaf hp-sway" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 4C12 12 8 24 12 36c10 2 22-2 28-14C36 12 30 6 24 4Z" fill="#B9DCBE" />
        <path d="M14 38C20 28 26 20 34 12" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      <HeroBasket className="hp-hero__basket" />
      <div className="wrap hp-hero__in">
        <div className="hp-hero__text">
          <p className="hp-eyebrow">
            <span aria-hidden="true">
              <GrowthIcon stage="sprout" size={16} className="hp-inline-icon" />
            </span>
            {" "}
            <span>
              {copy("hp.eyebrow")}
            </span>
          </p>
          <h1 id="home-title">
            <span>
              {copy("hp.h1a")}
            </span>
            <em>
              {copy("hp.h1b")}
            </em>
            <br />
            <span>
              {copy("hp.h1c")}
            </span>
          </h1>
          <p className="hp-lede">
            <span>
              {copy("hp.lede")}
            </span>
          </p>
          <div className="hp-ctas">
            <a className="btn btn--primary hp-bigbtn" href={startHref}>
              <span>
                {copy("hp.cta")}
              </span>
            </a>
            <a className="hp-link" href="#how">
              <span>
                {copy("hp.see")}
              </span>
            </a>
          </div>
          <ul className="hp-checks">
            <li>
              <span className="hp-tick" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </span>
              <span>
                {copy("hp.chk1")}
              </span>
            </li>
            <li>
              <span className="hp-tick" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </span>
              <span>
                {copy("hp.chk2")}
              </span>
            </li>
            <li>
              <span className="hp-tick" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </span>
              <span>
                {copy("hp.chk3")}
              </span>
            </li>
          </ul>
        </div>
        <div className="hp-card-wrap hp-float">
          {/* The whole card opens the interactive demo; the Pause button keeps its own job. */}
          <div className="hp-card hp-card--link" onClick={openDemo}>
            <div className="hp-card__top">
              <div>
                <span className="hp-k">
                  {copy("hp.pp.k")}
                </span>
                <b className="hp-card__name">
                  {"Milo 3in1 · 15 sticks"}
                </b>
              </div>
              <span className={`hp-pill hp-pill--${story.verdict}`} id="ha-pill">
                {copy(`hp.pp.p.${story.verdict}`)}
              </span>
            </div>
            <p className="hp-card__fc">
              <b>
                {"15–21"}
              </b>
              {" "}
              <span>
                {copy("hp.units")}
              </span>
              {" · "}
              <span>
                {copy("hp.pp.fc")}
              </span>
            </p>
            <ExampleForecastSummary />
            <div className="hp-anim__order">
              <span>
                <span>
                  {copy("hp.pp.yo")}
                </span>
                {" "}
                <b id="ha-order">
                  {story.order}
                </b>
                {" "}
                <span>
                  {copy("hp.units")}
                </span>
              </span>
              <span className="num" id="ha-eq">
                {`8 + ${story.order} = ${8 + story.order}`}
              </span>
            </div>
            <div className="purchase-plan--new hp-shared-chart hp-shared-chart--compact"><PurchaseStockChart stock={8} incoming={0} order={story.order} low={15} high={21} /></div>
            <div className={`hp-card__check is-${story.verdict}`} id="ha-check">
              <div>
                <span className="hp-k2">
                  <span>
                    {copy("hp.card.pc")}
                  </span>
                </span>
                <b id="ha-title">
                  {copy(`hp.pp.v.${story.verdict}.h`)}
                </b>
              </div>
              <div className="hp-anim__saved">
                <b id="ha-saved">
                  {Math.min(24, 37 - story.order)}
                </b>
                <small>
                  {copy("hp.anim.saved")}
                </small>
              </div>
            </div>
            <div className="hp-anim__foot">
              <div className="hp-anim__dots" aria-hidden="true">
                <i className={story.phase === 0 ? "is-on" : ""} />
                <i className={story.phase === 1 ? "is-on" : ""} />
                <i className={story.phase === 2 ? "is-on" : ""} />
              </div>
              <span className="hp-anim__actions">
                <a className="hp-anim__try" href="#example" onClick={event => followSmoothAnchor(event, "example", story.reducedMotion)}>
                  {copy("hp.anim.try")}
                </a>
                <button type="button" className="hp-anim__play" id="ha-play" onClick={story.toggle} hidden={story.reducedMotion}>
                  {copy(story.playing ? "hp.anim.pause" : "hp.anim.play")}
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WasteContext() {
  const { copy, asset } = useHomeView();
  return (
    <section className="hp-big" id="why">
      <div className="wrap hp-big__in">
        <div>
          <p className="hp-k3">
            <span>
              {copy("hp.big.k")}
            </span>
          </p>
          <h2>
            <span>
              {copy("hp.big.h")}
            </span>
          </h2>
          <p className="hp-p">
            <span>
              {copy("hp.big.t")}
            </span>
          </p>
          <div className="hp-stats">
            <div className="hp-stat">
              <span className="hp-stat__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                </svg>
              </span>
              <CountUp value={1.05} decimals={2} suffix="B t" />
              <p>
                {copy("hp.st1")}
              </p>
              <span className="hp-stat__bar" aria-hidden="true">
                <span data-pct="100" style={{ width: "100%" }} />
              </span>
            </div>
            <div className="hp-stat">
              <span className="hp-stat__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 9h18l-1-5H4zM5 9v11h14V9M9 20v-6h6v6" />
                </svg>
              </span>
              <CountUp value={12} decimals={0} suffix="%" />
              <p>
                {copy("hp.st2")}
              </p>
              <span className="hp-stat__bar" aria-hidden="true">
                <span data-pct="12" style={{ width: "12%" }} />
              </span>
            </div>
            <div className="hp-stat">
              <span className="hp-stat__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </span>
              <CountUp value={2030} decimals={0} suffix="" />
              <p>
                {copy("hp.st3")}
              </p>
              <span className="hp-stat__bar" aria-hidden="true">
                <span data-pct="70" style={{ width: "70%" }} />
              </span>
            </div>
          </div>
          <p className="hp-src">
            <span>
              {copy("hp.src")}
            </span>
          </p>
        </div>
        <div className="hp-big__media">
          <img src={asset("food-waste.jpg")} alt={copy("hp.img.waste")} width="900" height="600" loading="lazy" />
          <div className="hp-case">
            <span className="hp-case__k">
              {copy("hp.case.k")}
            </span>
            <p>
              <b>
                {"RM10,000"}
              </b>
              {" "}
              <span>
                {copy("hp.case.t")}
              </span>
              {" "}
              <small>
                {copy("hp.case.s")}
              </small>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const GUIDE_POSES: readonly StockyPose[] = ["hello", "magnify", "magnify", "great"];

function Workflow() {
  const { copy } = useHomeView();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [heldStep, setHeldStep] = useState<number | null>(null);
  const activeStep = heldStep ?? step;
  const returnToTop = (event: MouseEvent<HTMLAnchorElement>) => followSmoothAnchor(event, "top", reducedMotion);
  useEffect(() => {
    if (reducedMotion || heldStep !== null) return;
    const timer = window.setInterval(() => setStep(value => (value + 1) % 4), 2400);
    return () => window.clearInterval(timer);
  }, [reducedMotion, heldStep]);
  return (
    <section className="hp-how" id="how">
      <div className="wrap">
        <p className="hp-k3">
          <span>
            {copy("hp.how.k")}
          </span>
        </p>
        <h2>
          <span>
            {copy("hp.how.h1")}
          </span>
          <em>
            {copy("hp.how.h2")}
          </em>
        </h2>
        {/* Stocky's only homepage appearance: a guide that walks with the active step. Decorative. */}
        <div className="hp-guide-lane" aria-hidden="true">
          <div className="hp-guide" style={{ "--hp-guide-step": activeStep } as CSSProperties}>
            <Stocky pose={GUIDE_POSES[activeStep]} size={78} />
            <p className="hp-guide__bubble">
              <b>{copy(`hp.guide.h${activeStep + 1}`)}</b> {copy(`hp.guide.t${activeStep + 1}`)}
            </p>
          </div>
        </div>
        <div className="hp-steps__line" aria-hidden="true">
          <span id="hs-line" style={{ width: `${(activeStep + 1) * 25}%` }} />
        </div>
        <div className="hp-steps">
          <a className={activeStep === 0 ? "hp-step is-on" : "hp-step"} href="#top" onClick={returnToTop} onMouseEnter={() => setHeldStep(0)} onMouseLeave={() => setHeldStep(null)} onFocus={() => setHeldStep(0)} onBlur={() => setHeldStep(null)}>
            <span className="hp-step__n">
              {"1"}
            </span>
            <span className="hp-step__plant" aria-hidden="true">
              <GrowthIcon stage="sprout" size={28} />
            </span>
            <b>
              {copy("hp.s1")}
            </b>
            <p>
              {copy("hp.s1t")}
            </p>
          </a>
          <a className={activeStep === 1 ? "hp-step is-on" : "hp-step"} href="#top" onClick={returnToTop} onMouseEnter={() => setHeldStep(1)} onMouseLeave={() => setHeldStep(null)} onFocus={() => setHeldStep(1)} onBlur={() => setHeldStep(null)}>
            <span className="hp-step__n">
              {"2"}
            </span>
            <span className="hp-step__plant" aria-hidden="true">
              <GrowthIcon stage="leaves" size={28} />
            </span>
            <b>
              {copy("hp.s2")}
            </b>
            <p>
              {copy("hp.s2t")}
            </p>
          </a>
          <a className={activeStep === 2 ? "hp-step is-on" : "hp-step"} href="#top" onClick={returnToTop} onMouseEnter={() => setHeldStep(2)} onMouseLeave={() => setHeldStep(null)} onFocus={() => setHeldStep(2)} onBlur={() => setHeldStep(null)}>
            <span className="hp-step__n">
              {"3"}
            </span>
            <span className="hp-step__plant" aria-hidden="true">
              <GrowthIcon stage="potted" size={28} />
            </span>
            <b>
              {copy("hp.s3")}
            </b>
            <p>
              {copy("hp.s3t")}
            </p>
          </a>
          <a className={activeStep === 3 ? "hp-step is-on" : "hp-step"} href="#top" onClick={returnToTop} onMouseEnter={() => setHeldStep(3)} onMouseLeave={() => setHeldStep(null)} onFocus={() => setHeldStep(3)} onBlur={() => setHeldStep(null)}>
            <span className="hp-step__n">
              {"4"}
            </span>
            <span className="hp-step__plant" aria-hidden="true">
              <GrowthIcon stage="tree" size={28} />
            </span>
            <b>
              {copy("hp.s4")}
            </b>
            <p>
              {copy("hp.s4t")}
            </p>
          </a>
        </div>
      </div>
    </section>
  );
}

function Comparison() {
  const { copy } = useHomeView();
  return (
    <section className="hp-diff" id="diff">
      <div className="wrap">
        <p className="hp-k3">
          <span>
            {copy("hp.diff.k")}
          </span>
        </p>
        <h2>
          <span>
            {copy("hp.diff.h1")}
          </span>
          <em>
            {copy("hp.diff.h2")}
          </em>
        </h2>
        <p className="hp-p hp-diff__t">
          <span>
            {copy("hp.diff.t")}
          </span>
        </p>
        <div className="hp-cols">
          <article className="hp-col hp-col--sl">
            <span className="hp-col__badge">
              <span>
                {copy("hp.c.best")}
              </span>
            </span>
            <div className="hp-col__head">
              <span className="hp-col__ic">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z" />
                  <path d="M2 21c0-3 1.9-5.4 5.1-6" />
                </svg>
              </span>
              <div>
                <h3>
                  {copy("hp.c.sl")}
                </h3>
                <p>
                  {copy("hp.c.sl.t")}
                </p>
              </div>
            </div>
            <ul>
              <li>
                <span className="hp-m hp-m--yes" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.setup")}
                  </small>
                  <span>
                    {copy("hp.c.setup.2")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--yes" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.cost")}
                  </small>
                  <span>
                    {copy("hp.c.cost.2")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--yes" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.forecast")}
                  </small>
                  <span>
                    {copy("hp.c.forecast.2")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--yes" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.check")}
                  </small>
                  <span>
                    {copy("hp.c.check.2")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--yes" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.data")}
                  </small>
                  <span>
                    {copy("hp.c.data.2")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--yes" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.privacy")}
                  </small>
                  <span>
                    {copy("hp.c.privacy.2")}
                  </span>
                </span>
              </li>
            </ul>
          </article>
          <article className="hp-col">
            <div className="hp-col__head">
              <span className="hp-col__ic">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="3" width="16" height="18" rx="2" />
                  <path d="M4 9h16M4 15h16M10 3v18" />
                </svg>
              </span>
              <div>
                <h3>
                  {copy("hp.c.sheet")}
                </h3>
                <p>
                  {copy("hp.c.sheet.t")}
                </p>
              </div>
            </div>
            <ul>
              <li>
                <span className="hp-m hp-m--mid" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 12h12" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.setup")}
                  </small>
                  <span>
                    {copy("hp.c.setup.0")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--yes" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.cost")}
                  </small>
                  <span>
                    {copy("hp.c.cost.0")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--no" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m7 7 10 10M17 7 7 17" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.forecast")}
                  </small>
                  <span>
                    {copy("hp.c.forecast.0")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--no" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m7 7 10 10M17 7 7 17" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.check")}
                  </small>
                  <span>
                    {copy("hp.c.check.0")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--no" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m7 7 10 10M17 7 7 17" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.data")}
                  </small>
                  <span>
                    {copy("hp.c.data.0")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--yes" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.privacy")}
                  </small>
                  <span>
                    {copy("hp.c.privacy.0")}
                  </span>
                </span>
              </li>
            </ul>
          </article>
          <article className="hp-col">
            <div className="hp-col__head">
              <span className="hp-col__ic">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="6" rx="1" />
                  <rect x="3" y="14" width="18" height="6" rx="1" />
                  <path d="M7 7h.01M7 17h.01" />
                </svg>
              </span>
              <div>
                <h3>
                  {copy("hp.c.erp")}
                </h3>
                <p>
                  {copy("hp.c.erp.t")}
                </p>
              </div>
            </div>
            <ul>
              <li>
                <span className="hp-m hp-m--no" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m7 7 10 10M17 7 7 17" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.setup")}
                  </small>
                  <span>
                    {copy("hp.c.setup.1")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--no" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m7 7 10 10M17 7 7 17" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.cost")}
                  </small>
                  <span>
                    {copy("hp.c.cost.1")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--mid" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 12h12" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.forecast")}
                  </small>
                  <span>
                    {copy("hp.c.forecast.1")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--mid" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 12h12" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.check")}
                  </small>
                  <span>
                    {copy("hp.c.check.1")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--mid" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 12h12" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.data")}
                  </small>
                  <span>
                    {copy("hp.c.data.1")}
                  </span>
                </span>
              </li>
              <li>
                <span className="hp-m hp-m--mid" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 12h12" />
                  </svg>
                </span>
                <span>
                  <small>
                    {copy("hp.r.privacy")}
                  </small>
                  <span>
                    {copy("hp.c.privacy.1")}
                  </span>
                </span>
              </li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}

function PurchaseExample() {
  const { copy, startHref } = useHomeView();
  const [order, setOrder] = useState(37);
  const [incoming, setIncoming] = useState(0);
  const total = 8 + incoming + order;
  const suggested = Math.max(0, 18 - 8 - incoming);
  const verdict = total > 21 ? "hi" : total < 15 ? "lo" : "ok";
  return (
    <section className="hp-ex" id="example">
      <div className="wrap">
        <div className="hp-ex__head">
          <div>
            <p className="hp-k3">
              <span>
                {copy("hp.ex.k")}
              </span>
            </p>
            <h2>
              <span>
                {copy("hp.ex.h")}
              </span>
            </h2>
          </div>
          <p className="hp-ex__t">
            <span>
              {copy("hp.ex.t")}
            </span>
          </p>
        </div>
        <div className="hp-pp" id="hp-pp">
          <div className="pp2-head">
            <div>
              <span className="pp2-k">
                {copy("hp.pp.k")}
              </span>
              <h3>
                {"Milo 3in1"}
              </h3>
              <span className="pp2-sub">
                {copy("hp.pp.sub")}
              </span>
            </div>
            <span className={`pill pill--${verdict}`} id="hp-pill">
              {copy(`hp.pp.p.${verdict}`)}
            </span>
          </div>
          <section className="pp2-ev">
            <h4>
              {copy("hp.pp.ev")}
            </h4>
            <p className="pp2-fc">
              <b>
                {"15–21 "}
                <span>
                  {copy("hp.units")}
                </span>
              </b>
              <span>
                {copy("hp.pp.fc")}
              </span>
            </p>
            <div className="purchase-plan--new hp-shared-chart"><PurchaseDemandChart weeks={exampleWeeks} range={{ low: 15, high: 21 }} name="Milo 3in1 (illustrative example)" analysisDate="2026-09-15" /></div>
            <div className="pp2-facts">
              <div>
                <small>
                  {copy("hp.pp.f1")}
                </small>
                <b>
                  {"8"}
                </b>
                <small>
                  {copy("hp.pp.f1s")}
                </small>
              </div>
              <div>
                <small>
                  {copy("hp.pp.f2")}
                </small>
                <b>
                  {"4.5"}
                </b>
                <small>
                  {copy("hp.pp.f2s")}
                </small>
              </div>
              <div>
                <small>
                  {copy("hp.pp.f3")}
                </small>
                <b>
                  {"1.8"}
                </b>
                <small>
                  {copy("hp.pp.f3s")}
                </small>
              </div>
              <div>
                <small>
                  {copy("hp.pp.f4")}
                </small>
                <b>
                  {"12 Sep"}
                </b>
                <small>
                  {copy("hp.pp.f4s")}
                </small>
              </div>
            </div>
          </section>
          <div className="pp2-two">
            <div className="pp2-sugg">
              <span className="pp2-k">
                {copy("hp.pp.sg")}
              </span>
              <span className="pp2-big">
                <span id="hp-sugg">
                  {suggested}
                </span>
                {" "}
                <small>
                  {copy("hp.units")}
                </small>
              </span>
              <span className="pp2-f" id="hp-sgf">
                {copy("hp.pp.sgf", { i: incoming })}
              </span>
              <button type="button" className="btn btn--primary btn--small" id="hp-use" onClick={() => setOrder(clampOrder(suggested))} hidden={order === suggested}>
                {copy("hp.pp.use", { n: suggested })}
              </button>
            </div>
            <div className="pp2-order">
              <label className="pp2-k" htmlFor="hp-order">
                {copy("hp.pp.yo")}
              </label>
              <div className="pp2-step">
                <button type="button" className="pp2-sbtn" data-step="-1" aria-label={copy("hp.pp.less")} onClick={() => setOrder(clampOrder(order + (-1)))}>
                  {"−"}
                </button>
                <input id="hp-order" type="number" min="0" max="60" value={order} inputMode="numeric" onChange={event => setOrder(clampOrder(event.target.value))} />
                <button type="button" className="pp2-sbtn" data-step="1" aria-label={copy("hp.pp.more")} onClick={() => setOrder(clampOrder(order + (1)))}>
                  {"+"}
                </button>
                <span>
                  {copy("hp.units")}
                </span>
              </div>
              <input type="range" className="hp-range" id="hp-order-r" min="0" max="60" value={order} aria-label={copy("hp.pp.yo")} onChange={event => setOrder(clampOrder(event.target.value))} />
              <div className="pp2-inc">
                <label htmlFor="hp-inc">
                  {copy("hp.pp.inc")}
                </label>
                <input id="hp-inc" type="number" min="0" value={incoming} inputMode="numeric" onChange={event => setIncoming(nonnegativeInteger(event.target.value))} />
                <span>
                  {copy("hp.units")}
                </span>
              </div>
            </div>
          </div>
          <section className="pp2-check">
            <div className="pp2-check__head">
              <h4>
                {copy("hp.pp.pc")}
              </h4>
              <span className="num" id="hp-eq">
                {copy("hp.pp.eq", { s: 8, i: incoming, o: order, t: total })}
              </span>
            </div>
            <div className="purchase-plan--new hp-shared-chart"><PurchaseStockChart stock={8} incoming={incoming} order={order} low={15} high={21} /></div>
            <div className={`pp2-verdict is-${verdict}`} id="hp-v" aria-live="polite">
              <b id="hp-vh">
                {copy(`hp.pp.v.${verdict}.h`)}
              </b>
              <span id="hp-vt">
                {copy(`hp.pp.v.${verdict}.t`, { t: total, h: 21, l: 15, s: suggested })}
              </span>
            </div>
          </section>
          <div className="pp2-two pp2-extras">
            <details className="pp2-x">
              <summary>
                <span>
                  <b>
                    {copy("hp.pp.exp")}
                  </b>
                  <small>
                    {copy("hp.pp.exps")}
                  </small>
                </span>
                <i aria-hidden="true">
                  {"+"}
                </i>
              </summary>
              <p>
                {copy("hp.pp.expb")}
              </p>
            </details>
            <details className="pp2-x">
              <summary>
                <span>
                  <b>
                    {copy("hp.pp.sup")}
                  </b>
                  <small>
                    {copy("hp.pp.sups")}
                  </small>
                </span>
                <i aria-hidden="true">
                  {"+"}
                </i>
              </summary>
              <p>
                {copy("hp.pp.supb")}
              </p>
            </details>
          </div>
          <div className="pp2-foot">
            <a className="btn btn--primary" href={startHref}>
              {copy("hp.pp.own")}
            </a>
          </div>
        </div>
        <p className="hp-src">
          <span>
            {copy("hp.ex.note")}
          </span>
        </p>
      </div>
    </section>
  );
}

function Benefits() {
  const { copy } = useHomeView();
  return (
    <section className="hp-get">
      <div className="wrap hp-get__in">
        <div>
          <p className="hp-k3">
            <span>
              {copy("hp.get.k")}
            </span>
          </p>
          <h2>
            <span>
              {copy("hp.get.h1")}
            </span>
            <em>
              {copy("hp.get.h2")}
            </em>
          </h2>
          <ul className="hp-list">
            <li>
              <span className="hp-tick" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </span>
              <span>
                {copy("hp.g1")}
              </span>
            </li>
            <li>
              <span className="hp-tick" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </span>
              <span>
                {copy("hp.g2")}
              </span>
            </li>
            <li>
              <span className="hp-tick" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </span>
              <span>
                {copy("hp.g3")}
              </span>
            </li>
            <li>
              <span className="hp-tick" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </span>
              <span>
                {copy("hp.g4")}
              </span>
            </li>
            <li>
              <span className="hp-tick" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </span>
              <span>
                {copy("hp.g5")}
              </span>
            </li>
          </ul>
        </div>
        <div className="hp-priv">
          <span className="hp-priv__ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="10" width="14" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
          <p className="hp-k3">
            <span>
              {copy("hp.pv.k")}
            </span>
          </p>
          <h3>
            <span>
              {copy("hp.pv.h")}
            </span>
          </h3>
          <p className="hp-p">
            <span>
              {copy("hp.pv.t")}
            </span>
          </p>
          <div className="hp-chips">
            <span>
              {copy("hp.chk3")}
            </span>
            <span>
              {copy("hp.chk2")}
            </span>
            <span>
              {copy("hp.pv.c3")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function StartBanner() {
  const { copy, startHref, asset } = useHomeView();
  return (
    <section className="wrap">
      <div className="hp-band">
        <div className="hp-band__text">
          <p className="hp-k3 hp-k3--light">
            <span aria-hidden="true">
              <GrowthIcon stage="tree" size={16} className="hp-inline-icon" />
            </span>
            {" "}
            <span>
              {copy("hp.band.k")}
            </span>
          </p>
          <h2>
            <span>
              {copy("hp.band.h1")}
            </span>
            <em>
              {copy("hp.band.h2")}
            </em>
          </h2>
          <a className="hp-band__btn" href={startHref}>
            <span>
              {copy("hp.band.cta")}
            </span>
          </a>
          <p>
            <span>
              {copy("hp.band.t")}
            </span>
          </p>
        </div>
        <img src={asset("retail-produce-2.jpg")} alt={copy("hp.img.produce")} width="900" height="600" loading="lazy" />
      </div>
    </section>
  );
}

function Sustainability() {
  const { copy } = useHomeView();
  return (
    <section className="wrap hp-sdg" id="sdg">
      <div className="hp-sdg__card">
        <div className="hp-sdg__top">
          <b>
            {"12"}
          </b>
          <span>
            {copy("hp.sdg.n")}
          </span>
        </div>
        <svg viewBox="0 0 140 100" className="hp-sdg__icon" aria-hidden="true">
          <path d="M70 50C82 34 95 27 108 33C123 40 123 60 108 67C95 73 82 66 70 50C58 34 45 27 32 33C17 40 17 60 32 67C40 71 49 70 56 64" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" />
          <path d="M47 58L60 60L56 73" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="hp-sdg__cap">
          {copy("hp.sdg.cap")}
        </p>
      </div>
      <div className="hp-sdg__text">
        <p className="hp-k3">
          <span>
            {copy("hp.sdg.k")}
          </span>
        </p>
        <h2>
          <span>
            {copy("hp.sdg.h")}
          </span>
        </h2>
        <p className="hp-sdg__lead">
          <span>
            {copy("hp.sdg.t1")}
          </span>
        </p>
        <p className="hp-p">
          <span>
            {copy("hp.sdg.t2")}
          </span>
        </p>
        <a className="hp-link" href="https://sdgs.un.org/goals/goal12" target="_blank" rel="noopener noreferrer">
          <span>
            {copy("hp.sdg.link")}
          </span>
        </a>
      </div>
    </section>
  );
}

function FAQs() {
  const { copy } = useHomeView();
  const [faqOpen, setFaqOpen] = useState<boolean[]>(Array(4).fill(false));
  return (
    <section className="hp-lm" id="faq">
      <div className="wrap">
        <p className="hp-k3">
          <span>
            {copy("hp.lm.k")}
          </span>
        </p>
        <h2>
          <span>
            {copy("hp.lm.h")}
          </span>
        </h2>
        <p className="hp-p hp-lm__t">
          <span>
            {copy("hp.lm.t")}
          </span>
        </p>
        <div className="hp-faqs">
          <details className="hp-faq" open={faqOpen[0]}>
            <summary onClick={event => { event.preventDefault(); setFaqOpen(values => values.map((open, index) => index === 0 ? !open : open)); }}>
              <span className="hp-faq__ic" aria-hidden="true">
                <GrowthIcon stage="sprout" size={26} />
              </span>
              <span>
                {copy("hp.q0")}
              </span>
              <span className="hp-faq__leaf" aria-hidden="true" />
            </summary>
            <p>
              {copy("hp.a0")}
            </p>
          </details>
          <details className="hp-faq" open={faqOpen[1]}>
            <summary onClick={event => { event.preventDefault(); setFaqOpen(values => values.map((open, index) => index === 1 ? !open : open)); }}>
              <span className="hp-faq__ic" aria-hidden="true">
                <BrandIcon name="file" size={26} />
              </span>
              <span>
                {copy("hp.q1")}
              </span>
              <span className="hp-faq__leaf" aria-hidden="true" />
            </summary>
            <p>
              {copy("hp.a1")}
            </p>
          </details>
          <details className="hp-faq" open={faqOpen[2]}>
            <summary onClick={event => { event.preventDefault(); setFaqOpen(values => values.map((open, index) => index === 2 ? !open : open)); }}>
              <span className="hp-faq__ic" aria-hidden="true">
                <BrandIcon name="cart" size={26} />
              </span>
              <span>
                {copy("hp.q2")}
              </span>
              <span className="hp-faq__leaf" aria-hidden="true" />
            </summary>
            <p>
              {copy("hp.a2")}
            </p>
          </details>
          <details className="hp-faq" open={faqOpen[3]}>
            <summary onClick={event => { event.preventDefault(); setFaqOpen(values => values.map((open, index) => index === 3 ? !open : open)); }}>
              <span className="hp-faq__ic" aria-hidden="true">
                <BrandIcon name="reuse" size={26} />
              </span>
              <span>
                {copy("hp.q3")}
              </span>
              <span className="hp-faq__leaf" aria-hidden="true" />
            </summary>
            <p>
              {copy("hp.a3")}
            </p>
          </details>
        </div>
        <div className="hp-lm__foot">
          <b>
            <span>
              {copy("hp.lm.still")}
            </span>
          </b>
          <button type="button" className="hp-link" id="hp-all" aria-expanded={faqOpen.every(Boolean)} onClick={() => setFaqOpen(Array(4).fill(!faqOpen.every(Boolean)))}>
            {copy(faqOpen.every(Boolean) ? "hp.lm.less" : "hp.lm.all")}
          </button>
        </div>
      </div>
    </section>
  );
}

function HomeFooter() {
  const { copy } = useHomeView();
  return (
    <footer className="hp-foot">
      <div className="wrap hp-foot__in">
        <a className="brand" href="#home" aria-label="StockLess">
          <Logo height={36} />
        </a>
        <p className="hp-foot__legal">
          <b>
            {"© 2026 StockLess"}
          </b>
          {" "}
          {copy("hp.foot.by")}
          <i aria-hidden="true">·</i>
          {copy("hp.foot.made")}
          <i aria-hidden="true">·</i>
          {copy("hp.foot.tag")}
          <i aria-hidden="true">·</i>
          <a className="hp-foot__sdg" href="#sdg" title={copy("hp.foot")} aria-label={copy("hp.foot")}>
            {"SDG 12.3"}
          </a>
        </p>
        <a className="hp-link" href="#top">
          <span>
            {copy("hp.top")}
          </span>
        </a>
      </div>
    </footer>
  );
}
