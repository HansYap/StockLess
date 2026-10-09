import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../i18n/index.ts";
import type { PlanningContexts, ReadinessSnapshot } from "../engine.ts";
import type { PurchaseProduct } from "../purchase-plan/model.ts";
import { categoryLabel, suggestedCategoryRows } from "./product-estimates.ts";
import "./cp3-controls.css";

const EMPTY_CONTEXTS: PlanningContexts = Object.freeze({});
interface Props { snapshot: ReadinessSnapshot; products: readonly PurchaseProduct[]; contexts?: PlanningContexts; onChange: (updates: PlanningContexts) => void }
export function CategoryConfirmation({ snapshot, products, contexts = EMPTY_CONTEXTS, onChange }: Props) {
  const language = useLanguage(), c = (en:string,zh:string,ms:string) => language === 'zh' ? zh : language === 'ms' ? ms : en;
  const rows = useMemo(() => suggestedCategoryRows(snapshot, products, contexts), [snapshot, products, contexts]);
  const [review,setReview] = useState<{ rows: typeof rows; snapshot: typeof snapshot; products: typeof products; contexts: typeof contexts } | null>(null);
  const [message,setMessage] = useState(''), trigger = useRef<HTMLButtonElement>(null);
  const prepare = () => { setMessage(''); setReview({ rows, snapshot, products, contexts }); };
  const stale = !!review && (review.snapshot !== snapshot || review.products !== products || review.contexts !== contexts);
  const close = () => { setReview(null); requestAnimationFrame(() => trigger.current?.focus()); };
  useEffect(() => { setMessage(''); }, [snapshot.evidenceKey]);
  if (!rows.length && !review && !message) return null;
  return <div className="category-confirmation"><button ref={trigger} type="button" className="btn btn--ghost" disabled={!rows.length} onClick={prepare}>{c('Review suggested categories','查看建议类别','Semak kategori dicadangkan')} ({rows.length})</button>
    {message && <p role="status">{message}</p>}
    {review && <CategoryReview rows={review.rows} stale={stale} onRefresh={prepare} onClose={close} onApply={updates => {
      if (stale) return;
      onChange(updates); close(); const count = Object.keys(updates).length;
      setMessage(c(`${count} product ${count === 1 ? 'category' : 'categories'} confirmed. Other details stay as they are.`, `已确认 ${count} 件商品的类别。其他详情保持不变。`, `Kategori ${count} produk disahkan. Butiran lain kekal.`));
    }} />}
  </div>;
}
function CategoryReview({ rows, stale, onRefresh, onClose, onApply }: { rows: ReturnType<typeof suggestedCategoryRows>; stale: boolean; onRefresh: () => void; onClose: () => void; onApply: (updates: PlanningContexts) => void }) {
  const language = useLanguage(), c = (en:string,zh:string,ms:string) => language === 'zh' ? zh : language === 'ms' ? ms : en;
  const dialog = useRef<HTMLDialogElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  const [selected,setSelected] = useState(() => new Set(rows.map(row => row.product.key)));
  useEffect(() => { const overflow = document.body.style.overflow; dialog.current?.showModal(); closeButton.current?.focus(); document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = overflow; }; }, []);
  useEffect(() => { setSelected(new Set(rows.map(row => row.product.key))); }, [rows]);
  return <dialog ref={dialog} className="category-review" aria-labelledby="category-review-title" aria-describedby="category-review-description" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><h2 id="category-review-title">{c('Confirm suggested categories','确认建议类别','Sahkan kategori dicadangkan')}</h2><button ref={closeButton} type="button" className="btn btn--ghost" onClick={onClose}>{c('Close','关闭','Tutup')}</button></header>
    <div className="category-review-body"><p id="category-review-description">{c('Review the product types below. Untick any you are unsure about. This covers all products with a usable suggestion, including products hidden by filters.','请查看下列商品类型，不确定的项目可取消勾选。本次涵盖所有有可用建议的商品，包括被筛选隐藏的商品。','Semak jenis produk di bawah. Buang tanda jika tidak pasti. Ini meliputi semua produk dengan cadangan tersedia, termasuk produk disembunyikan penapis.')}</p><p>{c('Confirmed categories stay as they are. Costs, weights and storage choices are kept. Products without an agreed suggestion can be reviewed individually.','已确认类别保持不变。成本、重量和储存选择均保留。没有一致建议的商品可单独查看。','Kategori disahkan kekal. Kos, berat dan pilihan penyimpanan dikekalkan. Produk tanpa cadangan dipersetujui boleh disemak secara individu.')}</p>
      {stale && <p role="alert">{c('Product data changed. Refresh this review before confirming.','商品数据已改变。确认前请刷新。','Data produk berubah. Muat semula semakan sebelum mengesahkan.')} <button type="button" className="btn btn--ghost" onClick={onRefresh}>{c('Refresh review','刷新查看','Muat semula semakan')}</button></p>}
      <ul>{rows.map(row => <li key={row.product.key}><label><input type="checkbox" disabled={stale} checked={selected.has(row.product.key)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(row.product.key); else next.delete(row.product.key); return next; })} aria-label={c(`Confirm category for ${row.product.title}, SKU ${row.product.sku ?? row.product.key}`, `确认 ${row.product.title} 的类别，SKU ${row.product.sku ?? row.product.key}`, `Sahkan kategori untuk ${row.product.title}, SKU ${row.product.sku ?? row.product.key}`)} /><span><b>{row.product.title}</b><small>{row.product.sku ?? row.product.key}{row.product.pack ? ` · ${row.product.pack}` : ''}</small></span><strong>{categoryLabel(row.category)}</strong></label></li>)}</ul>
    </div><footer><button type="button" className="btn btn--ghost" onClick={onClose}>{c('Skip for now','暂时跳过','Langkau buat masa ini')}</button><button type="button" className="btn btn--primary" disabled={stale || !selected.size} onClick={() => { if (!stale && selected.size) onApply(Object.fromEntries(rows.filter(row => selected.has(row.product.key)).map(row => [row.product.key,row.context]))); }}>{c(`Confirm ${selected.size} ${selected.size === 1 ? 'category' : 'categories'}`, `确认 ${selected.size} 项类别`, `Sahkan ${selected.size} kategori`)}</button></footer>
  </dialog>;
}
