import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { getLocale, useLanguage } from "../i18n/index.ts";
import "./impact-band.css";
import { ImpactIcon } from "./ImpactIcon.tsx";

export interface ImpactLine { key: string; name: string; sku?: string; available: number; demandHigh: number; units: number; }
/** A hero tile shows a figure only when the engine produced one; otherwise it says why. */
export interface ImpactTile { readonly value?: string; readonly note: string; }
type Translate = (en: string, zh: string, ms: string) => string;
/** idle → play (stock drops in) → scanned (excess marked) → fly (excess leaves the shelf) → after. */
type Phase = "idle" | "play" | "scanned" | "fly" | "after";
/** Story timing, slowed down so each step can be followed. */
const SCAN_AT_MS = 4200, FLY_AT_MS = 6200, FLIGHT_MS = 1300, STAGGER_MS = 90;

function ShelfRow({ line, copy }: { line: ImpactLine; copy: Translate }) {
  const available = Math.max(0, Math.round(line.available));
  const expected = Math.min(available, Math.max(0, Math.round(line.demandHigh)));
  const blocks = Math.max(1, Math.min(45, available));
  const expectedBlocks = available ? Math.min(blocks, Math.round(expected / available * blocks)) : 0;
  return <div className="sx-row" style={{ "--cols": blocks, "--top": expectedBlocks } as CSSProperties}>
    <div className="sx-row__label"><b>{line.name}</b><span className="num">{line.sku || line.key}</span></div>
    <div className="sx-row__track" role="img" aria-label={`${line.name}: ${available} ${copy("planned units", "件计划库存", "unit stok dirancang")}, ${expected} ${copy("expected to sell", "件预计售出", "unit dijangka terjual")}`}>
      {Array.from({ length: blocks }, (_, i) => <i key={i} className={`sx-pk${i >= expectedBlocks ? " sx-pk--x" : ""}`} style={{ "--i": Math.floor(i / 10) } as CSSProperties} />)}
      <span className="sx-mark" aria-hidden="true"><em>{copy("sells up to", "最多卖", "laku hingga")} {expected}</em></span>
    </div>
    <b className="sx-row__n"><span className="t-before">{available}</span><span className="t-after">{expected}</span></b>
  </div>;
}

/** Counts from zero to the target while `running`; otherwise shows the target. */
function useCountUp(target: number, running: boolean, ms = 900) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (!running || typeof requestAnimationFrame !== "function") { setValue(target); return; }
    let frame = 0, start: number | undefined;
    const step = (time: number) => {
      start ??= time;
      const progress = Math.min(1, (time - start) / ms);
      setValue(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    setValue(0); frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, running, ms]);
  return value;
}

/** The Step 5 story from the supplied design: planned shelf → expected demand → potential excess. */
export function ImpactStory({ head, aside, lines, totalProducts, business, emissions, onBack, onExcess, onBusiness, onEmissions }: { head: ReactNode; aside?: ReactNode; lines: readonly ImpactLine[]; totalProducts: number; business: ImpactTile; emissions: ImpactTile; onBack?: () => void; onExcess: () => void; onBusiness: () => void; onEmissions: () => void }) {
  const language = useLanguage();
  const copy: Translate = (en, zh, ms) => language === "zh" ? zh : language === "ms" ? ms : en;
  const number = (value: number) => Math.round(value).toLocaleString(getLocale());
  const story = [...lines].sort((a, b) => b.units - a.units || b.available - a.available).slice(0, 3);
  const storyPlanned = story.reduce((sum, item) => sum + Math.max(0, item.available), 0);
  const storyExpected = story.reduce((sum, item) => sum + Math.min(Math.max(0, item.available), Math.max(0, item.demandHigh)), 0);
  const planned = lines.reduce((sum, item) => sum + Math.max(0, item.available), 0);
  const excess = lines.reduce((sum, item) => sum + Math.max(0, item.units), 0);
  const expected = planned - excess;
  const coverage = copy(`From ${lines.length} of ${totalProducts} products · next 4 weeks`, `来自 ${totalProducts} 件商品中的 ${lines.length} 件 · 未来 4 周`, `Daripada ${lines.length} daripada ${totalProducts} produk · 4 minggu akan datang`);
  const ratio = storyPlanned ? Math.round(storyExpected / storyPlanned * 100) : 0;
  const moreCount = Math.max(0, lines.length - story.length);
  const moreExtra = Math.max(0, excess - story.reduce((sum, item) => sum + Math.max(0, item.units), 0));
  const motion = typeof window !== "undefined" && typeof IntersectionObserver === "function"
    && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [phase, setPhase] = useState<Phase>(motion && lines.length ? "idle" : "after");
  const storyRef = useRef<HTMLDivElement>(null), badgeRef = useRef<HTMLSpanElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]), flights = useRef<Animation[]>([]);
  const badge = useCountUp(excess, phase === "fly", 1600);

  const reset = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    flights.current.forEach(flight => flight.cancel()); flights.current = [];
    storyRef.current?.querySelectorAll(".sx-flyer").forEach(flyer => flyer.remove());
    storyRef.current?.querySelectorAll(".sx-pk--x.is-gone").forEach(block => block.classList.remove("is-gone"));
  };
  // Flyers live inside the story box (not fixed to the screen), so they stay on course when the page scrolls.
  const fly = () => {
    const box = storyRef.current, badgeEl = badgeRef.current;
    const blocks = [...(box?.querySelectorAll<HTMLElement>(".sx-pk--x") ?? [])];
    if (!box || !badgeEl || typeof document.body.animate !== "function") return 0;
    const origin = box.getBoundingClientRect(), target = badgeEl.getBoundingClientRect();
    blocks.forEach((block, index) => {
      const from = block.getBoundingClientRect(), flyer = document.createElement("i");
      flyer.className = "sx-flyer";
      Object.assign(flyer.style, { left: `${from.left - origin.left}px`, top: `${from.top - origin.top}px`, width: `${from.width}px`, height: `${from.height}px` });
      box.appendChild(flyer);
      const dx = target.left + target.width / 2 - from.left - from.width / 2, dy = target.top + target.height / 2 - from.top - from.height / 2;
      const flight = flyer.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * .5}px,${dy * .5 - 60}px) scale(1.15)`, opacity: 1, offset: .5 },
        { transform: `translate(${dx}px,${dy}px) scale(.3)`, opacity: 0 }], { duration: FLIGHT_MS, delay: index * STAGGER_MS, easing: "cubic-bezier(.5,0,.4,1)", fill: "both" });
      flights.current.push(flight);
      flight.onfinish = () => flyer.remove();
      timers.current.push(setTimeout(() => block.classList.add("is-gone"), index * STAGGER_MS + 80));
    });
    return blocks.length;
  };
  const play = () => {
    if (!motion || !lines.length) { setPhase("after"); return; }
    reset(); setPhase("play");
    timers.current.push(setTimeout(() => setPhase("scanned"), SCAN_AT_MS));
    timers.current.push(setTimeout(() => {
      setPhase("fly");
      const count = fly();
      timers.current.push(setTimeout(() => setPhase("after"), Math.min(3200, FLIGHT_MS + count * STAGGER_MS)));
    }, FLY_AT_MS));
  };
  // The design plays the story once, the first time it scrolls into view.
  useEffect(() => {
    if (phase !== "idle" || !storyRef.current) return;
    const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) { observer.disconnect(); play(); } }, { threshold: .35 });
    observer.observe(storyRef.current);
    return () => observer.disconnect();
  });
  useEffect(() => () => reset(), []);

  const classes = ["sx-hero", phase === "after" ? "is-after is-scanned" : "is-armed", phase === "play" || phase === "scanned" || phase === "fly" ? "is-play" : "", phase === "scanned" || phase === "fly" ? "is-scanned" : ""].filter(Boolean).join(" ");
  return <>
    <div className="sx-band">
      <div className="sx-band__top"><div className="sx-band__main">{head}</div>{aside}</div>
      <div className="sx-band__actions">
        {onBack && <button type="button" className="sx-back" onClick={onBack}>{copy("← Back to purchase plan", "← 返回进货计划", "← Kembali ke pelan belian")}</button>}
        <span className="sx-band__spacer" />
      </div>
    </div>
    <ul className="sx-kpis sx-kpis--summary" aria-label={copy("Your plan at a glance", "计划概览", "Ringkasan pelan anda")}>
      <li><button type="button" className="sx-kpi-button" onClick={onExcess} aria-controls="impact-excess-products"><span className="sx-kpi__ic sx-kpi__ic--teal" aria-hidden="true"><ImpactIcon name="sprout" size={24} /></span><span><strong className="sx-kpi-label">{copy("Possible excess stock", "可能多余的库存", "Stok berlebihan berpotensi")}</strong><b>{lines.length ? <>{number(excess)} <small>{copy("units", "件", "unit")}</small></> : copy("Not yet available", "暂时无法计算", "Belum tersedia")}</b><em>{lines.length ? coverage : copy("Enter planned orders to check for excess stock.", "填写计划订单后即可检查多余库存。", "Masukkan pesanan dirancang untuk menyemak stok berlebihan.")}</em><span className="sx-kpi-link">{copy("See products →", "查看商品 →", "Lihat produk →")}</span></span></button></li>
      <li><button type="button" className="sx-kpi-button" onClick={onBusiness} aria-controls="business-breakdown"><span className="sx-kpi__ic sx-kpi__ic--amber" aria-hidden="true"><ImpactIcon name="coins" size={24} /></span><span><strong className="sx-kpi-label">{copy("Money tied up in excess", "压在多余库存上的资金", "Wang terikat pada lebihan")}</strong><b>{business.value ?? copy("Not yet available", "暂时无法计算", "Belum tersedia")}</b><em>{business.note}</em><span className="sx-kpi-link">{copy("See costs →", "查看成本 →", "Lihat kos →")}</span></span></button></li>
      <li><button type="button" className="sx-kpi-button" onClick={onEmissions} aria-controls="environment-breakdown"><span className="sx-kpi__ic sx-kpi__ic--blue" aria-hidden="true"><ImpactIcon name="globe" size={24} /></span><span><strong className="sx-kpi-label">{copy("Estimated CO₂e of excess", "多余库存的 CO₂e 估算", "Anggaran CO₂e lebihan")}</strong><b>{emissions.value ?? copy("Not yet available", "暂时无法计算", "Belum tersedia")}</b><em>{emissions.note}</em><span className="sx-kpi-link">{copy("See estimate →", "查看估算 →", "Lihat anggaran →")}</span></span></button></li>
    </ul>
    <section className="sx-card impact-sec sx-story-details" aria-labelledby="sx-story-title">
    <div className="impact-sec__head">
      <span className="impact-sec__icon" aria-hidden="true"><ImpactIcon name="story" size={24} /></span>
      <div className="impact-sec__titles"><h2 id="sx-story-title">{copy("Your plan, illustrated", "计划演示", "Pelan anda, bergambar")}</h2><p>{copy("Which orders are more than you are likely to sell.", "哪些订单多于可能卖出的数量。", "Pesanan mana yang lebih daripada yang mungkin terjual.")}</p></div>
      {lines.length > 0 && <button className="btn btn--primary sx-play" type="button" onClick={play}><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg> {copy("Play story", "播放演示", "Main animasi")}</button>}
    </div>
    <div className={classes} id="sx-story" ref={storyRef}>
      <div className="sx-card sx-shelfcard">
        <div className="sx-cap">
          <span className="sx-capt"><span className="t-before">{copy("Before StockLess · your planned stock", "使用 StockLess 前 · 原本计划的库存", "Sebelum StockLess · stok yang anda rancang")}</span><span className="t-after">{copy("With StockLess · matched to expected demand", "使用 StockLess 后 · 按预计销量进货", "Dengan StockLess · ikut jangkaan jualan")}</span></span>
          <b className="sx-total">{story.length ? <><span className="t-before">{number(storyPlanned)}</span><span className="t-after">{number(storyExpected)}</span></> : "—"} <small>{copy("units", "件", "unit")}</small></b>
        </div>
        <div className="sx-shelf">
          {story.length ? story.map(line => <ShelfRow key={line.key} line={line} copy={copy} />) : <p className="impact__empty">{copy("Enter a planned order in Step 4 to see this comparison.", "在第 4 步填写计划订购量后即可查看对比。", "Masukkan pesanan dirancang dalam Langkah 4 untuk melihat perbandingan ini.")}</p>}
          <div className="sx-scan" aria-hidden="true"><span>StockLess</span></div>
        </div>
        {story.length > 0 && <p className="sx-legend"><span><i className="sx-legend__sell" />{copy("Likely to sell", "可能卖出", "Mungkin terjual")}</span><span><i className="sx-legend__extra" />{copy("Extra, above demand", "多余，超出需求", "Lebihan, melebihi permintaan")}</span></p>}
        {moreCount > 0 && <p className="sx-story-more"><span>{copy(`+ ${moreCount} more products · ${moreExtra} extra`, `另外 ${moreCount} 件商品 · 多余 ${moreExtra} 件`, `+ ${moreCount} produk lagi · ${moreExtra} lebihan`)}</span>{onBack && <button type="button" className="sx-more-link" onClick={onBack}>{copy("See all in plan →", "在计划中查看全部 →", "Lihat semua dalam pelan →")}</button>}</p>}
        <div className="sx-bar"><span>{copy("Matched to demand", "符合预计销量", "Ikut jangkaan jualan")}</span><span className="sx-bar__track"><i style={{ "--ratio": `${ratio}%` } as CSSProperties} /></span><b>{story.length ? <><span className="t-before">{number(storyExpected)} / {number(storyPlanned)}</span><span className="t-after">{number(storyExpected)} / {number(storyExpected)}</span></> : "— / —"}</b></div>
        {lines.length > 0 && <div className="sx-chg">
          <div className="sx-chg__note"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M12 22V12" stroke="#2F7F48" strokeWidth="2" strokeLinecap="round" /><path d="M12 13c0-5 3-8 8-8 0 5-3 8-8 8" fill="#3E9B5A" /><path d="M12 13c0-4-2-7-7-7 0 4 2 7 7 7" fill="#65C9BC" /></svg><span><b>{copy("Better aligned purchasing with expected demand", "采购与预期需求更一致", "Pembelian lebih sejajar dengan permintaan dijangka")}</b>{copy("StockLess helps you buy the right amount, reducing unnecessary stock before it becomes waste.", "StockLess 帮您买对数量，在库存变成浪费之前减少不必要的库存。", "StockLess membantu anda membeli jumlah yang betul, mengurangkan stok yang tidak perlu sebelum ia menjadi sisa.")}</span></div>
        </div>}
      </div>
      <div className="sx-card sx-impactcard">
        <div className="sx-globe">
          <img className="sx-orbit" src="/impact/sx-orbit.svg" alt="" />
          <img className="sx-earth" src="/impact/sx-earth.svg" alt="" />
          <div className="sx-badge" aria-live="polite"><span className="sx-badge__num" ref={badgeRef}>{lines.length ? number(phase === "play" || phase === "scanned" ? 0 : badge) : "—"}</span><span>{copy("ITEMS", "件", "ITEM")}</span></div>
        </div>
        <h2 className="sx-impact__title">{copy("What your plan could avoid", "这个计划可以避免的", "Apa yang pelan anda boleh elakkan")}</h2>
        {lines.length > 0 ? <p className="sx-globe-note"><b>{number(excess)} {copy("items", "件商品", "item")}</b> {copy("are above the expected demand range. Review these orders to reduce the risk of excess stock.", "高于预期需求区间。请核对这些订单，以降低多余库存的风险。", "melebihi julat permintaan dijangka. Semak pesanan ini untuk mengurangkan risiko stok berlebihan.")}</p>
          : <p className="sx-globe-note">{copy("Enter planned orders in Step 4.", "请在第 4 步填写计划订购量。", "Masukkan pesanan dirancang dalam Langkah 4.")}</p>}
        {lines.length > 0 && onBack && <button type="button" className="btn btn--ghost sx-globe-go" onClick={onBack}>{copy("Lower these orders in the plan →", "在计划中减少这些订单 →", "Kurangkan pesanan ini dalam pelan →")}</button>}
      </div>
    </div>
    {lines.length > 0 && <div className="sx-sum">
      <p className="sx-sum__eq"><span>{copy("You plan", "您计划进货", "Anda rancang")} <b>{number(planned)}</b></span><i aria-hidden="true">−</i><span>{copy("likely to sell", "可能卖出", "mungkin terjual")} <b className="is-teal">{number(expected)}</b></span><i aria-hidden="true">=</i><span><b className="is-amber">{number(excess)}</b> {copy("extra", "多余", "lebihan")}</span></p>
      <div className="sx-sum__bar" role="img" aria-label={copy(`${number(expected)} likely to sell, ${number(excess)} extra`, `可能卖出 ${number(expected)}，多余 ${number(excess)}`, `${number(expected)} mungkin terjual, ${number(excess)} lebihan`)}><span style={{ flexGrow: Math.max(0, expected) }} /><span style={{ flexGrow: Math.max(0, excess) }} /></div>
      <small>{copy("Next 4 weeks · lower the orange part before you order.", "未来 4 周 · 下单前减少橙色部分。", "4 minggu akan datang · kurangkan bahagian oren sebelum memesan.")}</small>
    </div>}
    </section>
  </>;
}
