import type { ReactNode } from "react";
import { useLanguage } from "../i18n/index.ts";
import { demandRangeText } from "./PurchaseDemandChart.tsx";
import { numberText } from "./SourceTag.tsx";
import "./purchase-check.css";

interface Props {
  stock: number; atRisk: number; incoming: number; order: number; low: number; high: number;
  target: number; suggested: number; expiryUsed: boolean; stockDate?: string; incomingEntered: boolean; orderEntered: boolean;
  adjustment?: { before: number; after?: number };
}

/** A short, tooltip-led explanation of the purchase check: one sentence, one bar, the working on request. */
export function PurchaseCheckCard({ stock, atRisk, incoming, order, low, high, target, suggested, expiryUsed, stockDate, incomingEntered, orderEntered, adjustment }: Props) {
  const language = useLanguage(), pick = <T,>(en: T, zh: T, ms: T): T => language === "zh" ? zh : language === "ms" ? ms : en, c = (en: string, zh: string, ms: string) => pick(en, zh, ms);
  const usable = Math.max(0, stock - atRisk), after = usable + incoming + order;
  const state = after > high ? "high" : after < low ? "low" : "ok";
  const maximum = Math.max(1, after, high) * 1.12, at = (value: number) => `${Math.min(100, value / maximum * 100)}%`;
  const range = demandRangeText(low, high);
  const units = c("units", "件", "unit");
  const tip = (text: string) => <span className="pp-tip" role="tooltip">{text}</span>;
  const info = (label: string, text: string) => <button type="button" className="pp-tip-anchor pp-info" aria-label={`${label}: ${text}`}><span aria-hidden="true">i</span>{tip(text)}</button>;
  const sentence: ReactNode = state === "high"
    ? pick<ReactNode>(<>After your order you’ll have <b>{numberText(after)} {units}</b> — <b className="pp-check-delta">{numberText(after - high)} more</b> than you’re likely to sell ({range}).</>, <>下单后您将有 <b>{numberText(after)} 件</b>——比可能售出的数量（{range}）<b className="pp-check-delta">多 {numberText(after - high)} 件</b>。</>, <>Selepas pesanan anda akan ada <b>{numberText(after)} unit</b> — <b className="pp-check-delta">{numberText(after - high)} lebih</b> daripada jangkaan jualan ({range}).</>)
    : state === "low"
      ? pick<ReactNode>(<>After your order you’ll have <b>{numberText(after)} {units}</b> — <b className="pp-check-delta">{numberText(low - after)} short</b> of the least you’re likely to sell ({range}).</>, <>下单后您将有 <b>{numberText(after)} 件</b>——比最少可能售出的数量（{range}）<b className="pp-check-delta">少 {numberText(low - after)} 件</b>。</>, <>Selepas pesanan anda akan ada <b>{numberText(after)} unit</b> — <b className="pp-check-delta">kurang {numberText(low - after)}</b> daripada jualan paling rendah dijangka ({range}).</>)
        : pick<ReactNode>(<>After your order you’ll have <b>{numberText(after)} {units}</b> — inside what you’re likely to sell ({range}).</>, <>下单后您将有 <b>{numberText(after)} 件</b>——在可能售出的范围内（{range}）。</>, <>Selepas pesanan anda akan ada <b>{numberText(after)} unit</b> — dalam julat jangkaan jualan ({range}).</>);
  const labels = {
    stock: c("In stock", "现有库存", "Stok ada"), incoming: c("Incoming", "在途", "Akan tiba"), order: c("Your order", "您的订单", "Pesanan anda"), likely: c("Likely to sell", "可能售出", "Jangkaan jualan"),
  };
  const tips = {
    stock: atRisk > 0 ? c(`Usable stock after leaving out ${numberText(atRisk)} units at risk of expiry.`, `已扣除 ${numberText(atRisk)} 件有过期风险的库存。`, `Stok boleh guna selepas ${numberText(atRisk)} unit berisiko luput diketepikan.`) : stockDate ? c(`Counted on ${stockDate}, from your file.`, `${stockDate} 盘点，来自您的文件。`, `Dikira pada ${stockDate}, daripada fail anda.`) : c("From your file.", "来自您的文件。", "Daripada fail anda."),
    incoming: incomingEntered ? c("Stock already on the way, entered by you.", "已在途的库存，由您输入。", "Stok dalam perjalanan, dimasukkan oleh anda.") : c("Not entered, so counted as 0.", "未输入，按 0 计算。", "Belum dimasukkan, jadi dikira 0."),
    order: orderEntered ? c("The quantity you plan to order.", "您计划订购的数量。", "Kuantiti yang anda rancang pesan.") : c("No order entered yet, so counted as 0.", "尚未输入订单，按 0 计算。", "Belum ada pesanan, jadi dikira 0."),
    likely: c("Expected sales in the next 4 weeks, from your sales history.", "根据销售记录预计未来 4 周的销量。", "Jangkaan jualan 4 minggu akan datang, daripada sejarah jualan anda."),
  };
  const segment = (key: "stock" | "incoming" | "order", from: number, size: number) => size > 0 && <span className={`pp-check-seg pp-check-seg--${key}`} style={{ left: at(from), width: `calc(${at(from + size)} - ${at(from)})` }}>{tip(`${labels[key]} · ${numberText(size)} ${units}`)}</span>;
  const ticks = [...new Set([0, low, high, after])].filter(value => value === low || value === high || value === 0 || Math.min(Math.abs(value - low), Math.abs(value - high)) / maximum > 0.05);
  const chip = (key: keyof typeof labels, value: string) => <button type="button" className="pp-tip-anchor pp-check-chip" aria-label={`${labels[key]} ${value}: ${tips[key]}`}><i className={`pp-check-swatch pp-check-swatch--${key}`} aria-hidden="true" />{labels[key]} <b className="num">{value}</b>{tip(tips[key])}</button>;
  const row = (label: string, value: number, note?: string, total = false) => <div className={`pp-work-row${total ? " is-total" : ""}`}><span>{label}{note && <small> · {note}</small>}</span><b className="num">{numberText(value)}</b></div>;

  return <section className={`pp-check-card pp-check-card--${state}`} aria-label={c("Why this purchase check?", "为什么是这个采购检查？", "Mengapa semakan pembelian ini?")}>
    <h3>{c("Why this purchase check?", "为什么是这个采购检查？", "Mengapa semakan pembelian ini?")} {info(c("How it works", "计算方式", "Cara ia berfungsi"), c("Usable stock + incoming + your order, compared with how much you’re likely to sell in the next 4 weeks.", "可用库存 + 在途 + 您的订单，与未来 4 周可能售出的数量比较。", "Stok boleh guna + akan tiba + pesanan anda, dibandingkan dengan jangkaan jualan 4 minggu akan datang."))}</h3>
    <p className="pp-check-sentence"><span className="pp-check-icon" aria-hidden="true">{state === "high" ? "↑" : state === "low" ? "↓" : "✓"}</span><span>{sentence}</span></p>
    <div className="pp-check-bar-wrap">
      <div className="pp-check-bar" role="img" aria-label={`${c("Stock after order", "下单后库存", "Stok selepas pesanan")}: ${numberText(after)} ${units}; ${labels.stock}: ${numberText(usable)}; ${labels.incoming}: ${numberText(incoming)}; ${labels.order}: ${numberText(order)}; ${labels.likely}: ${range} ${units}`}>
        {segment("stock", 0, usable)}{segment("incoming", usable, incoming)}{segment("order", usable + incoming, order)}
        <span className="pp-check-zone" style={{ left: at(low), width: `calc(${at(high)} - ${at(low)})` }} aria-hidden="true" />
        <span className="pp-check-end" style={{ left: at(after) }} aria-hidden="true" />
      </div>
      <div className="pp-check-ticks" aria-hidden="true">{ticks.map(value => <span key={value} style={{ left: at(value) }}>{numberText(value)}</span>)}</div>
    </div>
    <div className="pp-check-chips">{chip("stock", numberText(usable))}{chip("incoming", numberText(incoming))}{chip("order", numberText(order))}{chip("likely", range)}</div>
    <details className="pp-check-working-details"><summary>{c("Show the working", "查看计算过程", "Tunjukkan pengiraan")}</summary>
      <div className="pp-work">
        <div className="pp-work-sum">
          {row(c("In stock", "现有库存", "Stok ada"), stock)}
          {row(c("− At risk of expiry", "− 有过期风险", "− Berisiko luput"), atRisk, expiryUsed ? undefined : c("Expiry not checked — map expiry dates in Step 2 to include it", "未检查过期——在第 2 步对应到期日即可计入", "Luput tidak disemak — padankan tarikh luput dalam Langkah 2"))}
          {row(c("+ Incoming", "+ 在途", "+ Akan tiba"), incoming)}
          {row(c("+ Your order", "+ 您的订单", "+ Pesanan anda"), order)}
          {row(c("= Stock after order", "= 下单后库存", "= Stok selepas pesanan"), after, undefined, true)}
        </div>
        <div className="pp-work-notes">
          <p><b>{labels.likely}:</b> {range} {units} {c("in the next 4 weeks", "（未来 4 周）", "dalam 4 minggu akan datang")}</p>
          <p><b>{c("Demand target", "需求目标", "Sasaran permintaan")}:</b> {numberText(target)} {units}<small>{c("The middle of the range. The suggestion is the target minus usable stock and incoming, rounded up.", "范围的中间值。建议量 = 目标 − 可用库存 − 在途，向上取整。", "Tengah julat. Cadangan ialah sasaran tolak stok boleh guna dan akan tiba, dibundarkan ke atas.")}</small></p>
          <p><b>{c("Suggested order", "建议订单", "Pesanan dicadangkan")}:</b> {numberText(suggested)} {units}</p>
          {adjustment && <p><b>{c("Expiry/storage adjustment", "到期／储存调整", "Pelarasan luput/penyimpanan")}:</b> {numberText(adjustment.before)} → {adjustment.after === undefined ? c("unavailable", "不可用", "tidak tersedia") : numberText(adjustment.after)}</p>}
        </div>
      </div>
    </details>
  </section>;
}
