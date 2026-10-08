import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { getLocale, useLanguage } from "../i18n/index.ts";

export interface ImpactLine { key: string; name: string; sku?: string; available: number; demandHigh: number; units: number; }
/** A hero tile shows a figure only when the engine produced one; otherwise it says why. */
export interface ImpactTile { readonly value?: string; readonly note: string; }
type Translate = (en: string, zh: string, ms: string) => string;
/** idle → play (stock drops in) → scanned (excess marked) → fly (excess leaves the shelf) → after. */
type Phase = "idle" | "play" | "scanned" | "fly" | "after";

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
export function ImpactStory({ head, lines, business, emissions }: { head: ReactNode; lines: readonly ImpactLine[]; business: ImpactTile; emissions: ImpactTile }) {
  const language = useLanguage();
  const copy: Translate = (en, zh, ms) => language === "zh" ? zh : language === "ms" ? ms : en;
  const number = (value: number) => Math.round(value).toLocaleString(getLocale());
  const story = [...lines].sort((a, b) => b.units - a.units || b.available - a.available).slice(0, 2);
  const storyPlanned = story.reduce((sum, item) => sum + Math.max(0, item.available), 0);
  const storyExpected = story.reduce((sum, item) => sum + Math.min(Math.max(0, item.available), Math.max(0, item.demandHigh)), 0);
  const planned = lines.reduce((sum, item) => sum + Math.max(0, item.available), 0);
  const excess = lines.reduce((sum, item) => sum + Math.max(0, item.units), 0);
  const expected = planned - excess;
  const ratio = storyPlanned ? Math.round(storyExpected / storyPlanned * 100) : 0;
  const storyAvoided = Math.max(0, storyPlanned - storyExpected);
  const motion = typeof window !== "undefined" && typeof IntersectionObserver === "function"
    && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [phase, setPhase] = useState<Phase>(motion && lines.length ? "idle" : "after");
  const storyRef = useRef<HTMLDivElement>(null), badgeRef = useRef<HTMLSpanElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]), flights = useRef<Animation[]>([]);
  const badge = useCountUp(excess, phase === "fly");
  const envUnits = useCountUp(excess, phase === "after" && motion, 1300);

  const reset = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    flights.current.forEach(flight => flight.cancel()); flights.current = [];
    document.querySelectorAll(".sx-flyer").forEach(flyer => flyer.remove());
    storyRef.current?.querySelectorAll(".sx-pk--x.is-gone").forEach(block => block.classList.remove("is-gone"));
  };
  const fly = () => {
    const target = badgeRef.current?.getBoundingClientRect();
    const blocks = [...(storyRef.current?.querySelectorAll<HTMLElement>(".sx-pk--x") ?? [])];
    if (!target || typeof document.body.animate !== "function") return 0;
    blocks.forEach((block, index) => {
      const from = block.getBoundingClientRect(), flyer = document.createElement("i");
      flyer.className = "sx-flyer";
      Object.assign(flyer.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
      document.body.appendChild(flyer);
      const dx = target.left + target.width / 2 - from.left - from.width / 2, dy = target.top + target.height / 2 - from.top - from.height / 2;
      const flight = flyer.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * .5}px,${dy * .5 - 50}px) scale(1.1)`, opacity: 1, offset: .5 },
        { transform: `translate(${dx}px,${dy}px) scale(.3)`, opacity: 0 }], { duration: 850, delay: index * 65, easing: "cubic-bezier(.5,0,.4,1)", fill: "both" });
      flights.current.push(flight);
      flight.onfinish = () => flyer.remove();
      timers.current.push(setTimeout(() => block.classList.add("is-gone"), index * 65 + 60));
    });
    return blocks.length;
  };
  const play = () => {
    if (!motion || !lines.length) { setPhase("after"); return; }
    reset(); setPhase("play");
    timers.current.push(setTimeout(() => setPhase("scanned"), 2400));
    timers.current.push(setTimeout(() => {
      setPhase("fly");
      const count = fly();
      timers.current.push(setTimeout(() => setPhase("after"), Math.min(1600, 850 + count * 65)));
    }, 3500));
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
  const beat = phase === "idle" || phase === "play" ? 1 : phase === "after" ? 3 : 2;
  const beats: readonly [number, string, string][] = [
    [planned, copy("Your planned stock", "原本计划的库存", "Stok yang anda rancang"), copy("Stock after your planned orders", "按计划下单后的库存", "Stok selepas pesanan dirancang")],
    [expected, copy("Expected to sell", "预计卖得掉", "Jangkaan jualan"), copy("The top of your demand range", "预计销量的上限", "Had atas jangkaan jualan")],
    [excess, copy("Potential excess", "潜在多余库存", "Lebihan berpotensi"), copy("Above the range: reconsider before ordering", "超出上限：下单前再考虑", "Melebihi julat: semak semula sebelum memesan")],
  ];
  return <>
    <div className="sx-head">
      <div>{head}</div>
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
        {lines.length > 2 && <p className="sx-story-more">{copy(`Showing the 2 products with the most potential excess, of ${lines.length} checked`, `显示 ${lines.length} 件已核对商品中潜在多余最多的 2 件`, `Memaparkan 2 produk dengan lebihan berpotensi tertinggi daripada ${lines.length} yang disemak`)}</p>}
        <div className="sx-bar"><span>{copy("Matched to demand", "符合预计销量", "Ikut jangkaan jualan")}</span><span className="sx-bar__track"><i style={{ "--ratio": `${ratio}%` } as CSSProperties} /></span><b>{story.length ? <><span className="t-before">{number(storyExpected)} / {number(storyPlanned)}</span><span className="t-after">{number(storyExpected)} / {number(storyExpected)}</span></> : "— / —"}</b></div>
        {lines.length > 0 && <div className="sx-chg">
          <div className="sx-chg__head"><h3 className="sx-chg__title"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 21c0-6 3-10 9-11-1 6-4 9-9 9" fill="#3E9B5A" /><path d="M12 21c0-5-2-8-8-9 0 5 3 8 8 8" fill="#65C9BC" /></svg>{copy("What changed with StockLess?", "StockLess 带来了什么变化？", "Apa yang berubah dengan StockLess?")}</h3><span className="sx-chg__pill"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="M12 11v6M12 7.5v.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>{copy("Compared to current purchase plan", "与当前采购计划相比", "Berbanding pelan belian semasa")}</span></div>
          <ul className="sx-chg__tiles">
            <li className="sx-chg__tile"><span className="sx-chg__ic sx-chg__ic--teal"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 11h11L21 7H6.2" /><circle cx="9" cy="19.5" r="1.5" /><circle cx="17" cy="19.5" r="1.5" /></svg></span><span><b>{number(storyExpected)} <small>{copy("units", "件", "unit")}</small></b><strong>{copy("Matched to demand", "与需求匹配", "Sepadan dengan permintaan")}</strong><small>{copy("Stock within the upper demand estimate", "需求上限估算内的库存", "Stok dalam anggaran had atas permintaan")}</small></span></li>
            <li className="sx-chg__tile"><span className="sx-chg__ic sx-chg__ic--leaf"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 20c0-7 3-12 9-13-1 7-4 11-9 11" fill="currentColor" /><path d="M12 20c0-5-2-9-8-10 0 6 3 9 8 9" fill="currentColor" opacity=".7" /></svg></span><span><b>{number(storyAvoided)} <small>{copy("units", "件", "unit")}</small></b><strong>{copy("Potential excess to reconsider", "值得重新考虑的潜在过量库存", "Lebihan berpotensi untuk dinilai semula")}</strong><small>{copy("Illustration, not recorded waste reduction", "示意情景，并非实际减损记录", "Ilustrasi, bukan pengurangan sisa direkod")}</small></span></li>
            <li className="sx-chg__tile sx-chg__tile--blue"><span className="sx-chg__ic sx-chg__ic--blue"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><rect x="4" y="11" width="4" height="9" rx="1" /><rect x="10" y="6" width="4" height="14" rx="1" /><rect x="16" y="9" width="4" height="11" rx="1" /></svg></span><span><b>{storyPlanned ? "100%" : "—"}</b><strong>{copy("Demand matched", "需求匹配度", "Permintaan dipadankan")}</strong><small>{copy(`Up from ${ratio}% in your current plan`, `当前计划为 ${ratio}%`, `Naik daripada ${ratio}% dalam pelan semasa`)}</small></span></li>
          </ul>
          <div className="sx-chg__note"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M12 22V12" stroke="#2F7F48" strokeWidth="2" strokeLinecap="round" /><path d="M12 13c0-5 3-8 8-8 0 5-3 8-8 8" fill="#3E9B5A" /><path d="M12 13c0-4-2-7-7-7 0 4 2 7 7 7" fill="#65C9BC" /></svg><span><b>{copy("Better aligned purchasing with expected demand", "采购与预期需求更一致", "Pembelian lebih sejajar dengan permintaan dijangka")}</b>{copy("StockLess helps you buy the right amount, reducing unnecessary stock before it becomes waste.", "StockLess 帮您买对数量，在库存变成浪费之前减少不必要的库存。", "StockLess membantu anda membeli jumlah yang betul, mengurangkan stok yang tidak perlu sebelum ia menjadi sisa.")}</span></div>
        </div>}
      </div>
      <div className="sx-card sx-impactcard">
        <div className="sx-globe">
          <img className="sx-orbit" src="/impact/sx-orbit.svg" alt="" />
          <img className="sx-earth" src="/impact/sx-earth.svg" alt="" />
          <div className="sx-badge" aria-live="polite"><span className="sx-badge__num" ref={badgeRef}>{lines.length ? number(phase === "play" || phase === "scanned" ? 0 : badge) : "—"}</span><span>{copy("UNITS", "件", "UNIT")}</span></div>
        </div>
        <h2 className="sx-impact__title">{copy("What your plan could avoid", "这个计划可以避免的", "Apa yang pelan anda boleh elakkan")}</h2>
        <div className="sx-tiles">
          <div className="sx-tile sx-tile--env"><span className="sx-tile__k"><span aria-hidden="true">🌱</span> {copy("Environment", "环境", "Alam sekitar")}</span>{lines.length ? <b>{number(phase === "play" || phase === "scanned" || phase === "fly" ? 0 : envUnits)} <small>{copy("units", "件", "unit")}</small></b> : <b className="sx-tile__locked">{copy("Not yet available", "暂时无法计算", "Belum tersedia")}</b>}<span>{lines.length ? copy("of food stock above expected demand", "件食品库存超出预计销量", "stok makanan melebihi jangkaan jualan") : copy("Enter planned orders in Step 4.", "请在第 4 步填写计划订购量。", "Masukkan pesanan dirancang dalam Langkah 4.")}</span></div>
          <div className="sx-tile sx-tile--biz"><span className="sx-tile__k"><span aria-hidden="true">💰</span> {copy("Business", "生意", "Perniagaan")}</span>{business.value ? <b className="sx-tile__money">{business.value}</b> : <b className="sx-tile__locked">{copy("Not yet available", "暂时无法计算", "Belum tersedia")}</b>}<span>{business.note}</span></div>
          <div className="sx-tile sx-tile--co2"><span className="sx-tile__k"><span aria-hidden="true">🌍</span> {copy("Emissions", "碳排放", "Pelepasan karbon")}</span>{emissions.value ? <b className="sx-tile__value">{emissions.value}</b> : <b>{copy("Not yet available", "暂时无法计算", "Belum tersedia")}</b>}<span>{emissions.note}</span></div>
        </div>
      </div>
    </div>
    <ol className="sx-beats">{beats.map(([value, title, note], index) => <li key={title} style={{ opacity: index < beat ? 1 : .5 }}><span className="sx-ring"><span className={`sx-disc${number(value).length > 4 ? " sx-disc--long" : ""}`}>{lines.length ? number(value) : "—"}</span></span><span><b>{title}</b><small>{note}</small></span></li>)}</ol>
  </>;
}
