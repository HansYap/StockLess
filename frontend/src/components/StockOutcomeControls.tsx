import { useCallback, useEffect, useState } from 'react';
import { OutcomeValidationError, type ReadinessSnapshot, type RecordedStockOutcome, type StockOutcomeKind, type OutcomeUnit } from '../engine.ts';
import { useLanguage } from '../i18n/index.ts';
import { getSavedDataset, savedStockOutcomes, saveStockOutcome, updateSavedStockOutcome, removeSavedOutcome } from '../storage/saved-datasets.ts';
import './decision-outcome-controls.css';

interface Props {
  datasetId?: string;
  product: { key: string; title: string; sku?: string; pack?: string };
  snapshot: ReadinessSnapshot;
  onChanged?: () => void;
}
export function malaysiaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part = (type:string) => parts.find(item=>item.type===type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Observed stock records remain separate from the current planned order. */
export function StockOutcomeControls({datasetId,product,snapshot,onChanged}:Props) {
  const language=useLanguage(), copy=(en:string,zh:string,ms:string)=>language==='zh'?zh:language==='ms'?ms:en;
  const today=malaysiaToday(), canSave=!!datasetId && snapshot.sourceMode!=='sample';
  const [outcomes,setOutcomes]=useState<readonly RecordedStockOutcome[]>([]);
  const [kind,setKind]=useState<StockOutcomeKind>('discarded'),[date,setDate]=useState(today),[quantity,setQuantity]=useState(''),[unit,setUnit]=useState<OutcomeUnit>('pieces');
  const [editing,setEditing]=useState<string>(),[deleteTarget,setDeleteTarget]=useState<string>(),[busy,setBusy]=useState(false),[error,setError]=useState<string>(),[message,setMessage]=useState<string>();
  const load=useCallback(async()=>{
    const saved=datasetId?await getSavedDataset(datasetId):undefined;
    setOutcomes(saved?savedStockOutcomes(saved).filter(item=>item.productKey===product.key).sort((a,b)=>b.date.localeCompare(a.date)||b.recordedAt.localeCompare(a.recordedAt)):[]);
  },[datasetId,product.key]);
  useEffect(()=>{void load().catch(()=>setError(copy('Saved history could not be read. Try again.','无法读取已保存的历史，请重试。','Sejarah tersimpan tidak dapat dibaca. Cuba lagi.')));},[load,language]);
  useEffect(()=>{setEditing(undefined);setDeleteTarget(undefined);setQuantity('');setError(undefined);setMessage(undefined);},[product.key,datasetId]);
  const act=async(action:()=>Promise<unknown>,success:string)=>{
    setBusy(true);setError(undefined);setMessage(undefined);
    try {await action();await load();setMessage(success);onChanged?.();return true;}
    catch(failure){
      const fields=failure instanceof OutcomeValidationError?Object.keys(failure.fields):[];
      setError(language!=='en' && fields.includes('quantity')?copy('Correct the quantity. Use a non-negative number; pieces must be whole numbers.','请修正数量：使用非负数，件数必须为整数。','Betulkan kuantiti. Gunakan nombor bukan negatif; bilangan unit mestilah nombor bulat.')
        :language!=='en' && fields.some(field=>field.toLowerCase().includes('date'))?copy('Recorded outcomes cannot be in the future.','实际结果不能使用未来日期。','Hasil direkodkan tidak boleh bertarikh akan datang.')
        :copy(failure instanceof Error?failure.message:'Saving failed. Keep your inputs and try again.','保存失败；输入已保留，请检查数据后重试。','Simpanan gagal. Input dikekalkan; semak data dan cuba lagi.'));
      return false;
    } finally {setBusy(false);}
  };
  const kindName=(value:StockOutcomeKind)=>value==='discarded'?copy('Discarded','已丢弃','Dibuang'):value==='expired'?copy('Expired','已过期','Luput'):value==='sales'?copy('Recorded sales','实际销售','Jualan direkodkan'):copy('Stock count','库存盘点','Kiraan stok');
  const unitName=(value:OutcomeUnit)=>value==='pieces'?copy('pieces','件','unit'):value==='kg'?copy('kg','公斤','kg'):copy('litres','升','liter');
  const save=async()=>{
    if(!datasetId || !canSave)return;
    const existing=outcomes.find(item=>item.id===editing),weight=snapshot.productWeights?.find(item=>item.productKey===product.key);
    const conversion=existing?.unit===unit?existing.conversion:unit==='pieces'&&weight?.state==='usable'?{kilogramsPerUnit:weight.value,source:`Validated weight at recording: ${weight.sourceColumn??'Weight per unit'}; source rows ${weight.sourceRows.join(', ')}`}:undefined;
    // Preserve a historical link when editing; new records require no purchase decision.
    const input={kind,date,quantity,unit,referenceDate:today,decisionId:existing?.decisionId,conversion};
    if(await act(()=>editing?updateSavedStockOutcome(datasetId,editing,input):saveStockOutcome(datasetId,{...input,productKey:product.key}),copy('Actual outcome saved.','实际结果已保存。','Hasil sebenar disimpan.'))){setQuantity('');setEditing(undefined);}
  };
  return <section className="decision-outcomes" aria-label={copy('Actual stock records','实际库存记录','Rekod stok sebenar')}>
    <h3>{copy('Record actual stock outcomes','记录实际库存结果','Rekod hasil stok sebenar')}</h3>
    <p>{product.title}{product.sku&&<> · {product.sku}</>}{product.pack&&<> · {product.pack}</>}</p>
    {!canSave&&<p className="decision-outcomes__note">{snapshot.sourceMode==='sample'?copy('Sample records are for practice and do not enter your saved history.','示例记录仅供练习，不会进入已保存的历史。','Rekod contoh untuk latihan dan tidak masuk sejarah disimpan.'):copy('Save this dataset before recording outcomes.','请先保存此数据集，再记录实际结果。','Simpan set data ini sebelum merekod hasil.')}</p>}
    <p>{copy('Recorded waste is separate from predicted excess. No record is different from a recorded zero.','实际浪费与预测的过量库存分开记录。没有记录与记录为零不同。','Sisa direkodkan berasingan daripada lebihan ramalan. Tiada rekod berbeza daripada sifar direkodkan.')}</p>
    <form onSubmit={event=>{event.preventDefault();void save();}}><fieldset disabled={!canSave||busy}><legend>{editing?copy('Correct an actual outcome','修正实际结果','Betulkan hasil sebenar'):copy('Observed record','实际观测记录','Rekod diperhatikan')}</legend>
      <div className="decision-outcomes__grid">
        <label>{copy('Outcome type','结果类型','Jenis hasil')}<select value={kind} onChange={event=>setKind(event.target.value as StockOutcomeKind)}>{(['discarded','expired','sales','stock'] as const).map(value=><option key={value} value={value}>{kindName(value)}</option>)}</select></label>
        <label>{copy('Outcome date','实际发生日期','Tarikh hasil')}<input type="date" value={date} max={today} onChange={event=>setDate(event.target.value)}/></label>
        <label>{copy('Recorded quantity','实际记录数量','Kuantiti direkodkan')}<input inputMode="decimal" value={quantity} onChange={event=>setQuantity(event.target.value)}/></label>
        <label>{copy('Recorded unit','记录单位','Unit direkodkan')}<select value={unit} onChange={event=>setUnit(event.target.value as OutcomeUnit)}>{(['pieces','kg','litres'] as const).map(value=><option key={value} value={value}>{unitName(value)}</option>)}</select></label>
      </div><div className="decision-outcomes__actions"><button className="btn btn--primary" type="submit">{copy('Save actual outcome','保存实际结果','Simpan hasil sebenar')}</button>{editing&&<button type="button" onClick={()=>{setEditing(undefined);setQuantity('');}}>{copy('Cancel edit','取消修改','Batal suntingan')}</button>}</div>
    </fieldset></form>
    <details className="decision-outcomes__records"><summary>{copy(`Saved actual records (${outcomes.length})`,`已保存的实际记录（${outcomes.length}）`,`Rekod sebenar disimpan (${outcomes.length})`)}</summary>
      {!outcomes.length?<p>{copy('No outcome recorded.','尚无实际结果记录。','Tiada hasil direkodkan.')}</p>:<ul className="decision-outcomes__history">{outcomes.map(item=><li key={item.id}><strong>{kindName(item.kind)} · {item.quantity} {unitName(item.unit)}</strong> · {item.date}{item.quantity===0&&<p>{copy('Recorded zero','已记录为零','Sifar direkodkan')}</p>}<div className="decision-outcomes__actions"><button type="button" disabled={busy} onClick={()=>{setEditing(item.id);setKind(item.kind);setDate(item.date);setQuantity(String(item.quantity));setUnit(item.unit);}}>{copy('Edit outcome','修改实际结果','Sunting hasil')}</button><button type="button" disabled={busy} onClick={()=>setDeleteTarget(item.id)}>{copy('Delete outcome','删除实际结果','Padam hasil')}</button></div></li>)}</ul>}
    </details>
    {deleteTarget&&<div role="alertdialog" aria-label={copy('Confirm deletion','确认删除','Sahkan pemadaman')}><p>{copy('Delete this actual outcome?','删除此实际结果记录？','Padam hasil sebenar ini?')}</p><div className="decision-outcomes__actions"><button type="button" disabled={busy} onClick={()=>{if(datasetId)void act(()=>removeSavedOutcome(datasetId,deleteTarget),copy('Record deleted.','记录已删除。','Rekod dipadam.')).then(success=>{if(success)setDeleteTarget(undefined);});}}>{copy('Confirm delete','确认删除','Sahkan padam')}</button><button type="button" onClick={()=>setDeleteTarget(undefined)}>{copy('Cancel','取消','Batal')}</button></div></div>}
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  </section>;
}
