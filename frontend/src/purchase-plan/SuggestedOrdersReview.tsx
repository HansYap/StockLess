import { useEffect, useRef, useState } from "react";
import { t, useLanguage } from "../i18n/index.ts";
import { numberText } from "./SourceTag.tsx";
import type { PurchaseDrafts } from "./model.ts";
import type { SuggestedOrderReview } from "./suggested-orders.ts";

interface Props {
  review: SuggestedOrderReview; stale: boolean;
  onRefresh: () => void; onClose: () => void; onReviewProduct: (key: string) => void;
  onApply: (updates: PurchaseDrafts) => void;
}

export function SuggestedOrdersReview({ review, stale, onRefresh, onClose, onReviewProduct, onApply }: Props) {
  const language = useLanguage(), copy = (en: string, zh: string, ms: string) => language === "zh" ? zh : language === "ms" ? ms : en;
  const dialog = useRef<HTMLDialogElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState(() => new Set(review.suggestions.filter(row => row.selectedByDefault).map(row => row.product.key)));
  useEffect(() => {
    const overflow = document.body.style.overflow;
    dialog.current?.showModal(); closeButton.current?.focus(); document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, []);
  useEffect(() => { setSelected(new Set(review.suggestions.filter(row => row.selectedByDefault).map(row => row.product.key))); }, [review]);
  const apply = () => {
    if (stale) return;
    const updates = Object.fromEntries(review.suggestions.filter(row => selected.has(row.product.key)).map(row => [row.product.key, row.inputs]));
    if (Object.keys(updates).length) onApply(updates);
  };
  return <dialog ref={dialog} className="pp-suggestions-dialog" aria-labelledby="suggested-orders-title" aria-describedby="suggested-orders-description" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="pp-suggestions-head"><div><p className="pp-kicker">{copy("A quicker starting point", "更快开始规划", "Permulaan lebih pantas")}</p><h2 id="suggested-orders-title">{copy("Review suggested orders", "查看建议订单", "Semak cadangan pesanan")}</h2></div><button ref={closeButton} type="button" className="btn btn--ghost btn--small" onClick={onClose}>{t("Close")}</button></header>
    <div className="pp-suggestions-body">
      <p id="suggested-orders-description">{copy("This review covers all products, including those hidden by filters. Orders you already entered, including zero, stay as they are.", "本次查看涵盖所有商品，包括被筛选隐藏的商品。已填写的订单（包括零）保持不变。", "Semakan ini meliputi semua produk, termasuk yang disembunyikan oleh penapis. Pesanan yang sudah dimasukkan, termasuk sifar, kekal.")}</p>
      <p className="pp-small-note">{copy("Saved case sizes and minimum orders are included. These are estimates for your draft plan; you can adjust them afterwards.", "已保存的箱装数量和最低订购量已计入。这些估算用于草稿计划，之后仍可调整。", "Saiz karton dan pesanan minimum yang disimpan telah diambil kira. Ini anggaran untuk draf rancangan; anda boleh melaraskannya kemudian.")}</p>
      {stale && <p className="notice notice--error" role="alert">{copy("Your plan or product data changed. Refresh the review before applying suggestions.", "计划或商品数据已更改。请刷新后再采用建议。", "Rancangan atau data produk berubah. Muat semula semakan sebelum menggunakan cadangan.")} <button type="button" className="pp-link-button" onClick={onRefresh}>{copy("Refresh review", "刷新查看", "Muat semula semakan")}</button></p>}
      {review.suggestions.length > 0 ? <><p className="pp-small-note">{copy("Suggestions needing a closer check start unselected. Tick one only after reviewing its message.", "需要仔细检查的建议默认不选中。查看提示后再勾选。", "Cadangan yang memerlukan semakan lanjut bermula tanpa tanda. Tandakannya selepas membaca mesej.")}</p>
        <ul className="pp-suggestions-list" aria-label={copy("Suggested orders", "建议订单", "Cadangan pesanan")}>{review.suggestions.map(row => <li key={row.product.key} className={!row.selectedByDefault ? "pp-suggestion-caution" : undefined}>
          <label className="pp-suggestion-choice"><input type="checkbox" disabled={stale} checked={selected.has(row.product.key)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(row.product.key); else next.delete(row.product.key); return next; })} aria-label={copy(`Use suggestion for ${row.product.title}, SKU ${row.product.sku ?? row.product.key}`, `采用 ${row.product.title} 的建议，SKU ${row.product.sku ?? row.product.key}`, `Guna cadangan untuk ${row.product.title}, SKU ${row.product.sku ?? row.product.key}`)} /><span><b>{row.product.title}</b><small>{row.product.sku ?? row.product.key}{row.product.pack ? ` · ${row.product.pack}` : ""}</small></span><strong className="num">{numberText(row.quantity)} <small>{t("units")}</small></strong></label>
          <div className="pp-suggestion-notes">{row.quantity === 0 && <p>{copy("No additional order suggested.", "无需额外订购。", "Tiada pesanan tambahan dicadangkan.")}</p>}
            {row.quantity !== row.originalQuantity && <p>{copy(`Adjusted from ${numberText(row.originalQuantity)} units for your supplier terms.`, `根据供应商条件，由 ${numberText(row.originalQuantity)} 件调整。`, `Dilaraskan daripada ${numberText(row.originalQuantity)} unit mengikut syarat pembekal.`)}</p>}
            {(row.terms.caseSize !== undefined || row.terms.minimumOrder !== undefined || row.terms.leadTimeDays !== undefined) && <p>{[row.terms.caseSize !== undefined ? `${t("Case size")}: ${numberText(row.terms.caseSize)}` : "", row.terms.minimumOrder !== undefined ? `${t("Minimum order")}: ${numberText(row.terms.minimumOrder)}` : "", row.terms.leadTimeDays !== undefined ? `${t("Lead time (days)")}: ${row.terms.leadTimeDays}` : ""].filter(Boolean).join(" · ")}</p>}
            {row.plan.audit.state === "verdict" && row.plan.audit.verdict !== "Looks balanced" && <p className="pp-suggestion-warning">{t(row.plan.audit.reasonSentence)}</p>}
            {row.plan.estimatedRestock.state === "available" && row.plan.estimatedRestock.shelfLifeCap !== undefined && <p>{copy(`Storage guidance limits the suggestion to ${numberText(row.plan.estimatedRestock.shelfLifeCap)} units.`, `储存指导将建议量限制在 ${numberText(row.plan.estimatedRestock.shelfLifeCap)} 件。`, `Panduan penyimpanan mengehadkan cadangan kepada ${numberText(row.plan.estimatedRestock.shelfLifeCap)} unit.`)}</p>}
            {row.plan.audit.state === "verdict" && row.plan.audit.gettingOld && <p>{t("The stock count is getting old. A fresher count would be better.")}</p>}
          </div>
        </li>)}</ul>
        <p className="pp-small-note">{copy("Checks use stock, incoming quantities and expected demand, plus confirmed expiry or storage guidance where available. Missing expiry information is not a guarantee against waste.", "检查基于库存、在途数量和预计需求，并计入已确认的到期或储存指导。缺少到期信息不代表不会产生损耗。", "Semakan menggunakan stok, kuantiti akan tiba dan permintaan dijangka, serta luput atau panduan penyimpanan yang disahkan jika ada. Maklumat luput yang tiada tidak menjamin tiada pembaziran.")}</p>
      </> : <p className="pp-suggestions-empty">{copy("No blank orders have a usable suggestion right now.", "目前没有可用建议的空白订单。", "Tiada pesanan kosong dengan cadangan yang boleh digunakan sekarang.")}</p>}
      {review.preserved.length > 0 && <details className="pp-suggestions-other"><summary>{copy(`${review.preserved.length} entered ${review.preserved.length === 1 ? "order" : "orders"} kept`, `保留 ${review.preserved.length} 个已填写订单`, `${review.preserved.length} pesanan dimasukkan dikekalkan`)}</summary><ul>{review.preserved.map(product => <li key={product.key}>{product.title} · {product.sku ?? product.key}</li>)}</ul></details>}
      {review.skipped.length > 0 && <details className="pp-suggestions-other"><summary>{copy(`${review.skipped.length} ${review.skipped.length === 1 ? "product needs" : "products need"} individual review`, `${review.skipped.length} 件商品需单独查看`, `${review.skipped.length} produk perlu semakan individu`)}</summary><ul>{review.skipped.map(row => <li key={row.product.key}><b>{row.product.title} · {row.product.sku ?? row.product.key}</b><p>{t(row.reason)}</p><button type="button" className="pp-link-button" onClick={() => onReviewProduct(row.product.key)}>{copy("Review product", "查看商品", "Semak produk")}</button></li>)}</ul></details>}
    </div>
    <footer className="pp-suggestions-footer"><p>{copy("Updates your draft quantities. Nothing is sent to a supplier or recorded as a purchase decision.", "仅更新草稿数量，不会发送给供应商，也不会记录为采购决定。", "Mengemas kini kuantiti draf. Tiada apa dihantar kepada pembekal atau direkodkan sebagai keputusan belian.")}</p><div><button type="button" className="btn btn--ghost" onClick={onClose}>{copy("Cancel", "取消", "Batal")}</button><button type="button" className="btn btn--primary" disabled={stale || selected.size === 0} onClick={apply}>{copy(`Use ${selected.size} ${selected.size === 1 ? "suggestion" : "suggestions"}`, `采用 ${selected.size} 项建议`, `Guna ${selected.size} cadangan`)}</button></div></footer>
  </dialog>;
}
