import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLanguage } from '../i18n/index.ts';
import { parseIsoDate, FOODKEEPER_PRODUCTS, FOODKEEPER_AGGREGATES, PRICECATCHER_REFERENCES, resolveReferencePrice, planningStorageWindow, suggestProductCategory, type ProductPlanningContext, type ReadinessSnapshot, type StorageMode } from '../engine.ts';
import { categoryLabel, foodCategories, productEstimateDetails, type PlanningDetail } from './product-estimates.ts';
import './cp3-controls.css';

interface Props {
  snapshot: ReadinessSnapshot; productKey: string; value?: ProductPlanningContext;
  onChange: (value: ProductPlanningContext) => void;
  focus?: { field: PlanningDetail; revision: number };
}
export function PlanningInputsPanel({ snapshot, productKey, value, onChange, focus }: Props) {
  const language = useLanguage(), c = (en:string,zh:string,ms:string) => language === 'zh' ? zh : language === 'ms' ? ms : en;
  const details = productEstimateDetails(snapshot, productKey, value), { active, mass, storage: window } = details;
  const [opened,setOpened] = useState(false), [field,setField] = useState<PlanningDetail | null>(null);
  const [category,setCategory] = useState(active?.category ?? '');
  const [cost,setCost] = useState(active?.unitCost === undefined ? '' : String(active.unitCost));
  const [weight,setWeight] = useState(active?.kgPerUnit === undefined ? '' : String(active.kgPerUnit));
  const [price,setPrice] = useState(active?.sellingPrice === undefined ? '' : String(active.sellingPrice));
  const [date,setDate] = useState(active?.restockDate ?? '');
  const [storage,setStorage] = useState<StorageMode | ''>(active?.storageSelection?.storage ?? '');
  const [storageCategory,setStorageCategory] = useState(active?.storageSelection?.categoryId?.toString() ?? '');
  const [storageProduct,setStorageProduct] = useState(active?.storageSelection?.productId ?? '');
  const [referenceCode,setReferenceCode] = useState(active?.priceCatcherItemCode ?? '');
  const [error,setError] = useState(''), [message,setMessage] = useState('');
  const prompt = useRef<HTMLElement>(null);
  const reset = () => {
    setCategory(active?.category ?? ''); setCost(active?.unitCost === undefined ? '' : String(active.unitCost));
    setWeight(active?.kgPerUnit === undefined ? '' : String(active.kgPerUnit)); setPrice(active?.sellingPrice === undefined ? '' : String(active.sellingPrice));
    setDate(active?.restockDate ?? ''); setStorage(active?.storageSelection?.storage ?? '');
    setStorageCategory(active?.storageSelection?.categoryId?.toString() ?? ''); setStorageProduct(active?.storageSelection?.productId ?? ''); setReferenceCode(active?.priceCatcherItemCode ?? ''); setError('');
  };
  useEffect(() => { reset(); setField(null); }, [productKey, active, snapshot.evidenceKey]);
  useEffect(() => { setMessage(''); }, [productKey, snapshot.evidenceKey]);
  useEffect(() => { if (focus) { setOpened(true); setField(focus.field); requestAnimationFrame(() => prompt.current?.querySelector<HTMLElement>('h3')?.focus()); } }, [focus]);
  const name = snapshot.rows.find(row => row.productKey === productKey)?.interpretedValues.productName ?? productKey;
  const suggestion = suggestProductCategory(name), reference = resolveReferencePrice(snapshot, productKey, active);
  const fk = [...new Map([...FOODKEEPER_AGGREGATES.map(row=>[row.categoryId,{id:row.categoryId,name:row.name}] as const),...FOODKEEPER_PRODUCTS.map(row=>[row.categoryId,{id:row.categoryId,name:row.categoryName}] as const)]).values()];
  const fkProducts = FOODKEEPER_PRODUCTS.filter(row => row.categoryId === Number(storageCategory) && storage && storage in row.windows);
  const labels: Record<PlanningDetail,string> = {
    category:c('Food category','食品类别','Kategori makanan'), cost:c('Purchase cost','采购成本','Kos belian'), weight:c('Weight per sales unit','每销售单位重量','Berat setiap unit jualan'),
    storage:c('Storage guidance','储存指导','Panduan penyimpanan'), other:c('Other optional details','其他可选详情','Butiran pilihan lain'),
  };
  const decimal = (raw:string, positive:boolean) => raw.trim() === '' || (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim()) && Number.isFinite(Number(raw)) && (positive ? Number(raw)>0 : Number(raw)>=0));
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot.evidenceKey) { setError(c('Refresh readiness first.','请先刷新就绪检查。','Muat semula semakan data dahulu.')); return; }
    let changes: Partial<ProductPlanningContext> = {};
    if (field === 'category') {
      if (category && category !== 'non_food' && !foodCategories.includes(category)) { setError(c('Choose a supported food category.','请选择支持的食品类别。','Pilih kategori makanan yang disokong.')); return; }
      changes = { category:category || undefined, categoryConfirmed:!!category, isFood:!!category && category !== 'non_food' };
    } else if (field === 'cost' || field === 'weight') {
      const raw = field === 'cost' ? cost : weight;
      if (!decimal(raw,field === 'weight')) { setError(field === 'cost' ? c('Enter your purchase cost as zero or a positive number.','请输入零或正数的采购成本。','Masukkan kos belian sifar atau nombor positif.') : c('Enter a positive measured weight in kg.','请输入正数的实测公斤数。','Masukkan berat diukur positif dalam kg.')); return; }
      changes = field === 'cost' ? { unitCost:cost.trim() === '' ? undefined : Number(cost) } : { kgPerUnit:weight.trim() === '' ? undefined : Number(weight) };
    } else if (field === 'storage') {
      if ((storage || storageCategory || storageProduct) && (!storage || !storageCategory || (storage === 'pantry' && !storageProduct) || (storageProduct && !fkProducts.some(row => row.id === storageProduct)))) {
        setError(c('Choose the storage method and matching guidance. Pantry needs a specific product, or you can skip.','请选择储存方式和相符指导。常温储存需选择具体产品，也可跳过。','Pilih cara penyimpanan dan panduan sepadan. Pantri memerlukan produk tertentu, atau anda boleh langkau.')); return;
      }
      changes = { storageSelection:storage && storageCategory ? { confirmed:true,storage,categoryId:Number(storageCategory),productId:storageProduct || undefined } : undefined };
      if (changes.storageSelection && planningStorageWindow(snapshot,{ ...active, evidenceKey:snapshot.evidenceKey, ...changes }).state !== 'estimated') {
        setError(c('No storage guidance is available for those choices. Choose a matching product condition or skip.','这些选择没有可用的储存指导。请选择相符产品状态或跳过。','Tiada panduan penyimpanan untuk pilihan itu. Pilih keadaan produk sepadan atau langkau.')); return;
      }
    } else if (field === 'other') {
      if (!decimal(price,false) || (date && (!parseIsoDate(date) || date > snapshot.analysisDate))) { setError(c('Enter a non-negative selling price and a restock date no later than the analysis date.','请输入非负售价，以及不晚于分析日期的补货日期。','Masukkan harga jualan bukan negatif dan tarikh stok semula sebelum tarikh analisis.')); return; }
      changes = { sellingPrice:price.trim() === '' ? undefined : Number(price), restockDate:date || undefined, priceCatcherItemCode:referenceCode || undefined };
    } else return;
    onChange({ ...active, evidenceKey:snapshot.evidenceKey, ...changes }); setError(''); setField(null); setMessage(c('Detail saved. Both your plan and impact use it.','详情已保存，计划和影响估算均使用此信息。','Butiran disimpan. Rancangan dan impak anda menggunakannya.'));
  };
  const edit = (detail:PlanningDetail) => { reset(); setMessage(''); setField(detail); requestAnimationFrame(() => prompt.current?.querySelector<HTMLElement>('h3')?.focus()); };
  const skip = () => { reset(); setField(null); setMessage(c('Skipped for now. Saved values stay as they are.','暂时跳过。已保存的值保持不变。','Dilangkau buat masa ini. Nilai disimpan kekal.')); };
  const missing = c('Not available yet','尚不可用','Belum tersedia');
  const status = (detail:PlanningDetail) => detail === 'category' ? details.categoryConfirmed ? details.notFood ? c('Not food','非食品','Bukan makanan') : categoryLabel(active!.category!) : c('Needs confirmation','需要确认','Perlu pengesahan')
    : detail === 'cost' ? details.cost.state === 'estimated' ? `MYR ${details.cost.unitCost.toFixed(2)} · ${active?.unitCost !== undefined ? c('Your cost','您的成本','Kos anda') : c('From your file','来自文件','Daripada fail')}` : missing
    : detail === 'weight' ? details.notFood ? c('Not needed for CO₂e','无需用于 CO₂e','Tidak diperlukan untuk CO₂e') : mass.state === 'available' ? `${mass.kgPerUnit.toFixed(4)} kg · ${active?.kgPerUnit !== undefined ? c('Your weight','您的重量','Berat anda') : mass.approximate ? c('Estimated weight','估算重量','Berat dianggarkan') : c('File or pack size','文件或包装规格','Fail atau saiz pek')}` : missing
    : window.state === 'estimated' ? `${window.days} ${c('days · guidance only','天 · 仅供指导','hari · panduan sahaja')}` : c('Optional · not added','可选 · 尚未添加','Pilihan · belum ditambah');
  return <details className="cp3-controls planning-inputs" open={opened} onToggle={event => setOpened(event.currentTarget.open)}>
    <summary>{c('Improve product estimates','完善商品估算','Perbaiki anggaran produk')}<small>{c('Category, cost, weight and optional storage guidance','类别、成本、重量及可选储存指导','Kategori, kos, berat dan panduan penyimpanan pilihan')}</small></summary>
    {value && !active && <p role="status">{c('Previous inputs belong to different source evidence. Confirm them again.','原输入对应旧数据，请重新确认。','Input lama untuk bukti data berbeza. Sahkan semula.')}</p>}
    <p>{c('Choose one detail to improve. Skip anything you do not know; available values are already used.','选择一项详情来完善。不确定的项目可跳过；已有值已被使用。','Pilih satu butiran untuk diperbaiki. Langkau yang tidak diketahui; nilai tersedia sudah digunakan.')}</p>
    <div className="planning-details" aria-label={c('Product estimate details','商品估算详情','Butiran anggaran produk')}>{(['category','cost','weight','storage'] as const).map(detail => <button type="button" key={detail} className={details.missing.includes(detail) ? 'is-missing' : ''} aria-pressed={field === detail} onClick={() => edit(detail)}><b>{labels[detail]}</b>{' '}<small>{status(detail)}</small>{' '}<span>{details.missing.includes(detail) ? c('Add / confirm','添加／确认','Tambah / sahkan') : c('Review / edit','查看／修改','Semak / edit')} →</span></button>)}</div>
    <button type="button" className="planning-other" onClick={() => edit('other')}>{labels.other} →</button>
    {message && <p className="planning-message" role="status">{message}</p>}
    {field && <section className="planning-prompt" ref={prompt}><h3 tabIndex={-1}>{labels[field]}</h3><form onSubmit={save}>
      {field === 'category' && <><p>{c('Confirm the product type so we can estimate CO₂e. A suggestion is only a starting point.','确认商品类型后即可估算 CO₂e。建议仅供参考。','Sahkan jenis produk untuk anggaran CO₂e. Cadangan hanyalah permulaan.')}</p>{suggestion.category && <button type="button" className="btn btn--ghost" onClick={() => setCategory(suggestion.category!)}>{c('Use suggested category','采用建议类别','Guna kategori dicadang')}: {categoryLabel(suggestion.category)}</button>}<label>{labels.category}<select value={category} onChange={event=>setCategory(event.target.value)}><option value="">{c('Not confirmed','未确认','Belum disahkan')}</option><option value="non_food">{c('Not food','非食品','Bukan makanan')}</option>{foodCategories.map(item=><option key={item} value={item}>{categoryLabel(item)}</option>)}</select></label></>}
      {field === 'cost' && <><p>{c('Enter what you pay for one sales unit. This makes the money estimates more complete.','输入每销售单位的进货成本，以完善金额估算。','Masukkan kos yang anda bayar untuk satu unit jualan. Ini melengkapkan anggaran wang.')}</p><label>{c('Your purchase cost / sales unit (MYR)','每销售单位采购成本（MYR）','Kos belian anda / unit jualan (MYR)')}<input inputMode="decimal" value={cost} onChange={event=>setCost(event.target.value)} placeholder={c('Keep file cost if blank','留空使用文件成本','Kos fail jika kosong')} /></label><p>{c('Zero cost is valid. Blank removes only your override; a validated file cost is kept. Retail prices never fill this field.','零成本有效。留空仅清除手动覆盖，保留有效文件成本。零售价不会填入此字段。','Kos sifar sah. Kosong membuang penggantian anda sahaja; kos fail yang disahkan kekal. Harga runcit tidak mengisi medan ini.')}</p></>}
      {field === 'weight' && <><p>{c('Use the food weight in kilograms for one sales unit, such as one 500 g pack = 0.5 kg.','填写每销售单位的食品重量（公斤），例如一包 500 克 = 0.5 公斤。','Gunakan berat makanan dalam kilogram untuk satu unit jualan, contohnya satu pek 500 g = 0.5 kg.')}</p><label>{c('Measured kg / sales unit','每销售单位实测公斤数','Kg diukur / unit jualan')}<input inputMode="decimal" value={weight} onChange={event=>setWeight(event.target.value)} placeholder={c('Keep file / parsed pack weight','留空使用文件或包装重量','Berat fail / bungkusan jika kosong')} /></label><p>{c('Leave blank to use existing file or pack information.','留空则使用已有文件或包装信息。','Biarkan kosong untuk maklumat fail atau pek sedia ada.')}</p></>}
      {field === 'storage' && <><p>{c('Optional guidance can limit a suggested order. Choose the actual storage method and matching product condition.','可选指导可限制建议订单量。请选择实际储存方式及相符产品状态。','Panduan pilihan boleh mengehadkan pesanan dicadangkan. Pilih cara penyimpanan sebenar dan keadaan produk sepadan.')}</p><label>{c('Storage method','储存方式','Cara penyimpanan')}<select value={storage} onChange={event=>{setStorage(event.target.value as StorageMode | '');setStorageProduct('');if(!event.target.value)setStorageCategory('');}}><option value="">{c('Choose or skip','选择或跳过','Pilih atau langkau')}</option><option value="refrigerate">{c('Refrigerated','冷藏','Peti sejuk')}</option><option value="freeze">{c('Frozen','冷冻','Beku')}</option><option value="pantry">{c('Pantry','常温储藏','Pantri')}</option></select></label>{storage && <><label>{c('Confirm FoodKeeper category','确认 FoodKeeper 类别','Sahkan kategori FoodKeeper')}<select value={storageCategory} onChange={event=>{setStorageCategory(event.target.value);setStorageProduct('');}}><option value="">{c('Not selected','未选择','Belum dipilih')}</option>{fk.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{storageCategory && <label>{c('Confirm FoodKeeper product and condition','确认 FoodKeeper 产品及状态','Sahkan produk dan keadaan FoodKeeper')}<select value={storageProduct} onChange={event=>setStorageProduct(event.target.value)}><option value="">{c('Category guidance (specific product required for pantry)','类别指导（常温需具体产品）','Panduan kategori (produk tertentu diperlukan untuk pantri)')}</option>{fkProducts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}</>}<p>{c('US FoodKeeper guidance is an estimate, not an actual expiry date. Skip it, or clear the storage method and save to remove it.','美国 FoodKeeper 指导仅为估算，并非实际到期日。可跳过，或清空储存方式并保存以移除。','Panduan FoodKeeper AS ialah anggaran, bukan tarikh luput sebenar. Langkau, atau kosongkan cara penyimpanan dan simpan untuk membuangnya.')}</p></>}
      {field === 'other' && <><div className="cp3-fields"><label>{c('Your selling price / sales unit (MYR)','每销售单位售价（MYR）','Harga jualan anda / unit jualan (MYR)')}<input inputMode="decimal" value={price} onChange={event=>setPrice(event.target.value)} /></label><label>{c('Last restock date','最近补货日期','Tarikh stok semula terakhir')}<input type="date" value={date} max={snapshot.analysisDate} onChange={event=>setDate(event.target.value)} /></label><label>{c('Confirm reference retail item (optional)','确认参考零售商品（可选）','Sahkan item runcit rujukan (pilihan)')}<select value={referenceCode} onChange={event=>setReferenceCode(event.target.value)}><option value="">{c('No verified match','无已核实对应','Tiada padanan disahkan')}</option>{PRICECATCHER_REFERENCES.map(item=><option key={item.itemCode} value={item.itemCode}>{item.itemCode} · {item.name} · {item.unit}</option>)}</select></label></div><p>{c('Selling price is for estimated sales value. A matched reference retail item only helps rank missing-cost requests; it never becomes your purchase cost.','售价用于估算销售额。已匹配的参考零售商品仅用于成本补录排序，不会成为采购成本。','Harga jualan untuk anggaran nilai jualan. Item runcit rujukan dipadankan hanya menyusun permintaan kos tiada; ia tidak menjadi kos belian anda.')}</p></>}
      {error && <p role="alert">{error}</p>}<div className="cp3-actions"><button type="submit" className="btn btn--primary">{c('Save this detail','保存此详情','Simpan butiran ini')}</button><button type="button" className="btn btn--ghost" onClick={skip}>{c('Skip for now','暂时跳过','Langkau buat masa ini')}</button></div>
    </form></section>}
    <details className="planning-sources"><summary>{c('Where these values come from','这些值的来源','Sumber nilai ini')}</summary><p>{c('Cost, weight, stock and sales must refer to the same sales unit.','成本、重量、库存和销量须使用相同销售单位。','Kos, berat, stok dan jualan mesti merujuk unit jualan yang sama.')}</p><details><summary>{c('Category matching evidence','类别匹配依据','Bukti padanan kategori')}</summary><p>{suggestion.reasonCode ?? 'suggested'} · {suggestion.modelCategory}</p>{suggestion.evidence.keywordHits.map((hit,index)=><p key={index}>{hit.keyword} → {categoryLabel(hit.category)} · {hit.match} · {hit.provenance}</p>)}</details><p>{c('Mass per unit','每单位重量','Jisim seunit')}: {mass.state === 'available' ? `${mass.kgPerUnit.toFixed(4)} kg · ${mass.provenance}` : mass.reason}</p><p>{c('Storage window','储存参考时长','Tempoh penyimpanan')}: {window.state === 'estimated' ? `${window.minDays !== undefined ? `${window.minDays}–${window.maxDays} (minimum ${window.days})` : window.days} ${c('days','天','hari')} · ${window.source} · ${window.limitation}` : window.reason}</p>{reference.state === 'available' && <p>MYR {reference.price.toFixed(2)} · {reference.source}</p>}</details>
  </details>;
}
