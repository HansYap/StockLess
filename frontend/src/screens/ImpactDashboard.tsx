import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { getLocale, t, useLanguage } from '../i18n/index.ts';
import { addCalendarDays, buildEnvironmentalImpact, buildImpactReview, buildMissingCostQueue, buildAnalysisReport, CARBON_MALAYSIA_ILLUSTRATION, evaluateProductPurchasePlan,
  type CarbonImpactKind, type CarbonImpactResult, type CarbonImpactSummary, type DemandForecastReview, type ImpactProduct, type MonetaryFigure, type MonetaryTotal, type PlanningContexts, type ProductPlanningContext, type ReadinessSnapshot, type SupplierOrderTerms } from '../engine.ts';
import { evaluatePurchaseProduct, joinPurchaseEvidence, type PurchaseDrafts } from '../purchase-plan/model.ts';
import { getSavedDataset, savedPurchaseDecisions, savedStockOutcomes, type SavedDataset } from '../storage/saved-datasets.ts';
import { downloadAnalysisWorkbook, downloadFinalisedOrdersWorkbook, NoFinalisedOrdersError, printAnalysisReport } from '../purchase-plan/analysis-report-export.ts';
import { PlanningInputsPanel } from '../components/PlanningInputsPanel.tsx';
import { CategoryConfirmation } from '../components/CategoryConfirmation.tsx';
import type { PlanningDetail } from '../components/product-estimates.ts';
import { OutcomePeriodComparison } from '../components/OutcomePeriodComparison.tsx';
import { DecisionOutcomeControls } from '../components/DecisionOutcomeControls.tsx';
import { ImpactStory, type ImpactTile } from '../components/ImpactStory.tsx';
import { ImpactIcon, type ImpactIconName } from '../components/ImpactIcon.tsx';
import './impact-reference.css';
import '../components/cp3-controls.css';

interface Props {
  snapshot: ReadinessSnapshot; forecast: DemandForecastReview; drafts: PurchaseDrafts;
  contexts?: PlanningContexts; datasetId?: string; shopName?: string; datasetName?: string;
  supplierDrafts?: Readonly<Record<string, SupplierOrderTerms | undefined>>;
  onContextChange?: (key:string,value:ProductPlanningContext)=>void;
  onContextsChange?: (updates:PlanningContexts)=>void;
  selectedKey?: string | null; onSelect?: (key:string)=>void;
  focus?: { section: ImpactSection; revision: number };
  onPurchaseDecision?: (key:string)=>void;
  onBack:()=>void; onNew?:()=>void;
}
export type ImpactSection = 'outcomes' | 'downloads';
type BusinessMeasure = 'planned' | 'excess' | 'scenario' | 'difference';
type EnvironmentMeasure = 'recorded' | 'potential' | 'scenario';
const EMPTY_CONTEXTS: PlanningContexts = Object.freeze({});

/** Compatibility helper; business calculations are owned by the shared engine. */
export function calculatePotentialExcess(snapshot: ReadinessSnapshot, forecast: DemandForecastReview, drafts: PurchaseDrafts) {
  return buildImpactReview(snapshot,forecast,drafts).products.flatMap(p => p.excessUnits === undefined ? [] : [{key:p.productKey,name:p.name,sku:p.code,available:p.available!,demandHigh:p.demandHigh!,units:p.excessUnits}]);
}

/** Step 5 in the supplied Impact Dashboard design, filled from the same CP3 engine figures as Step 4. */
export function ImpactDashboard({snapshot,forecast,drafts,contexts=EMPTY_CONTEXTS,datasetId,shopName,datasetName,supplierDrafts,onContextChange,onContextsChange,selectedKey,onSelect,focus,onPurchaseDecision,onBack,onNew}:Props) {
  const language=useLanguage(), c=(en:string,zh:string,ms:string)=>language==='zh'?zh:language==='ms'?ms:en;
  const n=(v:number)=>v.toLocaleString(getLocale(),{maximumFractionDigits:3});
  const units=(v:number)=>Math.round(v).toLocaleString(getLocale());
  const day=(iso:string)=>new Date(`${iso}T00:00:00Z`).toLocaleDateString(getLocale(),{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const money=(amount:number)=>`MYR ${amount.toFixed(2)}`;
  const co2=(kg:number)=>Math.abs(kg)>=1000?`${(kg/1000).toLocaleString(getLocale(),{maximumFractionDigits:2})} t CO₂e`:`${n(kg)} kg CO₂e`;
  const unavailable=c('Unavailable','不可用','Tidak tersedia'), notEntered=c('Not entered','未输入','Belum dimasukkan');
  const products=useMemo(()=>joinPurchaseEvidence(snapshot,forecast,contexts),[snapshot,forecast,contexts]);
  const plans=useMemo(()=>products.flatMap(p=>{const plan=evaluatePurchaseProduct(p,snapshot.analysisDate,drafts[p.key]??p.fileInputs,evaluateProductPurchasePlan,p.fileExpiry); return plan?[plan]:[];}),[products,snapshot.analysisDate,drafts]);
  const impact=useMemo(()=>buildImpactReview(snapshot,forecast,drafts,undefined,contexts),[snapshot,forecast,drafts,contexts]);
  const costQueue=useMemo(()=>buildMissingCostQueue(snapshot,impact,contexts),[snapshot,impact,contexts]);
  const [saved,setSaved]=useState<SavedDataset>();
  const historyRequest=useRef(0);
  const [revision,setRevision]=useState(0), [error,setError]=useState(''), [noOrders,setNoOrders]=useState(false), [busy,setBusy]=useState(false);
  const [lens,setLens]=useState<'business'|'environment'>('environment');
  const [businessMeasure,setBusinessMeasure]=useState<BusinessMeasure>('planned');
  const [environmentMeasure,setEnvironmentMeasure]=useState<EnvironmentMeasure>('potential');
  const [localSelected,setLocalSelected]=useState(products[0]?.key??'');
  const selected=selectedKey === undefined ? localSelected : selectedKey ?? products[0]?.key ?? '';
  const setSelected=(key:string)=>{if(selectedKey === undefined)setLocalSelected(key);onSelect?.(key);};
  const [reviewOpen,setReviewOpen]=useState(false);
  const [inputFocus,setInputFocus]=useState<{field:PlanningDetail;revision:number}>();
  const review=useRef<HTMLDetailsElement>(null);
  const [outcomesOpen,setOutcomesOpen]=useState(false), [downloadsOpen,setDownloadsOpen]=useState(false);
  const records=useRef<HTMLDetailsElement>(null), downloads=useRef<HTMLDetailsElement>(null);
  const [analysisOpen,setAnalysisOpen]=useState(false), [excessOpen,setExcessOpen]=useState(false);
  const [businessOpen,setBusinessOpen]=useState(false), [environmentOpen,setEnvironmentOpen]=useState(false);
  const excessProducts=useRef<HTMLDetailsElement>(null), businessBreakdown=useRef<HTMLDetailsElement>(null), environmentBreakdown=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{if(!products.some(p=>p.key===selected))setSelected(products[0]?.key??'');},[products,selected]);
  useEffect(()=>{if(focus){const target=focus.section==='outcomes'?records:downloads;if(focus.section==='outcomes')setOutcomesOpen(true);else setDownloadsOpen(true);requestAnimationFrame(()=>{target.current?.scrollIntoView?.({behavior:'smooth',block:'start'});target.current?.querySelector('summary')?.focus({preventScroll:true});});}},[focus]);
  useEffect(()=>{let cancelled=false;const request=++historyRequest.current;setSaved(undefined); if(datasetId)void getSavedDataset(datasetId).then(value=>{if(!cancelled&&request===historyRequest.current)setSaved(value);}).catch(()=>{if(!cancelled&&request===historyRequest.current)setError(c('Saved history could not be read.','无法读取已保存记录。','Sejarah tersimpan tidak dapat dibaca.'));});return()=>{cancelled=true;};},[datasetId,revision]);
  const outcomes=useMemo(()=>saved?savedStockOutcomes(saved):[],[saved]);
  const environmental=useMemo(()=>buildEnvironmentalImpact(snapshot,impact,contexts,outcomes,{datasetId}),[snapshot,impact,contexts,outcomes,datasetId]);
  const monetary=(total:MonetaryTotal|MonetaryFigure)=>total.state==='estimated'?money(total.amount):total.state==='not_entered'?notEntered:unavailable;
  const carbon=(summary:CarbonImpactSummary)=>summary.state==='estimated'?`≈ ${co2(summary.kgCO2e!)}`:summary.state==='no_records'?c('No outcome recorded','尚无实际结果记录','Tiada hasil direkodkan'):unavailable;

  // One set of derived figures feeds the story, both lenses and the FAQ examples.
  const assessed=impact.products.filter(p=>p.excessUnits!==undefined);
  const lines=assessed.map(p=>({key:p.productKey,name:p.name,sku:p.code,available:p.available!,demandHigh:p.demandHigh!,units:p.excessUnits!}));
  const excess=assessed.reduce((sum,p)=>sum+p.excessUnits!,0);
  const planned=assessed.reduce((sum,p)=>sum+Math.max(0,p.available!),0);
  const withExcess=[...assessed].filter(p=>p.excessUnits!>0).sort((a,b)=>b.excessUnits!-a.excessUnits!);
  const excessCost=impact.totals.excessCost, potential=environmental.potential;
  const sample=snapshot.sourceMode==='sample';
  const anyCost=(snapshot.productCosts??[]).some(cost=>cost.state==='usable');
  const queue=potential.confirmationQueue;
  const wasteRecords=outcomes.filter(o=>o.kind==='discarded'||o.kind==='expired').sort((a,b)=>a.date.localeCompare(b.date));
  const wasteTotals=(['pieces','kg','litres'] as const).flatMap(unit=>{const records=wasteRecords.filter(o=>o.unit===unit);return records.length?[`${n(records.reduce((sum,o)=>sum+o.quantity,0))} ${unit==='pieces'?c('pieces','件','unit'):unit==='kg'?'kg':c('litres','升','liter')}`]:[];});
  const costHint=!assessed.length?c('Enter planned orders in Step 4 first.','请先在第 4 步填写计划订购量。','Masukkan pesanan dirancang dalam Langkah 4 dahulu.')
    :!anyCost?c('Map Unit cost in Step 2, or enter your purchase cost in Step 4, to price this in ringgit.','到第 2 步对应进货单价，或在第 4 步填写采购成本，就能换算成令吉。','Padankan Kos seunit di Langkah 2, atau masukkan kos belian di Langkah 4, untuk kira dalam ringgit.')
    :c('No checked product has a validated unit cost yet. Add costs in Step 4 or correct them in your file.','已核对的商品还没有经过验证的单位成本。请在第 4 步补录或修正文件。','Tiada produk disemak dengan kos seunit disahkan. Tambah kos dalam Langkah 4 atau betulkan fail anda.');
  const emissionsHint=!assessed.length?c('Enter planned orders in Step 4 first.','请先在第 4 步填写计划订购量。','Masukkan pesanan dirancang dalam Langkah 4 dahulu.')
    :queue.length?c(`Confirm ${queue.length} product ${queue.length===1?'category':'categories'} to estimate CO₂e.`,`确认 ${queue.length} 件商品的食品类别后即可估算 CO₂e。`,`Sahkan kategori makanan bagi ${queue.length} produk untuk menganggar CO₂e.`)
    :c('Needs a confirmed food category and a weight per unit (from your file, the pack size or Step 4).','需要已确认的食品类别和每件重量（来自文件、包装规格或第 4 步）。','Perlukan kategori makanan disahkan dan berat seunit (daripada fail, saiz pek atau Langkah 4).');
  const businessTile:ImpactTile=excessCost.state==='estimated'?{value:money(excessCost.amount),note:c(`excess-stock cost, estimated from ${excessCost.includedCount} of ${assessed.length} checked products`,`过量库存成本估算，来自 ${assessed.length} 件已核对商品中的 ${excessCost.includedCount} 件`,`kos stok berlebihan, anggaran daripada ${excessCost.includedCount} daripada ${assessed.length} produk disemak`)}:{note:costHint};
  const emissionsTile:ImpactTile=potential.state==='estimated'?{value:`≈ ${co2(potential.kgCO2e!)}`,note:c(`estimated for the potential excess of ${potential.includedProductCount} of ${potential.totalProductCount} products`,`按 ${potential.totalProductCount} 件商品中 ${potential.includedProductCount} 件的潜在多余库存估算`,`anggaran bagi lebihan berpotensi ${potential.includedProductCount} daripada ${potential.totalProductCount} produk`)}:{note:emissionsHint};

  const refresh=()=>setRevision(value=>value+1);
  const reveal=(detail:HTMLDetailsElement|null)=>{detail?.scrollIntoView?.({behavior:'smooth',block:'start'});detail?.querySelector('summary')?.focus({preventScroll:true});};
  const openBusinessProducts=(measure:BusinessMeasure)=>{setBusinessMeasure(measure);setBusinessOpen(true);setLens('business');setAnalysisOpen(true);requestAnimationFrame(()=>reveal(businessBreakdown.current));};
  const openEnvironmentProducts=(measure:EnvironmentMeasure)=>{setEnvironmentMeasure(measure);setEnvironmentOpen(true);setLens('environment');setAnalysisOpen(true);requestAnimationFrame(()=>reveal(environmentBreakdown.current));};
  const openExcessProducts=()=>{setExcessOpen(true);requestAnimationFrame(()=>reveal(excessProducts.current));};
  const switchTab=(event:KeyboardEvent<HTMLButtonElement>)=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'environment':event.key==='End'?'business':lens==='business'?'environment':'business';setLens(next);document.getElementById(`${next}-tab`)?.focus();};
  const reviewProduct=(key:string,field:PlanningDetail)=>{setSelected(key);setInputFocus(previous=>({field,revision:(previous?.revision??0)+1}));setReviewOpen(true);requestAnimationFrame(()=>review.current?.scrollIntoView?.({behavior:'smooth',block:'start'}));};
  const makeReport=(history=saved)=>{const reportOutcomes=history?savedStockOutcomes(history):[];
    const reportEnvironment=history===saved?environmental:buildEnvironmentalImpact(snapshot,impact,contexts,reportOutcomes,{datasetId});
    return buildAnalysisReport({snapshot,forecast,plans,impact,datasetId:datasetId??'sample-preview',shopName,datasetName,
    decisions:history?savedPurchaseDecisions(history):[],outcomes:reportOutcomes,carbonResults:[...reportEnvironment.actualResults,...reportEnvironment.potentialResults,...reportEnvironment.scenarioResults],
    supplierScenariosByProduct:Object.fromEntries(Object.entries(supplierDrafts??{}).filter((entry):entry is [string,SupplierOrderTerms]=>!!entry[1]).map(([key,terms])=>[key,[{id:'current-terms',name:c('Entered supplier terms','已填写的供应商条件','Terma pembekal dimasukkan'),terms}]]))});};
  const currentReport=async()=>{const request=++historyRequest.current, history=datasetId?await getSavedDataset(datasetId):undefined;if(datasetId&&!history)throw new Error(c('Saved records could not be read. Reopen this dataset and try again.','无法读取已保存的记录。请重新打开此数据集后重试。','Rekod disimpan tidak dapat dibaca. Buka semula set data ini dan cuba lagi.'));if(history&&request===historyRequest.current)setSaved(history);return makeReport(history);};
  const fail=(e:unknown)=>{setNoOrders(e instanceof NoFinalisedOrdersError);setError(e instanceof NoFinalisedOrdersError?c('No finalised orders. Save a positive final quantity in purchase planning first.','没有已确定的订单。请先在采购计划中保存大于零的最终数量。','Tiada pesanan dimuktamadkan. Simpan kuantiti akhir positif dalam perancangan belian dahulu.'):e instanceof Error?t(e.message):unavailable);};
  const download=async(finalOnly=false)=>{setError('');setNoOrders(false);setBusy(true);try{const report=await currentReport();if(finalOnly)await downloadFinalisedOrdersWorkbook(report);else await downloadAnalysisWorkbook(report);}catch(e){fail(e);}finally{setBusy(false);}};
  const pdf=async()=>{setError('');setNoOrders(false);setBusy(true);try{const {downloadAnalysisPdf}=await import('../purchase-plan/analysis-report-pdf.ts');await downloadAnalysisPdf(await currentReport());}catch(e){fail(e);}finally{setBusy(false);}};
  const baselineOf=(kind:CarbonImpactKind)=>kind==='potential_excess'?c('the top of the expected four-week demand range','预期四周需求区间的上限','had atas julat permintaan empat minggu dijangka'):kind==='recorded_waste'?c('none — recorded waste is reported as you entered it','无——实际报损按您的记录呈现','tiada — sisa direkod dilaporkan seperti dimasukkan'):'';
  const explain=(result:CarbonImpactResult,index:number)=><details className="cp3-controls ix-explain" key={`${result.kind}-${result.productKey}-${index}`}><summary>{result.productName??result.productKey} · {result.state==='estimated'?`${n(result.kgCO2e)} kg CO₂e`:result.state==='no_record'?c('No outcome recorded','尚无实际结果记录','Tiada hasil direkodkan'):unavailable}</summary>
    {result.state==='estimated'?<><p>{result.factor.label==='sources_agree'?c('Sources agree','来源一致','Sumber bersetuju'):c('Estimate; sources disagree, bounded within ×2','估算；来源不一致，但均在 ×2 内','Anggaran; sumber berbeza, dalam julat ×2')}</p><p>{n(result.quantity??0)} {result.quantityUnit} → {n(result.massKg)} kg · {c('Mass basis','重量依据','Asas jisim')}: {c(result.massBasis, result.massBasis==='measured'?'实测':result.massBasis==='estimated'?'估算换算':'已知重量换算',result.massBasis==='measured'?'diukur':result.massBasis==='estimated'?'penukaran anggaran':'penukaran diketahui')}</p><p>{c('Compared with','比较基线','Dibandingkan dengan')}: {result.baseline??baselineOf(result.kind)}</p><p>{result.calculation}</p><p>{result.conversionSource}</p><p>{c('Source range','全部来源范围','Julat semua sumber')}: {n(result.factor.sourceRange!.low)}–{n(result.factor.sourceRange!.high)} kg CO₂e/kg · {c('Calculated range','计算范围','Julat pengiraan')}: {n(result.kgCO2eRange.low)}–{n(result.kgCO2eRange.high)} kg CO₂e</p><ul>{result.factor.sources.map(s=><li key={s.id}>{s.name} ({result.factor.selectedSources.includes(s.id)?c('used in factor','计入因子','digunakan dalam faktor'):c('shown for range only','仅用于来源范围','julat sumber sahaja')}): {n(s.value)} kg CO₂e/kg · {s.version} · {s.boundary}</li>)}</ul><p>{result.factor.explanation} {result.limitation}</p></>:<p>{t(result.reason)} {t(result.correctiveAction)}</p>}
  </details>;
  // Contributing products keep their full working; products left out are grouped by reason (US9.5 AC3).
  const breakdown=(results:readonly CarbonImpactResult[])=>{
    const groups=new Map<string,{reason:string;action:string;names:string[]}>();
    for(const result of results)if(result.state!=='estimated'){const group=groups.get(result.code)??{reason:result.reason,action:result.correctiveAction,names:[]};group.names.push(result.productName??result.productKey);groups.set(result.code,group);}
    return <>{results.filter(result=>result.state==='estimated').map(explain)}
      {groups.size>0&&<div className="ix-excluded"><h4>{c('Left out of this estimate','未计入此估算','Dikecualikan daripada anggaran ini')} ({results.filter(result=>result.state!=='estimated').length})</h4><ul>{[...groups.values()].map(group=><li key={group.reason}><b>{t(group.reason)}</b> <span>{t(group.action)}</span><small>{group.names.slice(0,8).join(' · ')}{group.names.length>8?` · +${group.names.length-8}`:''}</small></li>)}</ul></div>}</>;
  };
  const whyUnavailable=(reason:string|undefined,action:string)=><span className="ix-card__why">{reason?`${t(reason)} `:''}{action}</span>;
  const businessCard=(id:BusinessMeasure,title:string,total:MonetaryTotal)=><div className={`ix-card${businessOpen&&businessMeasure===id?' ix-card--on':''}`} key={id}>
    <span className="ix-card__k">{title}</span><b>{monetary(total)}</b><small>{c('Included / total','计入／总商品','Termasuk / jumlah')}: {total.includedCount}/{impact.products.length}</small>
    {total.state!=='estimated'&&whyUnavailable(total.reason,c('Enter planned orders and validated unit costs in Step 4, or map Unit cost in Step 2.','请在第 4 步填写计划订购量和经验证的单位成本，或在第 2 步对应进货单价。','Masukkan pesanan dirancang dan kos seunit disahkan dalam Langkah 4, atau padankan Kos seunit di Langkah 2.'))}
    <button type="button" className="ix-card__open" aria-pressed={businessMeasure===id} aria-expanded={businessOpen&&businessMeasure===id} aria-controls="business-breakdown" onClick={()=>openBusinessProducts(id)}>{businessOpen&&businessMeasure===id?c('Showing products ↓','正在显示商品 ↓','Memaparkan produk ↓'):c('See products','查看商品','Lihat produk')}</button>
  </div>;
  const environmentCard=(id:EnvironmentMeasure,title:string,summary:CarbonImpactSummary,quantity:string)=><div className={`ix-card${environmentOpen&&environmentMeasure===id?' ix-card--on':''}`} key={id}>
    <span className="ix-card__k">{title}</span><b>{carbon(summary)}</b><small>{c('Contributing products','计入商品','Produk menyumbang')}: {summary.includedProductCount}/{summary.totalProductCount}</small>
    {summary.massKg!==undefined&&<span className="ix-card__mass">{n(summary.massKg)} kg · {c('Source-agreement mass / estimated-factor mass','来源一致重量／估算因子重量','Jisim sumber bersetuju / faktor anggaran')}: {n(summary.massKgSourcesAgree)} / {n(summary.massKgEstimate)} kg</span>}
    <span className="ix-card__qty">{quantity}</span>
    {summary.state==='unavailable'&&whyUnavailable(summary.reason,c('Confirm categories and weights below or in Step 4.','请在下方或第 4 步确认类别与重量。','Sahkan kategori dan berat di bawah atau dalam Langkah 4.'))}
    {summary.state==='no_records'&&whyUnavailable(undefined,c('Record discarded or expired stock to see it here.','记录已丢弃或过期的库存后会显示在这里。','Rekod stok dibuang atau luput untuk melihatnya di sini.'))}
    <button type="button" className="ix-card__open" aria-pressed={environmentMeasure===id} aria-expanded={environmentOpen&&environmentMeasure===id} aria-controls="environment-breakdown" onClick={()=>openEnvironmentProducts(id)}>{environmentOpen&&environmentMeasure===id?c('Showing products ↓','正在显示商品 ↓','Memaparkan produk ↓'):c('See products','查看商品','Lihat produk')}</button>
  </div>;
  const sentence=(text:string)=>text.charAt(0).toLocaleUpperCase()+text.slice(1);
  const measureOf=(p:ImpactProduct)=>{
    const figure=businessMeasure==='planned'?p.plannedSpend:businessMeasure==='excess'?p.excessCost:businessMeasure==='scenario'?p.scenarioSpend:p.spendDifference;
    const quantity=businessMeasure==='planned'?p.plannedQuantity:businessMeasure==='excess'?p.excessUnits:businessMeasure==='scenario'?p.scenarioQuantity:p.plannedQuantity!==undefined&&p.scenarioQuantity!==undefined?p.plannedQuantity-p.scenarioQuantity:undefined;
    return {figure,quantity};
  };
  const measureRow=(p:ImpactProduct)=>{
    const {figure,quantity}=measureOf(p), cost=snapshot.productCosts?.find(item=>item.productKey===p.productKey);
    return <tr key={p.productKey}><td><b>{p.name}</b><br /><span className="num">{p.code}{p.pack?` · ${p.pack}`:''}</span></td><td className="num">{quantity===undefined?'—':n(quantity)}</td><td className="num">{cost?.state==='usable'?money(cost.value):unavailable}</td><td className="num">{monetary(figure)}</td><td>{p.exclusionReason?sentence(t(p.exclusionReason)):figure.state!=='estimated'?sentence(t(figure.reason)):c('Included','已计入','Termasuk')}</td></tr>;
  };
  const measureHead=<thead><tr>{[c('Product / code / pack','商品／编码／包装','Produk / kod / bungkusan'),c('Quantity','数量','Kuantiti'),c('Validated unit cost','已验证单位成本','Kos seunit disahkan'),c('Amount','金额','Amaun'),c('Reason','原因','Sebab')].map(x=><th key={x}>{x}</th>)}</tr></thead>;
  const includedRows=impact.products.filter(p=>measureOf(p).figure.state==='estimated'), leftOutRows=impact.products.filter(p=>measureOf(p).figure.state!=='estimated');
  const measureTitle={planned:c('Planned purchase spend by product','各商品计划采购支出','Perbelanjaan belian dirancang mengikut produk'),excess:c('Excess-stock cost by product','各商品过量库存成本','Kos stok berlebihan mengikut produk'),scenario:c('Restock scenario spend by product','各商品补货情景支出','Belanja senario stok semula mengikut produk'),difference:c('Purchase-spend difference by product','各商品采购支出差异','Perbezaan belanja belian mengikut produk')}[businessMeasure];
  const environmentResults=environmentMeasure==='potential'?environmental.potentialResults:environmentMeasure==='scenario'?environmental.scenarioResults:environmental.actualResults;
  const faq:readonly [ImpactIconName,string,string][]=[
    ['recycle',c('How is potential excess estimated?','潜在多余库存是怎么估算的？','Bagaimana lebihan berpotensi dianggarkan?'),c(`For each product StockLess could judge, it takes the stock you would hold after your planned order and subtracts the top of the expected four-week demand range. Anything above that figure is stock you are unlikely to sell inside four weeks. In this plan: ${units(excess)} units across ${withExcess.length} of ${assessed.length} checked products. Products without a planned order, demand range or usable stock count are left out, not counted as zero.`,`对于 StockLess 能够判断的每件商品，用下单后将持有的库存减去预期四周需求区间的上限，超出部分就是四周内不太可能卖完的库存。本计划：${assessed.length} 件已核对商品中有 ${withExcess.length} 件，共 ${units(excess)} 件。没有计划订单、需求区间或可用库存盘点的商品会被排除，而不是计为零。`,`Bagi setiap produk yang StockLess dapat nilai, stok selepas pesanan dirancang ditolak dengan had atas julat permintaan empat minggu. Lebihan itu ialah stok yang mungkin tidak terjual dalam empat minggu. Dalam pelan ini: ${units(excess)} unit merentasi ${withExcess.length} daripada ${assessed.length} produk disemak. Produk tanpa pesanan dirancang, julat permintaan atau kiraan stok yang sah dikecualikan, bukan dikira sifar.`)],
    ['coins',c('How are the money figures calculated?','金额是怎么计算的？','Bagaimana angka wang dikira?'),c(`Each quantity is multiplied by the unit cost Step 3 validated from your file, or the purchase cost you entered in Step 4. The purchase-spend difference is your planned spend minus the restock-scenario spend for the same products; it is an estimate, not achieved savings or profit. Products without a usable cost are left out of totals, never priced at a guess. In this plan the excess-stock cost is ${monetary(excessCost)}.`,`每个数量乘以第 3 步从文件验证的单位成本，或您在第 4 步填写的采购成本。采购支出差异＝同一批商品的计划支出－补货情景支出，属于估算，不是已实现的节省或利润。没有可用成本的商品不计入合计，绝不凭猜测定价。本计划的过量库存成本为 ${monetary(excessCost)}。`,`Setiap kuantiti didarab dengan kos seunit yang disahkan dalam Langkah 3 daripada fail anda, atau kos belian yang anda masukkan dalam Langkah 4. Perbezaan belanja ialah belanja dirancang tolak belanja senario stok semula bagi produk yang sama; ia anggaran, bukan penjimatan atau keuntungan sebenar. Produk tanpa kos yang sah dikecualikan, tidak sekali-kali diteka. Dalam pelan ini kos stok berlebihan ialah ${monetary(excessCost)}.`)],
    ['bin',c('How is recorded waste different from potential excess?','实际报损和潜在多余库存有什么不同？','Apakah beza sisa direkod dengan lebihan berpotensi?'),c(`Recorded waste is stock you actually discarded or that expired, saved with its date, quantity and unit. Potential excess is an estimate for the next four weeks. The two are never added together, and “No record” is different from a recorded zero. In this dataset: ${wasteTotals.length?wasteTotals.join(' · '):'no waste recorded yet'}.`,`实际报损是您真正丢弃或过期的库存，按日期、数量和单位保存；潜在多余库存是对未来四周的估算。两者从不相加，“没有记录”也不同于记录为零。本数据集：${wasteTotals.length?wasteTotals.join(' · '):'尚未记录报损'}。`,`Sisa direkod ialah stok yang benar-benar dibuang atau luput, disimpan dengan tarikh, kuantiti dan unit. Lebihan berpotensi ialah anggaran untuk empat minggu akan datang. Kedua-duanya tidak dijumlahkan, dan “Tiada rekod” berbeza daripada sifar direkod. Dalam set data ini: ${wasteTotals.length?wasteTotals.join(' · '):'belum ada sisa direkodkan'}.`)],
    ['globe',c('What does CO₂e mean, and how is it estimated?','CO₂e 是什么意思？怎么估算？','Apakah maksud CO₂e dan bagaimana ia dianggarkan?'),c(`CO₂e (carbon dioxide equivalent) puts several greenhouse gases into one figure. StockLess converts units to kilograms using your file's weight, the pack size or a weight you enter, then multiplies by a factor for the confirmed food category from four published sources (farm to retail). A figure is shown only when the sources agree, or as a labelled estimate when their median is within ×2 of every source. Potential excess in this plan: ${potential.state==='estimated'?`≈ ${co2(potential.kgCO2e!)}`:'not yet available'}.`,`CO₂e（二氧化碳当量）把多种温室气体合成一个数字。StockLess 用文件中的重量、包装规格或您填写的重量把件数换算成公斤，再乘以已确认食品类别在四个公开数据源（从农场到零售）中的系数。只有在来源一致时才显示，或在中位数与每个来源相差不超过 2 倍时标注为估算。本计划潜在多余库存：${potential.state==='estimated'?`≈ ${co2(potential.kgCO2e!)}`:'暂时无法计算'}。`,`CO₂e (setara karbon dioksida) menggabungkan beberapa gas rumah hijau dalam satu angka. StockLess menukar unit kepada kilogram menggunakan berat dalam fail, saiz pek atau berat yang anda masukkan, kemudian mendarab dengan faktor kategori makanan yang disahkan daripada empat sumber terbitan (ladang hingga runcit). Angka hanya ditunjukkan apabila sumber bersetuju, atau sebagai anggaran berlabel apabila median dalam ×2 setiap sumber. Lebihan berpotensi dalam pelan ini: ${potential.state==='estimated'?`≈ ${co2(potential.kgCO2e!)}`:'belum tersedia'}.`)],
    ['puzzle',c('What happens when data is missing?','缺少数据时会怎样？','Apa berlaku apabila data tiada?'),c(`A missing cost, weight, category, planned order or waste record stays “Unavailable”, “Not entered” or “No record” — never zero. Every total says how many products it includes, and the products left out show their reason and what to do next. Right now ${impact.excludedCount} of ${impact.products.length} products are left out of the plan-based figures.`,`缺少成本、重量、类别、计划订单或报损记录时，显示“不可用”“未输入”或“没有记录”，绝不当作零。每个合计都会说明计入了多少商品，被排除的商品会显示原因和下一步。目前 ${impact.products.length} 件商品中有 ${impact.excludedCount} 件未计入基于计划的数字。`,`Kos, berat, kategori, pesanan dirancang atau rekod sisa yang tiada kekal “Tidak tersedia”, “Belum dimasukkan” atau “Tiada rekod” — tidak pernah sifar. Setiap jumlah menyatakan bilangan produk yang dikira, dan produk yang dikecualikan menunjukkan sebab serta langkah seterusnya. Kini ${impact.excludedCount} daripada ${impact.products.length} produk dikecualikan daripada angka berasaskan pelan.`)],
    ['trend',c('Are these figures exact?','这些数字精确吗？','Adakah angka ini tepat?'),c('No. They are estimates based on the sales, stock and purchase data in your file, and they are meant to support your decision rather than to report a verified outcome. A longer and cleaner sales history gives a steadier estimate; a short or patchy one gives a rougher estimate.','不精确。它们是根据您文件中的销售、库存和采购数据做出的估算，用于辅助您做决定，而不是报告经过验证的结果。销售历史越长、越干净，估算越稳定；记录短或不完整，估算就越粗略。','Tidak. Ia ialah anggaran berdasarkan data jualan, stok dan pembelian dalam fail anda, dan ia bertujuan menyokong keputusan anda, bukan melaporkan hasil yang disahkan. Sejarah jualan yang lebih panjang dan lebih bersih memberikan anggaran yang lebih mantap; yang pendek atau berlubang memberikan anggaran yang lebih kasar.')],
  ];
  const facts:readonly [string,string,string][]=[
    ['40.03%',c('of Malaysia’s 36,900 tonnes of daily solid waste is food','马来西亚每天 36,900 吨固体垃圾中是食物','daripada 36,900 tan sisa pepejal harian di Malaysia ialah makanan'),c('SWCorp, via Achariam 2026','SWCorp，引自 Achariam 2026','SWCorp, melalui Achariam 2026')],
    ['80.5%',c('of retail food returns are caused by expiry','的零售食品退货是因为过期','pemulangan makanan di kedai berpunca daripada barang luput'),c('Vijayan et al., 2014','Vijayan 等，2014','Vijayan et al., 2014')],
    ['62.7%',c('of Klang Valley food retailers send leftover food to landfill','的巴生谷食品零售商把剩余食物送去填埋场','peruncit makanan di Lembah Klang buang lebihan makanan ke tapak pelupusan'),c('Vijayan et al., 2014','Vijayan 等，2014','Vijayan et al., 2014')],
    ['8.6%',c('of global food-system emissions come from food waste at end of life','的全球食品系统碳排放来自被丢弃的食物','pelepasan sistem makanan dunia datang daripada sisa makanan yang dibuang'),c('Crippa et al., 2021','Crippa 等，2021','Crippa et al., 2021')],
  ];
  const head:ReactNode=<>
    <p className="eyebrow"><ImpactIcon name="globe" size={16} className="growth-icon--inline" /> {c('Your purchase plan → your impact','您的进货计划 → 带来的改变','Pelan belian anda → impaknya')}{sample&&<span className="pill pill--amber impact__sample">{c('Sample data','示例数据','Data contoh')}</span>}</p>
    <h1 className="impact__title" id="impact-title">{c('See the impact of your purchase plan','看看这次进货计划带来的改变','Lihat impak pelan belian anda')}</h1>
    <p className="impact__lede">{c('Estimates for your current plan over the next four weeks. Recorded waste is shown separately from possible excess stock.','以下是当前计划未来四周的估算。实际报损与可能多余的库存分开显示。','Anggaran bagi pelan semasa anda untuk empat minggu akan datang. Sisa direkod ditunjukkan berasingan daripada stok berlebihan berpotensi.')}</p>
    <dl className="impact__meta">
      <div><dt>{c('Shop','店铺','Kedai')}</dt><dd>{shopName&&shopName!=='My store'?shopName:shopName?c('Your store','您的店铺','Kedai anda'):c('Shop not named','未命名店铺','Kedai belum dinamakan')}</dd></div>
      <div><dt>{c('Dataset','数据集','Set data')}</dt><dd>{datasetName||snapshot.sourceName}</dd></div>
      <div><dt>{c('Analysis date','分析日期','Tarikh analisis')}</dt><dd>{day(snapshot.analysisDate)}</dd></div>
      <div><dt>{c('Planning period','规划期间','Tempoh perancangan')}</dt><dd>{day(snapshot.analysisDate)} – {day(addCalendarDays(snapshot.analysisDate,27))}</dd></div>
      <div><dt>{c('Recorded outcomes','实际结果记录','Hasil direkodkan')}</dt><dd>{wasteRecords.length?`${day(wasteRecords[0].date)} – ${day(wasteRecords[wasteRecords.length-1].date)}`:c('None recorded yet','暂无记录','Belum direkodkan')}</dd></div>
    </dl>
  </>;

  return <main className="impact" aria-labelledby="impact-title">
    <ImpactStory head={head} lines={lines} totalProducts={impact.products.length} business={businessTile} emissions={emissionsTile} onBack={onBack} onExcess={openExcessProducts} onBusiness={()=>openBusinessProducts('excess')} onEmissions={()=>openEnvironmentProducts('potential')} />
    <details className="sx-card impact__disclosure impact__downloads" ref={downloads} open={downloadsOpen} onToggle={event=>setDownloadsOpen(event.currentTarget.open)}><summary><span>{c('Download your results','下载结果','Muat turun hasil anda')}</span><small>{c('Analysis or saved final orders · Excel, PDF or print','分析或已保存的最终订单 · Excel、PDF 或打印','Analisis atau pesanan akhir disimpan · Excel, PDF atau cetak')}</small></summary>
    <section className="impact__download-section"><h3>{c('Plan analysis','计划分析','Analisis pelan')}</h3><p>{c('Estimates use your current draft. Recorded decisions and actual outcomes are included separately.','估算使用当前草稿。已记录的决定与实际结果单独列出。','Anggaran menggunakan draf semasa. Keputusan dan hasil sebenar direkod disertakan berasingan.')}</p>
    <div className="impact__toolbar" role="group" aria-label={c('Download your results','下载结果','Muat turun hasil anda')}>
      <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={()=>void download()}>{c('Download analysis Excel','下载分析 Excel','Muat turun Excel analisis')}</button>
      <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={()=>void pdf()}>{c('Download analysis PDF','下载分析 PDF','Muat turun PDF analisis')}</button>
      <button type="button" className="btn btn--ghost btn--small" disabled={busy || (!!datasetId && !saved)} onClick={()=>{setError('');setNoOrders(false);try{printAnalysisReport(makeReport());}catch(e){fail(e);}}}>{c('Print / Save PDF','打印／保存 PDF','Cetak / Simpan PDF')}</button>
    </div>
    </section><section className="impact__download-section"><h3>{c('Saved final orders','已保存的最终订单','Pesanan akhir disimpan')}</h3><p>{c('Only positive quantities from saved final choices appear here. Later draft edits do not change a saved choice.','这里只包含已保存最终选择中的正数数量。后续草稿修改不会改变已保存的选择。','Hanya kuantiti positif daripada pilihan akhir disimpan dipaparkan di sini. Suntingan draf kemudian tidak mengubah pilihan disimpan.')}</p><div className="impact__toolbar"><button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={()=>void download(true)}>{c('Download final orders Excel','下载最终订单 Excel','Muat turun Excel pesanan akhir')}</button>{onPurchaseDecision && selected && <button type="button" className="btn btn--ghost btn--small" onClick={()=>onPurchaseDecision(selected)}>{c('Review final choices in Purchase plan','在采购计划中核对最终选择','Semak pilihan akhir dalam Pelan belian')} →</button>}</div></section>
    </details>
    {error&&<div className="notice notice--error impact__error" role="alert"><span>{error}</span>{noOrders&&<button type="button" className="btn btn--ghost btn--small" onClick={()=>onPurchaseDecision&&selected?onPurchaseDecision(selected):onBack()}>{c('Save a final choice in Purchase plan','在采购计划中保存最终选择','Simpan pilihan akhir dalam Pelan belian')} →</button>}</div>}

    <details className="sx-card impact__disclosure impact__analysis" open={analysisOpen} onToggle={event=>setAnalysisOpen(event.currentTarget.open)}><summary><span>{c('Detailed estimates','详细估算','Anggaran terperinci')}</span><small>{c('Purchase spending, recorded waste and alternative orders','采购支出、实际报损与其他订购方案','Belanja belian, sisa direkod dan pesanan alternatif')}</small></summary>
    <div className="sx-lens">
      <div className="sx-tabs" role="tablist" aria-label={c('Impact view','影响视图','Paparan impak')}>
        <button type="button" role="tab" id="environment-tab" className="sx-tab" aria-controls="environment-impact" aria-selected={lens==='environment'} tabIndex={lens==='environment'?0:-1} onKeyDown={switchTab} onClick={()=>setLens('environment')}><ImpactIcon name="sprout" size={18} /> {c('Environmental','环境','Alam sekitar')}</button>
        <button type="button" role="tab" id="business-tab" className="sx-tab" aria-controls="business-impact" aria-selected={lens==='business'} tabIndex={lens==='business'?0:-1} onKeyDown={switchTab} onClick={()=>setLens('business')}><ImpactIcon name="coins" size={18} /> {c('Business','生意','Perniagaan')}</button>
      </div>
      <section id="environment-impact" role="tabpanel" aria-labelledby="environment-tab" hidden={lens!=='environment'}>
        <div className="ix-body">
          <h2 className="ix-title">{c('Environmental impact','环境影响','Impak alam sekitar')}</h2>
          <p className="ix-sub">{c('Three separate measures; they are never added together. Values are kg CO₂e.','三个独立指标，从不相加。单位为公斤 CO₂e。','Tiga ukuran berasingan yang tidak pernah dijumlahkan. Nilai dalam kg CO₂e.')}</p>
          <div className="ix-cards">
            {environmentCard('recorded',c('Recorded waste: estimated CO₂e','实际报损：CO₂e 估算','Pembaziran direkod: anggaran CO₂e'),environmental.recorded,wasteTotals.length?`${c('Recorded','已记录','Direkod')}: ${wasteTotals.join(' · ')}`:c('No waste record for this dataset','本数据集没有报损记录','Tiada rekod sisa untuk set data ini'))}
            {environmentCard('potential',c('Potential excess: estimated CO₂e','潜在过量：CO₂e 估算','Lebihan berpotensi: anggaran CO₂e'),potential,`${assessed.length?units(excess):'—'} ${c('sales units above expected demand','销售单位超出预期需求','unit jualan melebihi permintaan dijangka')}`)}
            {environmentCard('scenario',c('Named scenario difference','当前计划与补货情景差异','Perbezaan senario dinamakan'),environmental.scenario,c('Your planned order minus the restock recommendation','您的计划订单减去补货建议','Pesanan dirancang tolak cadangan stok semula'))}
          </div>
          <details className="cp3-controls ix-more"><summary>{c('How CO₂e estimates are calculated','CO₂e 估算的计算方法','Cara anggaran CO₂e dikira')}</summary>
          {potential.state==='estimated'&&<p>{c('Potential excess estimate range','潜在过量估算区间','Julat anggaran lebihan berpotensi')}: {co2(potential.kgCO2eRange!.low)} – {co2(potential.kgCO2eRange!.high)}</p>}
          <p>{c('CP3 v2: agreeing-group mean; otherwise median only within ×2 of every source, labelled estimate. Single-source factors are excluded. No consumer stage. Confirm every category.','CP3 v2：一致来源组取均值；否则，仅当中位数与每个来源均在 ×2 内时显示估算。单一来源不显示。排除消费者阶段，每个类别均需人工确认。','CP3 v2: min kumpulan sumber bersetuju; jika tidak, median hanya apabila dalam ×2 setiap sumber, berlabel anggaran. Faktor satu sumber dan peringkat pengguna dikecualikan. Sahkan setiap kategori.')}</p>
          <p>{c('The scenario compares potential excess under your current order with the restock recommendation. Positive means potentially less excess; negative means more. It is not a measured reduction.','情景比较当前采购与补货建议下的潜在过量。正值表示可能减少，负值表示可能增加，不代表实测减排。','Senario membandingkan lebihan berpotensi pesanan semasa dengan cadangan stok semula. Positif mungkin kurang; negatif lebih. Ia bukan pengurangan diukur.')}</p>
          </details>
          <details className="cp3-controls ix-more"><summary>{c('Categories to confirm, largest known kg at risk first','待确认类别，按已知风险公斤数排序','Kategori untuk disahkan, kg risiko diketahui terbesar dahulu')}</summary>{queue.length?<ul className="ix-queue">{queue.map(r=><li key={r.productKey}><span>{r.productName??r.productKey} · {r.kgAtRisk===undefined?unavailable:`${n(r.kgAtRisk)} kg`}</span><button type="button" className="btn btn--ghost btn--small" onClick={()=>reviewProduct(r.productKey,'category')}>{c('Confirm category','确认类别','Sahkan kategori')}</button></li>)}</ul>:<p>{c('No pending category confirmations.','没有待确认类别。','Tiada kategori menunggu pengesahan.')}</p>}</details>
          <p className="ix-note">{c('Recorded-waste period: all saved outcome dates for this dataset. Forecast period: the next 28 days from the analysis date. Select equal-length history periods below for a before/after comparison.','实际报损期间：本数据集所有已保存的发生日期。预测期间：分析日起未来 28 天。前后期间比较请使用下方等长日期筛选。','Tempoh sisa direkod: semua tarikh hasil tersimpan set data ini. Tempoh ramalan: 28 hari selepas tarikh analisis. Pilih tempoh sejarah sama panjang di bawah untuk perbandingan sebelum/selepas.')}</p>
          <details className="ix-breakdown" id="environment-breakdown" ref={environmentBreakdown} aria-live="polite" open={environmentOpen} onToggle={event=>setEnvironmentOpen(event.currentTarget.open)}><summary>{environmentMeasure==='recorded'?c('Recorded waste by product','各商品实际报损','Sisa direkod mengikut produk'):environmentMeasure==='potential'?c('Why these estimates? Potential excess by product','这些估算如何得出？各商品潜在过量','Mengapa anggaran ini? Lebihan berpotensi mengikut produk'):c('Scenario difference by product','各商品情景差异','Perbezaan senario mengikut produk')}</summary>
            {environmentMeasure==='recorded'&&wasteRecords.length>0&&<ul className="ix-records">{wasteRecords.map(o=><li key={o.id}>{day(o.date)} · {impact.products.find(p=>p.productKey===o.productKey)?.name??o.productKey} · {n(o.quantity)} {o.unit} · {o.kind==='expired'?c('Expired','已过期','Luput'):c('Discarded','已丢弃','Dibuang')}{o.quantity===0&&` · ${c('Recorded zero','已记录为零','Sifar direkodkan')}`}</li>)}</ul>}
            {breakdown(environmentResults)}
          </details>
          <details className="cp3-controls ix-more"><summary>{c('Comparison and sustainability notes','比较与可持续发展说明','Nota perbandingan dan kemampanan')}</summary>
          <p className="ix-note">{c('Illustrative comparison only','仅作直观比较','Perbandingan ilustrasi sahaja')}: {potential.kgCO2e===undefined?unavailable:`${n(potential.kgCO2e/CARBON_MALAYSIA_ILLUSTRATION.kgCO2ePerPersonPerDay)} ${c('Malaysia person-days','马来西亚人均排放天数','hari-orang Malaysia')}`} · 29.95 kg CO₂e/{c('person/day','人／天','orang/hari')} · {CARBON_MALAYSIA_ILLUSTRATION.source}. {c('All sectors; not a food-waste reduction baseline.','包括所有行业，不是食品浪费减排基线。','Semua sektor; bukan garis dasar pengurangan pembaziran makanan.')}</p>
          <p className="ix-note">{c('SDG 12.3 aims to halve food waste at the retail and consumer level by 2030. These CO₂e figures describe the possible effect of potential excess and of the waste you recorded; they do not prove an achieved emissions reduction.','SDG 12.3 目标是在 2030 年前将零售和消费环节的食物浪费减半。这些 CO₂e 数字说明潜在多余库存和已记录报损可能带来的影响，并不证明已实现减排。','SDG 12.3 menyasarkan pembaziran makanan di peringkat runcit dan pengguna dikurangkan separuh menjelang 2030. Angka CO₂e ini menerangkan kesan yang mungkin daripada lebihan berpotensi dan sisa yang anda rekod; ia tidak membuktikan pengurangan pelepasan yang tercapai.')}</p>
          </details>
        </div>
      </section>
      <section id="business-impact" role="tabpanel" aria-labelledby="business-tab" hidden={lens!=='business'}>
        <details className="cp3-controls ix-more"><summary>{c('How excess-stock cost is calculated','多余库存成本的计算方法','Cara kos stok berlebihan dikira')}</summary><div className="sx-panel sx-panel--biz">
          <div>
            {excessCost.state==='estimated'?<><p className="sx-eq__head">{c('Excess units × validated unit cost','多余数量 × 已验证单位成本','Unit berlebihan × kos seunit disahkan')}</p>
              <ul className="sx-eq">{withExcess.filter(p=>p.excessCost.state==='estimated').map(p=><li key={p.productKey}><span>{p.name} <span className="num">{p.code}</span></span><span className="sx-eq__m"><b>{units(p.excessUnits!)}</b> × {p.excessCost.state==='estimated'?money(p.excessCost.unitCost):''}</span><span className="sx-eq__r">{monetary(p.excessCost)}</span></li>)}</ul>
              <div className="sx-eq__total"><span>{c('Total excess-stock cost','过量库存成本合计','Jumlah kos stok berlebihan')}</span><b>{money(excessCost.amount)}</b></div></>
              :<><p className="sx-big sx-big--locked">{c('Not yet available','暂时无法计算','Belum tersedia')}</p><p className="sx-sub">{costHint}</p></>}
          </div>
          <p className="sx-note">{c('Money is shown only from a unit cost Step 3 could confirm, or a purchase cost you entered. StockLess never guesses a price.','只有第 3 步确认过的单价或您填写的采购成本才会用来算钱，StockLess 绝不乱猜价格。','Nilai wang hanya ditunjukkan daripada kos seunit yang disahkan di Langkah 3, atau kos belian yang anda masukkan. StockLess tak pernah teka harga.')}</p>
        </div></details>
        <div className="ix-body">
          <h2 className="ix-title">{c('Business impact','经营影响','Impak perniagaan')}</h2>
          <p className="ix-sub">{c(`Currency: MYR · Compared with: your current planned order vs the restock recommendation · Period: ${day(snapshot.analysisDate)} – ${day(addCalendarDays(snapshot.analysisDate,27))}`,`币种：MYR · 比较基线：当前计划订单与补货建议 · 期间：${day(snapshot.analysisDate)} – ${day(addCalendarDays(snapshot.analysisDate,27))}`,`Mata wang: MYR · Dibandingkan: pesanan dirancang semasa dengan cadangan stok semula · Tempoh: ${day(snapshot.analysisDate)} – ${day(addCalendarDays(snapshot.analysisDate,27))}`)}</p>
          <div className="ix-cards ix-cards--four">
            {businessCard('planned',c('Planned purchase spend','计划采购支出','Perbelanjaan belian dirancang'),impact.totals.plannedSpend)}
            {businessCard('excess',c('Excess-stock cost','过量库存成本','Kos stok berlebihan'),impact.totals.excessCost)}
            {businessCard('scenario',c('Restock scenario spend','补货情景支出','Belanja senario stok semula'),impact.totals.scenarioSpend)}
            {businessCard('difference',c('Estimated purchase-spend difference','预计采购支出差异','Perbezaan belanja belian dianggarkan'),impact.totals.spendDifference)}
          </div>
          <details className="cp3-controls ix-more"><summary>{c('How the money figures compare','金额之间如何比较','Cara angka wang dibandingkan')}</summary>
          <p>{c('Difference = current planned spend − restock-scenario spend, for the same eligible products. It is not achieved savings, profit or selling-price revenue.','差异＝当前计划支出－补货情景支出，两者使用相同的可计入商品；它不是已实现节省、利润或销售额。','Perbezaan = belanja dirancang semasa − belanja senario stok semula bagi produk layak sama. Ia bukan penjimatan, keuntungan atau hasil jualan sebenar.')}</p>
          <p className="ix-note">{c('Current planned spend for comparable products','参与情景比较的当前采购支出','Belanja dirancang semasa bagi produk boleh dibandingkan')}: {monetary(impact.totals.comparisonPlannedSpend)} · {impact.totals.comparisonPlannedSpend.includedCount}/{impact.products.length}. {c('Compare this subtotal with the restock scenario above. Other costed orders remain in total planned spend.','此小计与上方补货情景比较；其他已有成本的订单仍计入总计划支出。','Bandingkan jumlah kecil ini dengan senario stok semula di atas. Pesanan lain dengan kos kekal dalam jumlah belanja dirancang.')}</p>
          <p className="ix-note">{c('Potential excess','潜在过量库存','Lebihan berpotensi')}: {impact.assessedCount?n(excess):unavailable} {c('sales units','销售单位','unit jualan')} · {impact.assessedCount}/{impact.products.length} {c('assessed','已评估','dinilai')}</p>
          </details>
          <details className="ix-breakdown" id="business-breakdown" ref={businessBreakdown} aria-live="polite" open={businessOpen} onToggle={event=>setBusinessOpen(event.currentTarget.open)}><summary>{measureTitle}</summary>
            {includedRows.length?<div className="ix-table"><table>{measureHead}<tbody>{includedRows.map(measureRow)}</tbody></table></div>:<p className="impact__empty">{c('No product is included yet: this total is Unavailable, not zero.','尚无商品计入：此合计为不可用，而不是零。','Belum ada produk dikira: jumlah ini Tidak tersedia, bukan sifar.')}</p>}
            {leftOutRows.length>0&&<details className="ix-left-out" open={!includedRows.length||undefined}><summary>{c(`${leftOutRows.length} products left out of this total, with reasons`,`${leftOutRows.length} 件商品未计入此合计（含原因）`,`${leftOutRows.length} produk dikecualikan daripada jumlah ini, dengan sebab`)}</summary><div className="ix-table"><table>{measureHead}<tbody>{leftOutRows.map(measureRow)}</tbody></table></div></details>}
          </details>
          <details className="cp3-controls ix-more"><summary>{c('Missing purchase costs: first 10 priorities','缺失采购成本：优先补录前 10 项','Kos belian tiada: 10 keutamaan pertama')}</summary><p>{c('Ranked by potential excess × explicitly matched reference retail price. This reference amount is not an estimated purchase cost. Unmatched items remain listed for manual input.','按潜在过量 × 人工确认对应的参考零售价排序。此参考金额不是采购成本估算。未匹配的商品仍列出供人工补录。','Disusun mengikut lebihan berpotensi × harga runcit rujukan dipadankan secara nyata. Amaun rujukan ini bukan kos belian. Item tanpa padanan kekal untuk input manual.')}</p>
            <ul className="ix-queue">{costQueue.top10.map((r,i)=><li key={r.productKey}><span>{i+1}. {impact.products.find(p=>p.productKey===r.productKey)?.name} · {money(r.referenceRisk)} <small>{r.source}</small></span><button type="button" className="btn btn--ghost btn--small" onClick={()=>reviewProduct(r.productKey,'cost')}>{c('Add cost','补录成本','Tambah kos')}</button></li>)}
              {costQueue.unranked.map(r=><li key={r.productKey}><span>{impact.products.find(p=>p.productKey===r.productKey)?.name} · {c('Unranked: confirm reference or enter purchase cost','未排序：确认参考商品或补录采购成本','Tidak disusun: sahkan rujukan atau masukkan kos belian')}</span><button type="button" className="btn btn--ghost btn--small" onClick={()=>reviewProduct(r.productKey,'cost')}>{c('Add cost','补录成本','Tambah kos')}</button></li>)}</ul>
            {costQueue.remaining.length>0&&<p>{costQueue.remaining.length} {c('more ranked products; the next priorities appear as costs are completed.','个后续排序商品；补录成本后自动显示下一批。','produk berkeutamaan lagi; muncul selepas kos dilengkapkan.')}</p>}
            {!costQueue.top10.length&&!costQueue.unranked.length&&<p>{c('No missing costs for entered orders.','已填写订单均有采购成本。','Tiada kos hilang bagi pesanan dimasukkan.')}</p>}</details>
        </div>
      </section>
    </div>
    </details>

    <details className="sx-card impact__disclosure impact__lines" id="impact-excess-products" ref={excessProducts} open={excessOpen} onToggle={event=>setExcessOpen(event.currentTarget.open)}>
      <summary><span>{c('Products with possible excess stock','可能有多余库存的商品','Produk dengan stok berlebihan berpotensi')}</span><small>{c(`Based on ${assessed.length} of ${impact.products.length} checked products`,`基于 ${impact.products.length} 件商品中 ${assessed.length} 件可核对的商品`,`Berdasarkan ${assessed.length} daripada ${impact.products.length} produk disemak`)}</small></summary>
      {withExcess.length?<ul>{withExcess.map(p=><li key={p.productKey}><span className="impact__lname"><b>{p.name}</b><span className="num">{p.code}</span></span><span className="impact__lunits">{units(p.excessUnits!)} <span>{c('units above expected demand','件高于预期需求','unit melebihi permintaan yang dijangka')}</span>{p.excessCost.state==='estimated'&&<span className="impact__lcost">{money(p.excessCost.amount)}</span>}</span></li>)}</ul>
        :<p className="impact__empty">{assessed.length?c('No potential excess is indicated by the checked plans.','已核对的计划未显示潜在多余库存。','Tiada lebihan berpotensi ditunjukkan oleh pelan yang disemak.'):c('No purchase plan has enough checked evidence yet. Enter planned orders in Step 4.','目前没有足够证据的采购计划。请在第 4 步填写计划订购量。','Belum ada pelan belian dengan bukti yang mencukupi. Masukkan pesanan dirancang dalam Langkah 4.')}</p>}
    </details>

    <details className="sx-card impact__review" ref={review} open={reviewOpen} onToggle={event=>setReviewOpen(event.currentTarget.open)}>
      <summary><span className="impact__review-title">{c('Improve the data behind these estimates','完善这些估算所用的数据','Perbaiki data di sebalik anggaran ini')}</span><small>{c('Category, cost, weight and optional storage guidance','类别、成本、重量及可选储存指导','Kategori, kos, berat dan panduan penyimpanan pilihan')}</small></summary>
      {onContextsChange&&<CategoryConfirmation snapshot={snapshot} products={products} contexts={contexts} onChange={onContextsChange} />}
      <label className="impact__review-product">{c('Product','商品','Produk')} <select value={selected} onChange={e=>{setSelected(e.target.value);setInputFocus(undefined);}}>{products.map(p=><option key={p.key} value={p.key}>{p.title} · {p.sku} · {p.pack}</option>)}</select></label>
      {products.some(p=>p.key===selected)&&onContextChange&&<PlanningInputsPanel key={`${snapshot.id}-${selected}`} snapshot={snapshot} productKey={selected} value={contexts[selected]} focus={inputFocus} onChange={value=>onContextChange(selected,value)} />}
    </details>

    <details className="sx-card impact__review impact__records" ref={records} open={outcomesOpen} onToggle={event=>setOutcomesOpen(event.currentTarget.open)}><summary><span className="impact__review-title">{c('Record what happened','记录实际情况','Rekod apa yang berlaku')}</span><small>{c('Discarded or expired stock, actual sales and stock counts','已丢弃或过期的库存、实际销量与库存盘点','Stok dibuang atau luput, jualan sebenar dan kiraan stok')}</small></summary>
      <label className="impact__review-product">{c('Product for actual records','实际记录的商品','Produk untuk rekod sebenar')} <select value={selected} onChange={event=>{setSelected(event.target.value);setInputFocus(undefined);}}>{products.map(product=><option key={product.key} value={product.key}>{product.title} · {product.sku} · {product.pack}</option>)}</select></label>
      {outcomesOpen && (()=>{const product=products.find(p=>p.key===selected);return product?<DecisionOutcomeControls mode="outcomes" key={`outcomes-${selected}`} datasetId={datasetId} product={product} snapshot={snapshot} plan={plans.find(p=>p.productKey===selected)} onChanged={refresh} />:null;})()}
      {onPurchaseDecision && selected && <button type="button" className="btn btn--ghost" onClick={()=>onPurchaseDecision(selected)}>{c("Review this product's final choice", '核对该商品的最终选择', 'Semak pilihan akhir produk ini')} →</button>}
    </details>

    <details className="sx-card impact__review impact__history">
      <summary><span className="impact__review-title">{c('Compare recorded history across two periods','比较两个期间的历史记录','Bandingkan sejarah direkod merentasi dua tempoh')}</span><small>{c('Recorded waste, saved financial estimates and what happened after each decision','实际报损、已保存的财务估算，以及每项决定之后的情况','Sisa direkod, anggaran kewangan tersimpan dan apa yang berlaku selepas setiap keputusan')}</small></summary>
      <OutcomePeriodComparison key={`${datasetId}-${revision}`} datasetId={datasetId} currentSnapshot={snapshot} />
    </details>

    <details className="sx-card impact__disclosure impact__learn"><summary><span>{c('How these estimates work','这些估算如何得出','Cara anggaran ini dikira')}</span><small>{c('Calculations, the illustrated workflow and sustainability background','计算方法、流程演示与可持续发展背景','Pengiraan, ilustrasi aliran kerja dan latar kemampanan')}</small></summary>
    <section className="sx-sec" aria-labelledby="sx-flow-title">
      <h2 className="sx-h2" id="sx-flow-title">{c('From data to less waste','从数据到少浪费','Dari data ke kurang pembaziran')}</h2>
      <p className="learn__lede">{c('Retail food waste mostly starts with an order that was too big for what sells. This is how StockLess turns your file into a smaller, safer order.','零售店的食物浪费，大多是因为进货比卖得多。StockLess 就是这样把您的文件变成更精准、更稳妥的订单。','Pembaziran makanan di kedai selalunya bermula dengan pesanan yang lebih besar daripada jualan. Beginilah StockLess jadikan fail anda pesanan yang lebih kecil dan selamat.')}</p>
      <ul className="sx-stats">{facts.map(([value,detail,source])=><li key={value}><b className="sx-stat__n">{value}</b><span>{detail}</span><small>{source}</small></li>)}</ul>
      <ol className="sx-flow">
        <li><span className="sx-flow__tag"><ImpactIcon name="data" size={18} /> {c('DATA','数据','DATA')}</span><b className="sx-flow__big">{c(`${units(impact.products.length)} products`,`${units(impact.products.length)} 个商品`,`${units(impact.products.length)} produk`)}</b><span>{c('Weekly sales, stock on hand and the orders you planned.','每周销量、现有库存和您计划的订单。','Jualan mingguan, stok sedia ada dan pesanan yang anda rancang.')}</span></li>
        <li><span className="sx-flow__tag"><ImpactIcon name="warning" size={18} /> {c('PROBLEM','问题','MASALAH')}</span><b className="sx-flow__big">{assessed.length?c(`${units(planned)} planned`,`原计划 ${units(planned)} 件`,`${units(planned)} dirancang`):'—'}</b><span>{assessed.length?c(`Only about ${units(planned-excess)} are expected to sell in the next four weeks.`,`未来四周预计只卖得掉大约 ${units(planned-excess)} 件。`,`Cuma kira-kira ${units(planned-excess)} dijangka laku dalam empat minggu akan datang.`):c('Enter planned orders in Step 4 to compare them with demand.','在第 4 步填写计划订购量即可与需求对比。','Masukkan pesanan dirancang dalam Langkah 4 untuk membandingkannya dengan permintaan.')}</span></li>
        <li><span className="sx-flow__tag"><ImpactIcon name="check" size={18} /> {c('RECOMMENDATION','建议','CADANGAN')}</span><b className="sx-flow__big">{c('Order to demand','按销量进货','Pesan ikut jualan')}</b><span>{c('Keep each order at or below the top of its demand range.','每张订单都不超过预计销量的上限。','Pastikan setiap pesanan tak melebihi had atas jangkaan jualan.')}</span></li>
        <li><span className="sx-flow__tag"><ImpactIcon name="recycle" size={18} /> {c('WASTE PREVENTION','减少浪费','KURANG PEMBAZIRAN')}</span><b className="sx-flow__big">{assessed.length?c(`${units(excess)} fewer`,`少进 ${units(excess)} 件`,`${units(excess)} kurang`):'—'}</b><span>{c('units of potential excess to reconsider before ordering','件潜在多余库存，下单前值得再考虑','unit lebihan berpotensi untuk disemak semula sebelum memesan')}</span></li>
      </ol>
    </section>

    <section className="sx-sec" aria-labelledby="sx-who-title">
      <h2 className="sx-h2" id="sx-who-title">{c('Who feels the difference','谁能感受到改变','Siapa yang rasa perbezaannya')}</h2>
      <ul className="sx-who">
        <li><span className="sx-who__icon" aria-hidden="true"><ImpactIcon name="coins" size={28} /></span><span className="sx-who__who">{c('YOU · THE SHOP OWNER','您 · 店主','ANDA · PEMILIK KEDAI')}</span><b>{c('More cash in the till','钱不会压在货上','Lebih banyak duit dalam laci')}</b><span>{excessCost.state==='estimated'?c(`Less cash tied up in stock that may not sell — about ${money(excessCost.amount)} in this plan, estimated.`,`更少的钱压在可能卖不掉的货上——本计划约 ${money(excessCost.amount)}（估算）。`,`Kurang duit tersangkut pada stok yang mungkin tak laku — kira-kira ${money(excessCost.amount)} dalam pelan ini, anggaran.`):c('Less cash tied up in stock that may not sell. Map Unit cost in Step 2 to see how much in ringgit.','更少的钱压在可能卖不掉的货上。到第 2 步对应进货单价，就能看到多少令吉。','Kurang duit tersangkut pada stok yang mungkin tak laku. Padankan Kos seunit di Langkah 2 untuk lihat jumlahnya dalam ringgit.')}</span></li>
        <li><span className="sx-who__icon" aria-hidden="true"><ImpactIcon name="cart" size={28} /></span><span className="sx-who__who">{c('CUSTOMERS & COMMUNITY','顾客与社区','PELANGGAN & KOMUNITI')}</span><b>{c('Fresher food on the shelf','货架上的东西更新鲜','Barang di rak lebih segar')}</b><span>{c('The same products in stock, with less of it sitting close to expiry.','该有的货都有，只是快过期的少了。','Produk sama tetap ada, cuma kurang yang hampir luput.')}</span></li>
        <li><span className="sx-who__icon" aria-hidden="true"><ImpactIcon name="sprout" size={28} /></span><span className="sx-who__who">{c('ENVIRONMENT','环境','ALAM SEKITAR')}</span><b>{c('Less food in landfill','更少食物被送去填埋','Kurang makanan dibuang ke tapak pelupusan')}</b><span>{assessed.length?c(`${units(excess)} units of potential excess to reconsider before they risk going to waste.`,`${units(excess)} 件潜在多余库存，可在变成浪费前重新考虑。`,`${units(excess)} unit lebihan berpotensi untuk disemak semula sebelum berisiko terbuang.`):c('Enter planned orders in Step 4 to see the stock at risk.','在第 4 步填写计划订购量即可看到有风险的库存。','Masukkan pesanan dirancang dalam Langkah 4 untuk melihat stok berisiko.')}</span></li>
        <li><span className="sx-who__icon" aria-hidden="true"><ImpactIcon name="building" size={28} /></span><span className="sx-who__who">{c('GOVERNMENT & SWCORP','政府与 SWCorp','KERAJAAN & SWCORP')}</span><b>{c('Progress on SDG 12.3','为 SDG 12.3 出一份力','Menyumbang kepada SDG 12.3')}</b><span>{c('Prevention at the shop counter supports the push to cut landfill reliance from 61% to 52% by 2030.','从店里的柜台做起，帮助国家在 2030 年前把填埋依赖从 61% 降到 52%。','Langkah kecil di kaunter kedai membantu usaha kurangkan pergantungan pada tapak pelupusan daripada 61% kepada 52% menjelang 2030.')}</span></li>
      </ul>
    </section>

    <section className="impact__sdg" aria-labelledby="impact-sdg-title">
      <span className="impact__sdg-mark" aria-hidden="true">12</span>
      <div>
        <h2 id="impact-sdg-title">{c('Your contribution to SDG 12.3','您对可持续发展目标 12.3 的贡献','Sumbangan anda kepada SDG 12.3')}</h2>
        <p>{c('Your purchase plan can support SDG 12.3 by helping reduce avoidable food waste at the retail level. StockLess does not claim a measured reduction — it shows potential overstock to review before you order.','您的采购计划可以帮助减少零售环节可避免的食物浪费，从而支持可持续发展目标 12.3。StockLess 并不声称已实现可测量的减少，它显示的是下单前值得检查的潜在过量库存。','Pelan pembelian anda boleh menyokong SDG 12.3 dengan membantu mengurangkan pembaziran makanan yang boleh dielakkan di peringkat runcit. StockLess tidak mendakwa pengurangan yang diukur — ia menunjukkan lebihan stok berpotensi untuk disemak sebelum memesan.')}</p>
        <a className="impact__sdg-link" href="https://sdgs.un.org/goals/goal12" target="_blank" rel="noreferrer noopener">{c('Read about SDG 12','了解可持续发展目标 12','Baca tentang SDG 12')} <span aria-hidden="true">↗</span></a>
      </div>
    </section>

    <section className="learn learn--rows" aria-labelledby="impact-learn-title">
      <h2 className="learn__title" id="impact-learn-title">{c('Understanding your impact','了解影响数据','Memahami impak anda')}</h2>
      <p className="learn__lede">{c('Learn how these numbers are calculated and what they mean.','了解这些数字如何计算，以及它们的含义。','Ketahui cara nombor ini dikira dan apa maksudnya.')}</p>
      <div className="learn__list">{faq.map(([icon,question,answer])=><details className="learn__item" key={icon}><summary className="learn__q"><span className="learn__icon" aria-hidden="true"><ImpactIcon name={icon} size={22} /></span><span className="learn__qtext">{question}</span><span className="learn__chevron" aria-hidden="true" /></summary><p className="learn__a">{answer}</p></details>)}</div>
    </section>
    <p className="impact__method">{c('Method: estimates use the demand range StockLess worked out from your sales rows, the stock figures in your file, and the order quantities you entered. Figures change when your file or your planned orders change.','方法：估算使用 StockLess 根据您的销售记录得出的需求区间、您文件中的库存数字，以及您输入的订购数量。文件或计划订单变动时，数字也会随之变化。','Kaedah: anggaran menggunakan julat permintaan yang StockLess kira daripada baris jualan anda, angka stok dalam fail anda, dan kuantiti pesanan yang anda masukkan. Angka berubah apabila fail atau pesanan yang anda rancang berubah.')}</p>
    </details>
    <div className="impact__actions sx-actions"><button type="button" className="btn btn--ghost" onClick={onBack}>{c('← Back to the purchase plan','← 返回采购计划','← Kembali ke pelan pembelian')}</button>{onNew&&<button type="button" className="btn btn--ghost" onClick={onNew}>{c('Start a new plan','重新规划','Buat pelan baru')}</button>}</div>
  </main>;
}
