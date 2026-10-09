import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLanguage } from '../i18n/index.ts';
import { automaticStorageAdvice, planningStorageWindow, resolveReferencePrice, type ProductPlanningContext, type ReadinessSnapshot } from '../engine.ts';
import { categoryLabel, foodCategories, productEstimateDetails, type PlanningDetail } from './product-estimates.ts';
import './cp3-controls.css';
interface Props { snapshot: ReadinessSnapshot; productKey: string; value?: ProductPlanningContext; onChange: (value: ProductPlanningContext) => void; focus?: { field: PlanningDetail; revision: number } }
/** Optional corrections to shared automatic results, never a completion checklist. */
export function PlanningInputsPanel({ snapshot, productKey, value, onChange, focus }: Props) {
  const language = useLanguage(), c = (en:string,zh:string,ms:string) => language === 'zh' ? zh : language === 'ms' ? ms : en;
  const { active, mass, cost, notFood } = productEstimateDetails(snapshot, productKey, value);
  const [opened,setOpened] = useState(false), [field,setField] = useState<PlanningDetail | null>(null);
  const [raw,setRaw] = useState(''), [error,setError] = useState(''), [message,setMessage] = useState('');
  const prompt = useRef<HTMLElement>(null);
  const initial = (detail:PlanningDetail) => detail === 'category' ? active?.category ?? '' : detail === 'cost' ? active?.unitCost?.toString() ?? '' : active?.kgPerUnit?.toString() ?? '';
  const edit = (detail:PlanningDetail) => { setRaw(initial(detail)); setField(detail); setError(''); setMessage(''); requestAnimationFrame(() => prompt.current?.querySelector<HTMLElement>('h3')?.focus()); };
  useEffect(() => { setField(null); setError(''); setMessage(''); }, [productKey,snapshot.evidenceKey]);
  useEffect(() => { if (focus && ['category','cost','weight'].includes(focus.field)) { setOpened(true); edit(focus.field); } }, [focus]);
  const reference = resolveReferencePrice(snapshot,productKey,active);
  const advice = automaticStorageAdvice(snapshot,productKey,active), storage = planningStorageWindow(snapshot,active);
  const labels = { category:c('Food category','食品类别','Kategori makanan'), cost:c('Purchase cost','采购成本','Kos belian'), weight:c('Weight per sales unit','每销售单位重量','Berat setiap unit jualan') };
  const status = (detail:keyof typeof labels) => detail === 'category' ? active?.category ? `${categoryLabel(active.category)} · ${active.categorySource === 'ai' ? c('AI estimate','AI 估算','Anggaran AI') : c('Your choice','您的选择','Pilihan anda')}` : c('Not included in CO₂e','未计入 CO₂e','Tidak dikira dalam CO₂e')
    : detail === 'cost' ? cost.state === 'estimated' ? `MYR ${cost.unitCost.toFixed(2)} · ${active?.unitCost !== undefined ? c('Your cost','您的成本','Kos anda') : c('From your file','来自文件','Daripada fail')}` : c('Money estimate unavailable','金额估算不可用','Anggaran wang tidak tersedia')
    : notFood ? c('Not needed for CO₂e','无需用于 CO₂e','Tidak diperlukan untuk CO₂e') : mass.state === 'available' ? `${mass.kgPerUnit.toFixed(4)} kg · ${active?.kgPerUnit !== undefined ? c('Your weight','您的重量','Berat anda') : c('Resolved automatically','自动识别','Diselesaikan automatik')}` : c('Not included in CO₂e','未计入 CO₂e','Tidak dikira dalam CO₂e');
  const save = (event:FormEvent) => {
    event.preventDefault(); if (!snapshot.evidenceKey) return;
    let changes:Partial<ProductPlanningContext>;
    if (field === 'category') {
      if (raw && raw !== 'non_food' && !foodCategories.includes(raw)) return;
      changes = { category:raw || undefined, categoryConfirmed:!!raw, categorySource:raw ? 'manual' : undefined, categoryProvenance:undefined, isFood:raw !== 'non_food' };
    } else {
      if (raw.trim() && (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim()) || !Number.isFinite(Number(raw)) || Number(raw) < 0 || field === 'weight' && Number(raw) === 0)) {
        setError(c('Enter a valid amount. Cost can be zero; weight must be positive.','请输入有效数值。成本可以为零；重量须大于零。','Masukkan amaun sah. Kos boleh sifar; berat mesti positif.')); return;
      }
      changes = field === 'cost' ? { unitCost:raw.trim() ? Number(raw) : undefined } : { kgPerUnit:raw.trim() ? Number(raw) : undefined };
    }
    onChange({ ...active, evidenceKey:snapshot.evidenceKey, ...changes }); setField(null); setError('');
    setMessage(c('Detail saved. Both your plan and impact use it.','详情已保存，计划和影响估算均使用此信息。','Butiran disimpan. Rancangan dan impak anda menggunakannya.'));
  };
  return <details className="cp3-controls planning-inputs" open={opened} onToggle={event=>setOpened(event.currentTarget.open)}>
    <summary>{c('Improve product estimates','完善商品估算','Perbaiki anggaran produk')}<small>{c('Optional corrections · available information is already used','可选修正 · 已有信息已自动使用','Pembetulan pilihan · maklumat tersedia sudah digunakan')}</small></summary>
    <p>{c('StockLess uses your file, supported AI matches and pack sizes automatically. Change a detail only if you know a better value.','StockLess 自动使用文件、支持的 AI 匹配和包装规格。有更准确的值时才需修改。','StockLess menggunakan fail, padanan AI disokong dan saiz pek secara automatik. Ubah hanya jika anda tahu nilai lebih tepat.')}</p>
    <div className="planning-details" aria-label={c('Product estimate details','商品估算详情','Butiran anggaran produk')}>{(['cost','category','weight'] as const).map(detail=><button type="button" key={detail} aria-pressed={field === detail} onClick={()=>edit(detail)}><b>{labels[detail]}</b>{' '}<small>{status(detail)}</small>{' '}<span>{c('Review / edit','查看／修改','Semak / edit')} →</span></button>)}</div>
    {message && <p className="planning-message" role="status">{message}</p>}
    {field && field in labels && <section className="planning-prompt" ref={prompt}><h3 tabIndex={-1}>{labels[field as keyof typeof labels]}</h3><form onSubmit={save}>
      {field === 'category' ? <label>{labels.category}<select value={raw} onChange={event=>setRaw(event.target.value)}><option value="">{c('Use automatic match','使用自动匹配','Guna padanan automatik')}</option><option value="non_food">{c('Not food','非食品','Bukan makanan')}</option>{foodCategories.map(category=><option key={category} value={category}>{categoryLabel(category)}</option>)}</select></label>
        : <><label>{field === 'cost' ? c('Your purchase cost / sales unit (MYR)','每销售单位采购成本（MYR）','Kos belian anda / unit jualan (MYR)') : c('Measured kg / sales unit','每销售单位实测公斤数','Kg diukur / unit jualan')}<input inputMode="decimal" value={raw} onChange={event=>setRaw(event.target.value)} /></label><p>{c('Leave blank to use the available file or pack information.','留空使用已有文件或包装信息。','Biarkan kosong untuk menggunakan maklumat fail atau pek tersedia.')}</p></>}
      {error && <p role="alert">{error}</p>}<div className="cp3-actions"><button type="submit" className="btn btn--primary">{c('Save this detail','保存此详情','Simpan butiran ini')}</button><button type="button" className="btn btn--ghost" onClick={()=>{setField(null);setError('');}}>{c('Skip for now','暂时跳过','Langkau buat masa ini')}</button></div>
    </form></section>}
    {(advice || storage.state === 'estimated') && <section className="planning-storage"><h3>{c('Storage reference','储存参考','Rujukan penyimpanan')}</h3>
      {storage.state === 'estimated' ? <p>{c('Saved storage limit applied','已应用保存的储存限制','Had penyimpanan disimpan digunakan')}: {storage.days} {c('days','天','hari')}</p> : <><p>{advice!.categoryName}</p><ul>{advice!.windows.map(window=><li key={window.storage}>{window.storage === 'refrigerate' ? c('Refrigerated','冷藏','Peti sejuk') : c('Frozen','冷冻','Beku')}: ≈ {window.days} {c('days','天','hari')}</li>)}</ul><p>{c('General FoodKeeper category guidance. Your product label gives the actual expiry. These references do not limit your order.','FoodKeeper 一般类别参考。实际到期日以商品标签为准；此参考不会限制订单。','Panduan umum kategori FoodKeeper. Label produk memberikan tarikh luput sebenar. Rujukan ini tidak mengehadkan pesanan.')}</p></>}
      {active?.storageSelection && <button type="button" className="btn btn--ghost" onClick={()=>onChange({...active,storageSelection:undefined})}>{c('Remove saved storage limit','移除保存的储存限制','Buang had penyimpanan disimpan')}</button>}
    </section>}
    <details className="planning-sources"><summary>{c('Where these values come from','这些值的来源','Sumber nilai ini')}</summary>
      {active?.categoryProvenance && <p>{active.categoryProvenance}</p>}<p>{mass.state === 'available' ? mass.provenance : c('No supported weight conversion for this product.','此商品没有支持的重量换算。','Tiada penukaran berat disokong bagi produk ini.')}</p>
      {advice && <p>{advice.source} · {advice.mappingSource}</p>}{storage.state === 'estimated' && <p>{storage.source} · {storage.limitation}</p>}
      {reference.state === 'available' && <p>MYR {reference.price.toFixed(2)} · {reference.source}</p>}
    </details>
  </details>;
}
