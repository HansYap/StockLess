import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getLocale, useLanguage } from "../i18n/index.ts";

interface ImpactLine { key: string; name: string; sku?: string; available: number; demandHigh: number; units: number; }
type Translate = (en: string, zh: string, ms: string) => string;

function ShelfRow({ line, after, copy }: { line: ImpactLine; after: boolean; copy: Translate }) {
  const available = Math.max(0, Math.round(line.available));
  const expected = Math.min(available, Math.max(0, Math.round(line.demandHigh)));
  const blocks = Math.max(1, Math.min(45, available));
  const expectedBlocks = available ? Math.min(blocks, Math.round(expected / available * blocks)) : 0;
  return <div className="sx-row">
    <div className="sx-row__label"><b>{line.name}</b><span className="num">{line.sku || line.key}</span></div>
    <div className="sx-row__track" role="img" aria-label={`${line.name}: ${available} ${copy("planned units", "计划库存件数", "unit stok dirancang")}, ${expected} ${copy("expected to sell", "预计售出件数", "dijangka terjual")}`} style={{ "--cols": blocks, "--top": expectedBlocks } as CSSProperties}>
      {Array.from({ length: blocks }, (_, i) => <i key={i} className={`sx-pk${i >= expectedBlocks ? " sx-pk--x" : ""}`} style={{ "--i": Math.floor(i / 10) } as CSSProperties} />)}
      <span className="sx-mark" aria-hidden="true"><em>{copy("sells up to", "最多售出", "jualan hingga")} {expected}</em></span>
    </div>
    <b className="sx-row__n">{after ? expected : available}</b>
  </div>;
}

const facts: Array<[string, [string, string, string], [string, string, string]]> = [
  ["40.03%", ["of Malaysia’s 36,900 tonnes of daily solid waste is food", "马来西亚每日 36,900 吨固体废物中的食物占比", "daripada 36,900 tan sisa pepejal harian Malaysia ialah makanan"], ["SWCorp, via Achariam 2026", "SWCorp，引自 Achariam 2026", "SWCorp, melalui Achariam 2026"]],
  ["80.5%", ["of retail food returns are caused by expiry", "的零售食品退货因过期造成", "pemulangan makanan runcit berpunca daripada tamat tempoh"], ["Vijayan et al., 2014", "Vijayan 等，2014", "Vijayan et al., 2014"]],
  ["62.7%", ["of Klang Valley food retailers send leftover food to landfill", "的巴生谷食品零售商将剩余食物送往垃圾填埋场", "peruncit makanan di Lembah Klang menghantar lebihan makanan ke tapak pelupusan"], ["Vijayan et al., 2014", "Vijayan 等，2014", "Vijayan et al., 2014"]],
  ["8.6%", ["of global food-system emissions come from food waste at end of life", "的全球食品系统排放来自废弃阶段的食物浪费", "pelepasan sistem makanan global datang daripada sisa makanan di akhir hayat"], ["Crippa et al., 2021", "Crippa 等，2021", "Crippa et al., 2021"]],
];

/** Keeps the shared visual story separate from CP3 restock and actual-outcome figures. */
export function ImpactStory({ lines }: { lines: ImpactLine[] }) {
  const language = useLanguage();
  const copy: Translate = (en, zh, ms) => language === "zh" ? zh : language === "ms" ? ms : en;
  const positive = lines.filter(item => item.units > 0).sort((a, b) => b.units - a.units);
  const display = lines;
  const story = [...positive, ...lines.filter(item => item.units <= 0).sort((a, b) => b.available - a.available)].slice(0, 2);
  const storyPlanned = story.reduce((sum, item) => sum + Math.max(0, item.available), 0);
  const storyExpected = story.reduce((sum, item) => sum + Math.min(Math.max(0, item.available), Math.max(0, item.demandHigh)), 0);
  const ratio = storyPlanned ? Math.round(storyExpected / storyPlanned * 100) : 0;
  const storyAvoided = Math.max(0, storyPlanned - storyExpected);
  const number = (value: number) => Math.round(value).toLocaleString(getLocale());
  const [after, setAfter] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (playTimer.current) clearTimeout(playTimer.current); }, []);
  const playStory = () => {
    if (playTimer.current) clearTimeout(playTimer.current);
    setAfter(false); setPlaying(true);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setAfter(true); setPlaying(false); return; }
    playTimer.current = setTimeout(() => { setAfter(true); setPlaying(false); }, 1700);
  };
  return <section aria-label={copy("Purchase-plan illustration", "采购计划示意", "Ilustrasi pelan belian")}>
    <button className="btn btn--primary sx-play" type="button" onClick={playStory}>▶ {copy("Play story", "播放故事", "Mainkan cerita")}</button>
    <div className={`sx-hero cp3-story${after ? " is-after is-scanned" : playing ? " is-play is-scanned" : ""}`} id="sx-story">
      <div className="sx-card sx-shelfcard"><div className="sx-cap"><span className="sx-capt">{after ? copy("Illustration · stock capped at upper demand", "示意情景 · 库存限制在需求上限", "Ilustrasi · stok dihadkan pada had atas permintaan") : copy("Current plan · stock after order", "当前计划 · 采购后库存", "Pelan semasa · stok selepas pesanan")}</span><b className="sx-total">{lines.length ? number(after ? storyExpected : storyPlanned) : "—"} <small>{copy("units", "件", "unit")}</small></b></div><div className="sx-shelf">{story.length ? story.map(line => <ShelfRow key={line.key} line={line} after={after} copy={copy} />) : <p className="impact__empty">{copy("Check a planned order to see the comparison.", "检查计划采购量后即可查看对比。", "Semak pesanan dirancang untuk melihat perbandingan.")}</p>}<div className="sx-scan" aria-hidden="true"><span>StockLess</span></div></div>{display.length > 2 && <p className="sx-story-more">{copy(`Showing 2 of ${display.length} checked products`, `显示 ${display.length} 件已核对商品中的 2 件`, `Menunjukkan 2 daripada ${display.length} produk disemak`)}</p>}<div className="sx-bar"><span>{copy("Matched to demand", "与需求匹配", "Sepadan dengan permintaan")}</span><span className="sx-bar__track"><i style={{ width: `${after ? 100 : ratio}%` }} /></span><b>{lines.length ? `${number(storyExpected)} / ${number(after ? storyExpected : storyPlanned)}` : "— / —"}</b></div>
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
    </div>
    <p>{copy("This illustration caps stock at the upper demand estimate. It is not the restock recommendation or a recorded outcome.", "本示意将库存限制在需求估算上限，并非补货建议或已记录的实际结果。", "Ilustrasi ini mengehadkan stok pada anggaran had atas permintaan. Ia bukan cadangan stok semula atau hasil direkodkan.")}</p>
    <ul className="sx-stats">{facts.map(([value, detail, source]) => <li key={value}><b className="sx-stat__n">{value}</b><span>{copy(...detail)}</span><small>{copy(...source)}</small></li>)}</ul>
  </section>;
}
