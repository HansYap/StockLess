import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { getLocale, useLanguage } from "../i18n/index.ts";
import { evaluateProductPurchasePlan, type DemandForecastReview, type ReadinessSnapshot } from "../engine.ts";
import { evaluatePurchaseProduct, joinPurchaseEvidence, type PurchaseDrafts } from "../purchase-plan/model.ts";
import "./impact-reference.css";

interface Props {
  snapshot: ReadinessSnapshot;
  forecast: DemandForecastReview;
  drafts: PurchaseDrafts;
  onBack: () => void;
  onNew?: () => void;
}

/** Only a usable purchase verdict contributes to the impact figures. */
export function calculatePotentialExcess(snapshot: ReadinessSnapshot, forecast: DemandForecastReview, drafts: PurchaseDrafts) {
  return joinPurchaseEvidence(snapshot, forecast).flatMap(product => {
    const inputs = drafts[product.key] ?? product.fileInputs;
    const plan = evaluatePurchaseProduct(product, snapshot.analysisDate, inputs, evaluateProductPurchasePlan, product.fileExpiry);
    if (plan?.audit.state !== "verdict") return [];
    const { availableAfterOrder, demandHigh } = plan.audit.figures;
    return [{ key: product.key, name: product.name, sku: product.sku, available: availableAfterOrder.value, demandHigh: demandHigh.value, units: Math.max(0, availableAfterOrder.value - demandHigh.value) }];
  });
}

type ImpactLine = ReturnType<typeof calculatePotentialExcess>[number];
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

const facts = [
  ["40.03%", "of Malaysia’s 36,900 tonnes of daily solid waste is food", "SWCorp, via Achariam 2026"],
  ["80.5%", "of retail food returns are caused by expiry", "Vijayan et al., 2014"],
  ["62.7%", "of Klang Valley food retailers send leftover food to landfill", "Vijayan et al., 2014"],
  ["8.6%", "of global food-system emissions come from food waste at end of life", "Crippa et al., 2021"],
];

export function ImpactDashboard({ snapshot, forecast, drafts, onBack, onNew }: Props) {
  const language = useLanguage();
  const copy: Translate = (en, zh, ms) => language === "zh" ? zh : language === "ms" ? ms : en;
  const lines = useMemo(() => calculatePotentialExcess(snapshot, forecast, drafts), [snapshot, forecast, drafts]);
  const positive = lines.filter(item => item.units > 0).sort((a, b) => b.units - a.units);
  const display = positive.length ? positive : lines;
  const story = display.slice(0, 2);
  const excess = positive.reduce((sum, item) => sum + item.units, 0);
  const planned = lines.reduce((sum, item) => sum + Math.max(0, item.available), 0);
  const expected = planned - excess;
  const storyPlanned = story.reduce((sum, item) => sum + Math.max(0, item.available), 0);
  const storyExpected = story.reduce((sum, item) => sum + Math.min(Math.max(0, item.available), Math.max(0, item.demandHigh)), 0);
  const ratio = storyPlanned ? Math.round(storyExpected / storyPlanned * 100) : 0;
  const number = (value: number) => Math.round(value).toLocaleString(getLocale());
  const [after, setAfter] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [lens, setLens] = useState<"env" | "biz">("env");
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const envTab = useRef<HTMLButtonElement>(null);
  const bizTab = useRef<HTMLButtonElement>(null);
  useEffect(() => () => { if (playTimer.current) clearTimeout(playTimer.current); }, []);
  const playStory = () => {
    if (playTimer.current) clearTimeout(playTimer.current);
    setAfter(false); setPlaying(true);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setAfter(true); setPlaying(false); return; }
    playTimer.current = setTimeout(() => { setAfter(true); setPlaying(false); }, 1700);
  };
  const switchLens = (next: "env" | "biz", focus = false) => { setLens(next); if (focus) (next === "env" ? envTab : bizTab).current?.focus(); };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); switchLens(lens === "env" ? "biz" : "env", true); }
  };
  const faq = [
    { icon: "♻️", q: copy("How is potential excess estimated?", "如何估算潜在过量库存？", "Bagaimana lebihan stok berpotensi dianggarkan?"), a: copy("For each product StockLess could judge, it takes stock after the planned order and subtracts the top of the expected four-week demand range. Anything above that figure is stock unlikely to sell inside four weeks. Products without both a demand estimate and stock figure are excluded.", "对每件能够判断的商品，StockLess 用计划采购后的库存减去未来四周需求区间的上限。缺少需求或库存数据的商品不会计入。", "Bagi setiap produk yang boleh dinilai, StockLess menolak had atas permintaan empat minggu daripada stok selepas pesanan. Produk tanpa anggaran permintaan dan angka stok tidak dikira.") },
    { icon: "💰", q: copy("Why is a ringgit estimate unavailable?", "为什么暂不显示令吉金额？", "Mengapa anggaran ringgit belum tersedia?"), a: copy("A ringgit estimate needs confirmed unit costs. Unit-cost mapping and validation are not available in this version, so StockLess does not show a monetary figure.", "金额估算需要已确认的单位成本。此版本尚未提供单位成本映射与验证，因此暂不显示金额。", "Anggaran ringgit memerlukan kos seunit yang disahkan. Pemetaan dan pengesahan kos seunit belum tersedia dalam versi ini.") },
    { icon: "🌍", q: copy("What does CO₂e mean, and why is it blank?", "CO₂e 是什么，为什么留空？", "Apakah CO₂e, dan mengapa ia kosong?"), a: copy("CO₂e is carbon dioxide equivalent. A weight for each product and a suitable emissions factor are needed; unit counts alone cannot produce a reliable estimate.", "CO₂e 是二氧化碳当量。计算还需要商品重量和适用的排放系数，仅凭件数无法可靠估算。", "CO₂e ialah setara karbon dioksida. Pengiraan memerlukan berat setiap produk dan faktor pelepasan yang sesuai.") },
    { icon: "📈", q: copy("Are these figures exact?", "这些数字准确吗？", "Adakah angka ini tepat?"), a: copy("No. These estimates depend on the sales, stock and planned order data in your file. A longer and cleaner sales history gives a steadier estimate; they are not verified outcomes.", "不是。估算取决于文件中的销售、库存和计划采购数据，并非经过核实的实际结果。", "Tidak. Anggaran ini bergantung pada data jualan, stok dan pesanan dirancang; ia bukan hasil yang disahkan.") },
  ];

  return <main className="impact" aria-labelledby="impact-title">
    <div className="sx-head"><div><p className="eyebrow">{copy("YOUR PURCHASE PLAN → YOUR IMPACT", "您的采购计划 → 您的影响", "PELAN BELIAN ANDA → IMPAK ANDA")}</p><h1 className="impact__title" id="impact-title">{copy("See the impact of your purchase plan", "查看采购计划的影响", "Lihat impak pelan belian anda")}</h1><p className="impact__lede">{copy("StockLess turns smarter purchasing decisions into impact you can see. These are estimates from your own file, not measured outcomes.", "StockLess 将更明智的采购决定转化为可见的影响。这些是基于您的文件所得的估算，并非实测结果。", "StockLess menjadikan keputusan pembelian lebih bijak sebagai impak yang dapat dilihat. Ini anggaran daripada fail anda, bukan hasil yang diukur.")}</p></div><button className="btn btn--primary sx-play" type="button" onClick={playStory}>▶ {copy("Play story", "播放故事", "Mainkan cerita")}</button></div>

    <div className={`sx-hero${after ? " is-after is-scanned" : playing ? " is-play is-scanned" : ""}`} id="sx-story">
      <div className="sx-card sx-shelfcard"><div className="sx-cap"><span className="sx-capt">{after ? copy("If adjusted · matched to expected demand", "假设调整采购 · 与预期需求匹配", "Jika dilaraskan · sepadan dengan permintaan") : copy("Current plan · stock after order", "当前计划 · 采购后库存", "Pelan semasa · stok selepas pesanan")}</span><b className="sx-total">{lines.length ? number(after ? storyExpected : storyPlanned) : "—"} <small>{copy("units", "件", "unit")}</small></b></div><div className="sx-shelf">{story.length ? story.map(line => <ShelfRow key={line.key} line={line} after={after} copy={copy} />) : <p className="impact__empty">{copy("Check a planned order to see the comparison.", "检查计划采购量后即可查看对比。", "Semak pesanan dirancang untuk melihat perbandingan.")}</p>}<div className="sx-scan" aria-hidden="true"><span>StockLess</span></div></div>{display.length > 2 && <p className="sx-story-more">{copy(`Showing 2 of ${display.length} checked products`, `显示 ${display.length} 件已核对商品中的 2 件`, `Menunjukkan 2 daripada ${display.length} produk disemak`)}</p>}<div className="sx-bar"><span>{copy("Matched to demand", "与需求匹配", "Sepadan dengan permintaan")}</span><span className="sx-bar__track"><i style={{ width: `${after ? 100 : ratio}%` }} /></span><b>{lines.length ? `${number(storyExpected)} / ${number(after ? storyExpected : storyPlanned)}` : "— / —"}</b></div></div>
      <div className="sx-card sx-impactcard"><div className="sx-globe"><img className="sx-orbit" src="/impact/sx-orbit.svg" alt="" /><img className="sx-earth" src="/impact/sx-earth.svg" alt="" /><div className="sx-badge" aria-live="polite"><span className="sx-badge__num">{lines.length ? number(excess) : "—"}</span><span>{copy("UNITS", "件", "UNIT")}</span></div></div><h2 className="sx-impact__title">{copy("What you could avoid", "您可能避免的过量库存", "Lebihan yang mungkin anda elakkan")}</h2><div className="sx-tiles"><div className="sx-tile sx-tile--env"><span className="sx-tile__k">🌱 {copy("Environment", "环境", "Alam sekitar")}</span><b>{lines.length ? number(excess) : "—"} <small>{lines.length ? copy("units", "件", "unit") : ""}</small></b><span>{copy("potential excess stock identified", "已识别的潜在过量库存", "stok berlebihan berpotensi dikenal pasti")}</span></div><div className="sx-tile sx-tile--biz"><span className="sx-tile__k">💰 {copy("Business", "经营", "Perniagaan")}</span><b className="sx-tile__locked">{copy("Not yet available", "暂不可用", "Belum tersedia")}</b><span>{copy("Ringgit estimates are not available in this version.", "此版本暂不提供令吉金额估算。", "Anggaran ringgit belum tersedia dalam versi ini.")}</span></div><div className="sx-tile sx-tile--co2"><span className="sx-tile__k">🌍 {copy("Emissions", "排放", "Pelepasan")}</span><b>{copy("Not yet available", "暂不可用", "Belum tersedia")}</b><span>{copy("Needs a weight per unit. Your file records units only.", "需要每件商品的重量；当前文件只记录件数。", "Memerlukan berat setiap unit. Fail anda hanya merekodkan unit.")}</span></div></div></div>
    </div>

    <ol className="sx-beats"><li><span className="sx-ring"><span className="sx-disc">{lines.length ? number(planned) : "—"}</span></span><span><b>{copy("Your planned stock", "您的计划库存", "Stok dirancang")}</b><small>{copy("What you were about to hold", "原本准备持有的数量", "Apa yang anda bakal simpan")}</small></span></li><li><span className="sx-ring"><span className="sx-disc">{lines.length ? number(expected) : "—"}</span></span><span><b>{copy("Expected to sell", "预计售出", "Dijangka terjual")}</b><small>{copy("The top of your demand range", "需求区间上限", "Had atas julat permintaan")}</small></span></li><li><span className="sx-ring"><span className="sx-disc">{lines.length ? number(excess) : "—"}</span></span><span><b>{copy("Potential excess", "潜在过量库存", "Lebihan berpotensi")}</b><small>{copy("Stock to reconsider before ordering", "下单前值得重新考虑的库存", "Stok untuk dinilai semula")}</small></span></li></ol>

    <div className="sx-card sx-lens"><div className="sx-tabs" role="tablist" aria-label={copy("Impact view", "影响视图", "Paparan impak")}><button role="tab" id="sx-tab-env" aria-controls="sx-lens-env" aria-selected={lens === "env"} tabIndex={lens === "env" ? 0 : -1} className="sx-tab" onClick={() => switchLens("env")} onKeyDown={onTabKey} ref={envTab}>🌱 {copy("Environmental", "环境", "Alam sekitar")}</button><button role="tab" id="sx-tab-biz" aria-controls="sx-lens-biz" aria-selected={lens === "biz"} tabIndex={lens === "biz" ? 0 : -1} className="sx-tab" onClick={() => switchLens("biz")} onKeyDown={onTabKey} ref={bizTab}>💰 {copy("Business", "经营", "Perniagaan")}</button></div><div className="sx-panel" id="sx-lens-env" role="tabpanel" aria-labelledby="sx-tab-env" hidden={lens !== "env"}><div><p className="sx-big">{lines.length ? number(excess) : "—"} <small>{copy("units of potential excess stock", "件潜在过量库存", "unit lebihan stok berpotensi")}</small></p><p className="sx-sub">{copy(`Across ${lines.length} products with a usable purchase check`, `基于 ${lines.length} 件可核对采购计划的商品`, `Daripada ${lines.length} produk dengan semakan belian yang boleh digunakan`)}</p><ul className="sx-chips">{positive.map(item => <li key={item.key}><b>{number(item.units)}</b> {item.name} <span className="num">{item.sku}</span></li>)}</ul></div><div className="sx-co2"><span className="sx-co2__k">CO₂ {copy("impact", "影响", "impak")}</span><b>{copy("Not yet available", "暂不可用", "Belum tersedia")}</b><p>{copy("Your file measures stock in units, not kilograms, so emissions cannot be estimated from it yet.", "文件以件数而非公斤记录库存，因此目前无法估算排放量。", "Fail anda mengukur stok dalam unit, bukan kilogram, jadi pelepasan belum boleh dianggarkan.")}</p></div></div><div className="sx-panel sx-panel--biz" id="sx-lens-biz" role="tabpanel" aria-labelledby="sx-tab-biz" hidden={lens !== "biz"}><div><p className="sx-big sx-big--locked">{copy("Not yet available", "暂不可用", "Belum tersedia")}</p><p className="sx-sub">{copy(`A ringgit value needs confirmed unit costs for these ${number(excess)} potential excess units. StockLess leaves it blank instead of guessing a price.`, `这些 ${number(excess)} 件潜在过量库存需要已确认的单位成本才能计算令吉金额。StockLess 不会猜测价格。`, `Nilai ringgit memerlukan kos seunit yang disahkan untuk ${number(excess)} unit lebihan berpotensi. StockLess tidak meneka harga.`)}</p></div><p className="sx-note">{copy("Monetary impact will need unit-cost mapping and validation before it can be calculated.", "计算金额影响前，需要先实现单位成本映射和验证。", "Impak kewangan memerlukan pemetaan dan pengesahan kos seunit sebelum boleh dikira.")}</p></div></div>

    <section className="impact__lines" aria-labelledby="impact-lines-title"><h2 id="impact-lines-title">{copy("Where the estimate comes from", "估算依据", "Asal anggaran")}</h2>{positive.length ? <ul>{positive.map(item => <li key={item.key}><span className="impact__lname"><b>{item.name}</b><span className="num">{item.sku}</span></span><span className="impact__lunits">{number(item.units)} <span>{copy("units above expected demand", "件超过预期需求", "unit melebihi permintaan dijangka")}</span></span></li>)}</ul> : <p className="impact__empty">{lines.length ? copy("No potential excess is indicated by the checked plans.", "已核对的计划未显示潜在过量库存。", "Tiada lebihan berpotensi ditunjukkan oleh pelan yang disemak.") : copy("No purchase plan has enough checked evidence yet.", "目前没有足够证据来计算采购计划。", "Belum ada pelan belian dengan bukti yang mencukupi.")}</p>}</section>

    <section className="sx-sec" aria-labelledby="sx-flow-title"><h2 className="sx-h2" id="sx-flow-title">{copy("From data to less waste", "从数据到减少浪费", "Daripada data kepada kurang pembaziran")}</h2><p className="learn__lede">{copy("Retail food waste often starts with an order that is too big for what sells. This is how StockLess helps you check a smaller, safer order.", "零售食品浪费往往始于采购量超过销量。StockLess 帮您检查更稳妥的采购量。", "Pembaziran makanan runcit sering bermula dengan pesanan yang melebihi jualan.")}</p><ul className="sx-stats">{facts.map(([value, detail, source]) => <li key={value}><b className="sx-stat__n">{value}</b><span>{detail}</span><small>{source}</small></li>)}</ul><ol className="sx-flow"><li><span className="sx-flow__tag">📊 {copy("DATA", "数据", "DATA")}</span><b className="sx-flow__big">{number(joinPurchaseEvidence(snapshot, forecast).length)} {copy("products", "件商品", "produk")}</b><span>{copy("Weekly sales, stock on hand and the orders you planned.", "每周销量、现有库存和计划采购量。", "Jualan mingguan, stok sedia ada dan pesanan dirancang.")}</span></li><li><span className="sx-flow__tag">⚠️ {copy("PROBLEM", "问题", "MASALAH")}</span><b className="sx-flow__big">{lines.length ? `${number(planned)} ${copy("planned", "计划库存", "dirancang")}` : "—"}</b><span>{copy(`About ${number(expected)} units are within the upper demand range for checked products.`, `已核对商品中约 ${number(expected)} 件位于需求区间上限以内。`, `Kira-kira ${number(expected)} unit berada dalam had atas permintaan.`)}</span></li><li><span className="sx-flow__tag">✅ {copy("RECOMMENDATION", "建议", "CADANGAN")}</span><b className="sx-flow__big">{copy("Order to demand", "按需采购", "Pesan mengikut permintaan")}</b><span>{copy("Check each order against the top of its demand range.", "将每笔采购与其需求区间上限对照。", "Semak setiap pesanan dengan had atas julat permintaannya.")}</span></li><li><span className="sx-flow__tag">♻️ {copy("WASTE PREVENTION", "减少浪费", "CEGAH PEMBAZIRAN")}</span><b className="sx-flow__big">{lines.length ? number(excess) : "—"}</b><span>{copy("potential excess units to reconsider before ordering", "件潜在过量库存值得在下单前重新考虑", "unit lebihan berpotensi untuk dinilai semula")}</span></li></ol></section>

    <section className="sx-sec" aria-labelledby="sx-who-title"><h2 className="sx-h2" id="sx-who-title">{copy("Who feels the difference", "谁会感受到改变", "Siapa yang merasai perbezaannya")}</h2><ul className="sx-who"><li><span className="sx-who__icon" aria-hidden="true">💰</span><span className="sx-who__who">{copy("YOU · THE SHOP OWNER", "您 · 店主", "ANDA · PEMILIK KEDAI")}</span><b>{copy("Less cash tied up", "减少资金占用", "Kurang modal terikat")}</b><span>{copy("Reconsider stock that may not sell. Ringgit estimates are not yet available.", "重新考虑可能卖不出的库存；令吉金额估算目前尚不可用。", "Nilai semula stok yang mungkin tidak terjual. Anggaran ringgit belum tersedia.")}</span></li><li><span className="sx-who__icon" aria-hidden="true">🛒</span><span className="sx-who__who">{copy("CUSTOMERS & COMMUNITY", "顾客与社区", "PELANGGAN & KOMUNITI")}</span><b>{copy("Fresher food on the shelf", "货架上的商品更新鲜", "Makanan lebih segar di rak")}</b><span>{copy("Smaller, more frequent orders can leave less food sitting close to expiry.", "更小、更频繁的采购可减少临近过期的商品积压。", "Pesanan lebih kecil dan kerap boleh mengurangkan makanan hampir luput.")}</span></li><li><span className="sx-who__icon" aria-hidden="true">🌱</span><span className="sx-who__who">{copy("ENVIRONMENT", "环境", "ALAM SEKITAR")}</span><b>{copy("Less food at risk", "减少可能浪费的食物", "Kurang makanan berisiko")}</b><span>{copy(`${number(excess)} potential excess units to review before buying.`, `购买前可重新考虑 ${number(excess)} 件潜在过量库存。`, `${number(excess)} unit lebihan berpotensi untuk disemak.`)}</span></li><li><span className="sx-who__icon" aria-hidden="true">🏛️</span><span className="sx-who__who">{copy("GOVERNMENT & SWCORP", "政府与 SWCorp", "KERAJAAN & SWCORP")}</span><b>{copy("Progress on SDG 12.3", "推动可持续发展目标 12.3", "Kemajuan SDG 12.3")}</b><span>{copy("Prevention at the shop counter supports the goal of reducing retail food waste.", "在零售端预防浪费有助于减少食品浪费。", "Pencegahan di kedai menyokong matlamat mengurangkan pembaziran makanan runcit.")}</span></li></ul></section>

    <section className="impact__sdg" aria-labelledby="impact-sdg-title"><span className="impact__sdg-mark" aria-hidden="true">12</span><div><h2 id="impact-sdg-title">{copy("Your contribution to SDG 12.3", "您与可持续发展目标 12.3", "Sumbangan anda kepada SDG 12.3")}</h2><p>{copy("Your purchase plan can support SDG 12.3 by helping reduce avoidable food waste at retail level. StockLess does not claim a measured reduction — it shows potential overstock to review.", "采购计划可通过减少零售端可避免的食品浪费来支持可持续发展目标 12.3。StockLess 不宣称已实现实测减量，而是显示值得检查的潜在过量库存。", "Pelan belian anda boleh menyokong SDG 12.3. StockLess menunjukkan lebihan berpotensi untuk disemak, bukan pengurangan yang diukur.")}</p><a className="impact__sdg-link" href="https://sdgs.un.org/goals/goal12" target="_blank" rel="noreferrer noopener">{copy("Read about SDG 12 ↗", "了解可持续发展目标 12 ↗", "Baca tentang SDG 12 ↗")}</a></div></section>

    <section className="learn learn--rows" aria-labelledby="impact-learn"><h2 className="learn__title" id="impact-learn">{copy("Understanding your impact", "了解影响数据", "Memahami impak anda")}</h2><p className="learn__lede">{copy("Learn how these numbers are calculated and what they mean.", "了解这些数字的计算方式及含义。", "Ketahui cara nombor ini dikira dan maksudnya.")}</p><div className="learn__list">{faq.map(item => <details className="learn__item" key={item.q}><summary className="learn__q"><span className="learn__icon" aria-hidden="true">{item.icon}</span><span className="learn__qtext">{item.q}</span><span className="learn__chevron" aria-hidden="true" /></summary><p className="learn__a">{item.a}</p></details>)}</div></section>
    <p className="impact__method">{copy("Method: estimates use the demand range from your sales rows, stock figures in your file, and order quantities you entered. Only products with a usable purchase check are included. Figures change when your planned orders change.", "方法：估算基于销售记录的需求区间、文件中的库存数据和您输入的采购量。仅计入可核对采购计划的商品。", "Kaedah: anggaran menggunakan julat permintaan, stok dalam fail, dan kuantiti pesanan anda.")}</p><div className="impact__actions sx-actions"><button type="button" className="btn btn--ghost" onClick={onBack}>{copy("← Back to the purchase plan", "← 返回采购计划", "← Kembali ke pelan belian")}</button>{onNew && <button type="button" className="btn btn--ghost" onClick={onNew}>{copy("Start a new plan", "开始新计划", "Mulakan pelan baharu")}</button>}</div>
  </main>;
}
