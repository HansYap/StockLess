import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/index.ts';
import { parseIsoDate, activePlanningContext, CP3_CATEGORY_DICTIONARY, FOODKEEPER_PRODUCTS, FOODKEEPER_AGGREGATES, PRICECATCHER_REFERENCES, resolveReferencePrice, planningMass, planningStorageWindow, suggestProductCategory, type ProductPlanningContext, type ReadinessSnapshot } from '../engine.ts';
import './cp3-controls.css';

export function PlanningInputsPanel({ snapshot, productKey, value, onChange }: { snapshot: ReadinessSnapshot; productKey: string; value?: ProductPlanningContext; onChange: (value: ProductPlanningContext) => void }) {
  const language = useLanguage(), c = (en:string,zh:string,ms:string) => language === 'zh' ? zh : language === 'ms' ? ms : en;
  const active = activePlanningContext(snapshot,value);
  const [category,setCategory] = useState(active?.category ?? '');
  const [cost,setCost] = useState(active?.unitCost === undefined ? '' : String(active.unitCost));
  const [weight,setWeight] = useState(active?.kgPerUnit === undefined ? '' : String(active.kgPerUnit));
  const [date,setDate] = useState(active?.restockDate ?? '');
  const [storage,setStorage] = useState<'pantry'|'refrigerate'|'freeze'>(active?.storageSelection?.storage ?? 'refrigerate');
  const [storageCategory,setStorageCategory] = useState(active?.storageSelection?.categoryId?.toString() ?? '');
  const [storageProduct,setStorageProduct] = useState(active?.storageSelection?.productId ?? '');
  const [referenceCode,setReferenceCode] = useState(active?.priceCatcherItemCode ?? '');
  const [error,setError] = useState('');
  useEffect(() => { setCategory(active?.category ?? ''); setCost(active?.unitCost === undefined ? '' : String(active.unitCost)); setWeight(active?.kgPerUnit === undefined ? '' : String(active.kgPerUnit)); setDate(active?.restockDate ?? ''); setStorage(active?.storageSelection?.storage ?? 'refrigerate'); setStorageCategory(active?.storageSelection?.categoryId?.toString() ?? ''); setStorageProduct(active?.storageSelection?.productId ?? ''); setReferenceCode(active?.priceCatcherItemCode ?? ''); },[productKey,active]);
  const name = snapshot.rows.find(r => r.productKey === productKey)?.interpretedValues.productName ?? productKey;
  const suggestion = suggestProductCategory(name);
  const mass = planningMass(snapshot,productKey,active,true), window = planningStorageWindow(snapshot,active);
  const categories = CP3_CATEGORY_DICTIONARY.filter(r=>r.isFood).map(r=>r.category).sort();
  const fk = [...new Map([...FOODKEEPER_AGGREGATES.map(r=>[r.categoryId,{id:r.categoryId,name:r.name}] as const),...FOODKEEPER_PRODUCTS.map(r=>[r.categoryId,{id:r.categoryId,name:r.categoryName}] as const)]).values()];
  const fkProducts = FOODKEEPER_PRODUCTS.filter(r=>r.categoryId === Number(storageCategory) && storage in r.windows);
  const reference = resolveReferencePrice(snapshot,productKey,active);
  const save = () => {
    if (!snapshot.evidenceKey) { setError(c('Refresh readiness first.','请先刷新就绪检查。','Muat semula semakan data dahulu.')); return; }
    const decimal = (raw:string, positive:boolean) => raw === '' || (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) && Number.isFinite(Number(raw)) && (positive ? Number(raw)>0 : Number(raw)>=0));
    if (!decimal(cost,false) || !decimal(weight,true) || (date && (!parseIsoDate(date) || date > snapshot.analysisDate))) {
      setError(c('Enter a non-negative seller cost, a positive kg per unit, and a restock date no later than the analysis date.','请输入非负采购成本、正数的每单位公斤数，以及不晚于分析日期的补货日期。','Masukkan kos penjual bukan negatif, kg seunit positif dan tarikh stok semula sebelum tarikh analisis.')); return;
    }
    onChange({ evidenceKey:snapshot.evidenceKey, category: category || undefined, categoryConfirmed: Boolean(category), isFood: Boolean(category) && category !== 'non_food', unitCost: cost === '' ? undefined : Number(cost), kgPerUnit: weight === '' ? undefined : Number(weight), restockDate: date || undefined,
      storageSelection: storageCategory ? { confirmed:true,storage,categoryId:Number(storageCategory),productId:storageProduct || undefined } : undefined, priceCatcherItemCode:referenceCode || undefined });
    setError('');
  };
  return <details className="cp3-controls"><summary>{c('Confirm category, cost, weight and storage','确认类别、成本、重量和储存方式','Sahkan kategori, kos, berat dan penyimpanan')}</summary>
    {value && !active && <p role="status">{c('Previous inputs belong to different source evidence. Confirm them again.','原输入对应旧数据，请重新确认。','Input lama untuk bukti data berbeza. Sahkan semula.')}</p>}
    <p>{c('M12 combines the supplied keyword dictionary and character model. Every suggestion needs your confirmation.','M12 结合已提供的关键词表与字符模型；每条建议均需人工确认。','M12 menggabungkan kamus kata kunci dan model aksara dibekalkan. Setiap cadangan perlu disahkan.')}</p>
    {suggestion.category ? <button type="button" className="btn btn--ghost" onClick={()=>setCategory(suggestion.category!)}>{c('Use suggested category','采用建议类别','Guna kategori dicadang')}: {suggestion.category}</button> : <p>{c('Choose a category manually; the methods did not produce a safe agreement.','请手动选择类别；两种方法未得出可用的一致建议。','Pilih kategori secara manual; kedua-dua kaedah tiada persetujuan yang selamat.')}</p>}
    <details><summary>{c('Category matching evidence','类别匹配依据','Bukti padanan kategori')}</summary><p>{suggestion.reasonCode} · {suggestion.modelCategory}</p>{suggestion.evidence.keywordHits.map((h,i)=><p key={i}>{h.keyword} → {h.category} · {h.match} · {h.provenance}</p>)}</details>
    <div className="cp3-fields">
      <label>{c('Food category','食品类别','Kategori makanan')}<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">{c('Not confirmed','未确认','Belum disahkan')}</option><option value="non_food">{c('Not food','非食品','Bukan makanan')}</option>{categories.map(v=><option key={v} value={v}>{v.replaceAll('_',' ')}</option>)}</select></label>
      <label>{c('Your purchase cost / sales unit (MYR)','每销售单位采购成本（MYR）','Kos belian anda / unit jualan (MYR)')}<input inputMode="decimal" value={cost} onChange={e=>setCost(e.target.value)} placeholder={c('Keep file cost if blank','留空使用文件成本','Kos fail jika kosong')} /></label>
      <label>{c('Measured kg / sales unit','每销售单位实测公斤数','Kg diukur / unit jualan')}<input inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)} placeholder={c('Keep file / parsed pack weight','留空使用文件或包装重量','Berat fail / bungkusan jika kosong')} /></label>
      <label>{c('Last restock date','最近补货日期','Tarikh stok semula terakhir')}<input type="date" value={date} max={snapshot.analysisDate} onChange={e=>setDate(e.target.value)} /></label>
      <label>{c('Storage method','储存方式','Cara penyimpanan')}<select value={storage} onChange={e=>{setStorage(e.target.value as typeof storage);setStorageProduct('');}}><option value="refrigerate">{c('Refrigerated','冷藏','Peti sejuk')}</option><option value="freeze">{c('Frozen','冷冻','Beku')}</option><option value="pantry">{c('Pantry','常温储藏','Pantri')}</option></select></label>
      <label>{c('Confirm FoodKeeper category','确认 FoodKeeper 类别','Sahkan kategori FoodKeeper')}<select value={storageCategory} onChange={e=>{setStorageCategory(e.target.value);setStorageProduct('');}}><option value="">{c('Decline / unavailable','不使用／不可用','Tolak / tidak tersedia')}</option>{fk.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      <label>{c('Confirm FoodKeeper product and condition','确认 FoodKeeper 产品及状态','Sahkan produk dan keadaan FoodKeeper')}<select value={storageProduct} onChange={e=>setStorageProduct(e.target.value)}><option value="">{c('Category fallback (no pantry estimate)','类别回退（常温不估算）','Anggaran kategori (tiada anggaran pantri)')}</option>{fkProducts.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      <label>{c('Confirm reference retail item (optional)','确认参考零售商品（可选）','Sahkan item runcit rujukan (pilihan)')}<select value={referenceCode} onChange={e=>setReferenceCode(e.target.value)}><option value="">{c('No verified match','无已核实对应','Tiada padanan disahkan')}</option>{PRICECATCHER_REFERENCES.map(r=><option key={r.itemCode} value={r.itemCode}>{r.itemCode} · {r.name} · {r.unit}</option>)}</select></label>
    </div>
    <p>{c('Cost is never inferred from retail price. Cost, weight, stock and sales must use the same unit. Zero cost is valid; blank means no manual override.','成本不从零售价推算。成本、重量、库存和销量须使用相同单位。零成本有效；留空表示不覆盖文件数据。','Kos tidak dianggarkan daripada harga runcit. Kos, berat, stok dan jualan mesti menggunakan unit sama. Kos sifar sah; kosong tiada penggantian manual.')}</p>
    <button type="button" className="btn btn--ghost" onClick={save}>{c('Confirm and save inputs','确认并保存输入','Sahkan dan simpan input')}</button>{error && <p role="alert">{error}</p>}
    <p>{c('Mass per unit','每单位重量','Jisim seunit')}: {mass.state === 'available' ? `${mass.kgPerUnit.toFixed(4)} kg · ${mass.provenance}` : mass.reason}</p>
    <p>{c('Storage window','储存参考时长','Tempoh penyimpanan')}: {window.state === 'estimated' ? `${window.minDays !== undefined ? `${window.minDays}–${window.maxDays} (minimum ${window.days})` : window.days} ${c('days','天','hari')} · ${window.source} · ${window.limitation}` : window.reason}</p>
    <p>{c('Select a matching FoodKeeper product and condition. The minimum of its range is used conservatively. Pantry needs a product pick. Guidance never creates an actual expiry date.','请选择相符的 FoodKeeper 产品及状态，计算保守使用区间下限。常温储存必须选择具体产品；参考时长不会生成实际到期日。','Pilih produk dan keadaan FoodKeeper sepadan. Had minimum julat digunakan secara berhati-hati. Pantri perlu pilihan produk. Panduan tidak mencipta tarikh luput sebenar.')}</p>
    <p>{c('Reference retail price is only used to rank missing-cost requests; it never fills your purchase cost.','参考零售价只用于缺失成本的补录排序，不会填入采购成本。','Harga runcit rujukan hanya menyusun permintaan kos yang tiada; ia tidak mengisi kos belian.')}{reference.state==='available' ? ` MYR ${reference.price.toFixed(2)} / ${c('sales unit','销售单位','unit jualan')} · ${reference.source}` : ''}</p>
  </details>;
}
