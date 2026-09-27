import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/index.ts";
import "./finance-preview.css";

/** Turn off to hide this entire reversible design experiment, including hints. */
export const FINANCE_PREVIEW_ENABLED = true;
function useCopy() {
  const language = useLanguage();
  return (en: string, zh: string, ms: string) => language === "zh" ? zh : language === "ms" ? ms : en;
}

export function FinanceHint({ step }: { step: 1 | 2 | 3 }) {
  const c = useCopy();
  if (!FINANCE_PREVIEW_ENABLED) return null;
  const text = step === 1
    ? c("Optional purchase costs and selling prices will unlock money insights. You can still plan quantities without them.", "购买单价和售价是选填资料，可解锁金钱分析；没有这些资料，也可以规划采购数量。", "Kos belian dan harga jualan adalah pilihan. Kuantiti masih boleh dirancang tanpanya.")
    : step === 2
    ? c("Money insights need a purchase cost per sales unit and a currency. Cost-column matching is not available in this preview.", "金钱分析需要每个销售单位的购买单价及币种。此试版尚不支持成本列匹配。", "Analisis wang memerlukan kos seunit jualan dan mata wang. Padanan lajur kos belum tersedia dalam pratonton ini.")
    : c("Financial coverage is not yet available for this file. Step 4 offers a separate dashboard example; demand and quantity planning remain available.", "当前文件暂无法检查财务资料覆盖范围。Step 4 可查看独立 Dashboard 示例，需求与数量规划仍可使用。", "Liputan kewangan fail belum tersedia. Step 4 menyediakan contoh papan pemuka berasingan; perancangan kuantiti masih tersedia.");
  return <aside className="finance-hint"><span aria-hidden="true">🌿</span><p><b>{c("Money insights", "金钱分析", "Analisis wang")}</b> · {text}</p></aside>;
}

export function FinancePreview() {
  const c = useCopy();
  const [open, setOpen] = useState(false);
  if (!FINANCE_PREVIEW_ENABLED) return null;
  const labels = [c("Planned purchase spending", "计划采购支出", "Perbelanjaan belian dirancang"), c("Incoming stock cost", "在途库存成本", "Kos stok dalam perjalanan"), c("Potential excess-stock cost", "潜在过量库存成本", "Kos potensi stok berlebihan")];
  return <section className="finance-preview" aria-label={c("Purchase money overview", "采购资金概览", "Gambaran wang belian")}>
    <div className="finance-head"><div><h2>{c("What will this plan cost?", "这份计划，需要投入多少？", "Berapakah kos rancangan ini?")}</h2><p>{c("Money insights · design preview", "金钱分析 · 设计试版", "Analisis wang · pratonton reka bentuk")}</p></div><button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen(true)}>{c("Open dashboard example →", "查看 Dashboard 示例 →", "Buka contoh papan pemuka →")}</button></div>
    <div className="finance-stats">{labels.map(label => <article className="finance-stat" key={label}><span>{label}</span><strong>—</strong><small>{c("Purchase cost and currency required", "待补充购买单价与币种", "Kos belian dan mata wang diperlukan")}</small></article>)}</div>
    <p className="finance-note">{c("This file has no connected financial results yet. The example uses separate fictional data and never changes your purchase plan.", "当前文件尚无可用财务结果。示例使用独立虚构数据，不会修改您的采购计划。", "Keputusan kewangan fail belum tersedia. Contoh menggunakan data rekaan berasingan dan tidak mengubah rancangan belian anda.")}</p>
    {open && <DashboardExample onClose={() => setOpen(false)} />}
  </section>;
}

function DashboardExample({ onClose }: { onClose: () => void }) {
  const c = useCopy();
  const ref = useRef<HTMLDialogElement>(null);
  const [raw, setRaw] = useState("20");
  const [quantity, setQuantity] = useState(20);
  const valid = raw !== "" && /^\d+$/.test(raw) && Number(raw) <= 999999;
  const spending = quantity * 8 + 180;
  const excess = Math.max(0, quantity - 10) * 8;
  const money = (n: number) => `RM ${n.toLocaleString("en-MY")}`;
  useEffect(() => {
    const focus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    ref.current?.showModal();
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; focus?.focus(); };
  }, []);
  const labels = [c("Planned spending · estimate", "计划采购支出 · 估算", "Perbelanjaan dirancang · anggaran"), c("Incoming stock cost", "在途库存成本", "Kos stok dalam perjalanan"), c("Potential excess cost · estimate", "潜在过量成本 · 估算", "Kos potensi lebihan · anggaran")];
  return <dialog ref={ref} className="finance-dashboard" aria-labelledby="finance-dashboard-title" onCancel={e => { e.preventDefault(); onClose(); }}>
    <header className="finance-head"><div><span className="finance-example-tag">{c("Fictional example · separate from your file", "虚构示例 · 与当前文件无关", "Contoh rekaan · berasingan daripada fail anda")}</span><h2 id="finance-dashboard-title">{c("Make every purchase count.", "让每一次采购，更有把握。", "Rancang setiap belian dengan yakin.")}</h2></div><button className="btn btn--ghost btn--small" onClick={onClose} aria-label={c("Close dashboard example", "关闭 Dashboard 示例", "Tutup contoh papan pemuka")}>×</button></header>
    <div className="finance-dashboard-body"><p className="finance-context">Aina Mini Mart · example-sales.csv · MYR<br />2026/09/28 – 2026/10/25 · {c("Costs available for 3 of 4 products", "4 件商品中，3 件有成本资料", "Kos tersedia bagi 3 daripada 4 produk")}</p>
      <div className="finance-stats" aria-live="polite">{[spending,110,excess+40].map((n,i) => <article className={`finance-stat${i===2 ? " finance-stat--risk" : ""}`} key={i}><span>{labels[i]}</span><strong>{money(n)}</strong><small>{i===2 ? c("Risk estimate, not an actual loss", "风险估算，非实际损失", "Anggaran risiko, bukan kerugian sebenar") : c("3 priced products only", "仅计入 3 件有成本的商品", "Hanya 3 produk berkos")}</small></article>)}</div>
      <div className="finance-columns"><section className="finance-panel"><h3>{c("Compare purchase spending", "比较采购支出", "Bandingkan perbelanjaan belian")}</h3><div className="finance-comparison"><span>{c("My plan", "我的计划", "Rancangan saya")}</span><b>{money(spending)}</b></div><div className="finance-comparison"><span>{c("Lower-quantity option", "较少订购方案", "Pilihan kuantiti lebih rendah")}</span><b>RM 220</b></div><p className="finance-note">{c("Estimated purchase-spend difference", "预计采购支出差额", "Perbezaan anggaran perbelanjaan belian")}: {money(Math.abs(spending-220))}<br />{c("Not realised savings or profit. Example options have not been checked against supplier terms.", "并非已实现节省或利润；示例方案尚未核对供应商限制。", "Bukan penjimatan sebenar atau keuntungan. Pilihan contoh belum disemak terhadap syarat pembekal.")}</p><details><summary>{c("Why these amounts?", "为什么是这些金额？", "Mengapa jumlah ini?")}</summary><p>Sambal: {quantity} × RM 8 · Kopi O: 30 × RM 4 · Teh Tarik: 10 × RM 6</p><p>{c("Alternative quantities", "比较方案数量", "Kuantiti alternatif")}: 10 / 20 / 10</p><p>{c("Incoming quantities", "在途数量", "Kuantiti dalam perjalanan")}: 10 / 0 / 5 → RM 110</p></details></section>
      <section className="finance-panel"><h3>{c("Estimates and recorded outcomes", "预估与实际记录", "Anggaran dan hasil direkodkan")}</h3><p>{c("Estimated sales value", "预计销售额", "Anggaran nilai jualan")}: <b>RM 438</b></p><p className="finance-note">15 × RM 12 + 25 × RM 6 + 12 × RM 9<br />{c("52 units over 4 weeks; sales value is not profit.", "四周预计售出 52 件；销售额不是利润。", "52 unit dalam 4 minggu; nilai jualan bukan keuntungan.")}</p><hr /><p>{c("Recorded discard", "已记录报废", "Pelupusan direkodkan")}: Kopi O · 4 {c("units", "件", "unit")} · 2026/09/24</p><p className="finance-note">{c("Other products: no record, not a recorded zero.", "其他商品：暂无记录，不等于已记录零报废。", "Produk lain: tiada rekod, bukan rekod sifar.")}</p></section></div>
      <section className="finance-panel"><h3>{c("Try adjusting one example product", "试着调整一件示例商品", "Cuba laraskan satu produk contoh")}</h3><label className="finance-edit">Sambal · 200 g jar · {c("Planned quantity", "计划订购量", "Kuantiti dirancang")}<input type="text" inputMode="numeric" aria-invalid={!valid} aria-describedby="finance-quantity-help" value={raw} onChange={e => { const v=e.currentTarget.value;setRaw(v);if(/^\d+$/.test(v)&&Number(v)<=999999)setQuantity(Number(v)); }} /></label>
        <p id="finance-quantity-help" className={valid ? "finance-note" : "finance-error"} role={valid ? undefined : "alert"}>{valid ? c("Stock 5 + incoming 10 + planned quantity; 4-week demand upper bound 25. Excess cost = units above 25 × RM 8.", "现有 5 件 + 在途 10 件 + 计划订购量；四周需求上限 25 件。超出部分 × RM 8 为潜在过量成本。", "Stok 5 + dalam perjalanan 10 + kuantiti dirancang; had atas permintaan 4 minggu 25. Kos lebihan = unit melebihi 25 × RM 8.") : c("Enter a whole number from 0 to 999999. Amounts still use the last valid quantity.", "请输入 0–999999 的整数。金额仍使用上一次有效数量。", "Masukkan integer 0–999999. Jumlah masih menggunakan kuantiti sah terakhir.")}</p>
        <p>{c("Combined planned and incoming commitment", "计划与在途成本合计", "Jumlah komitmen dirancang dan dalam perjalanan")}: {money(spending+110)}</p><p className="finance-note">{c("Milo: 12 planned units, purchase cost missing. Excluded from monetary totals; quantity remains visible.", "Milo：计划订购 12 件，缺少购买单价，未计入金额汇总；数量仍然保留。", "Milo: 12 unit dirancang, kos belian tiada. Dikecualikan daripada jumlah wang; kuantiti kekal dipaparkan.")}</p>
      </section><button className="btn btn--ghost" onClick={onClose}>{c("Back to my purchase plan", "返回我的采购计划", "Kembali ke rancangan belian saya")}</button>
    </div>
  </dialog>;
}
