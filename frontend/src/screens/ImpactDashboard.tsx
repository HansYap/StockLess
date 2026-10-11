import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { getLocale, t, useLanguage } from '../i18n/index.ts';
import { addCalendarDays, buildEnvironmentalImpact, buildImpactReview, buildMissingCostQueue, buildAnalysisReport, CARBON_MALAYSIA_ILLUSTRATION, evaluateProductPurchasePlan,
  type CarbonImpactKind, type CarbonImpactResult, type CarbonImpactSummary, type DemandForecastReview, type ImpactProduct, type MonetaryFigure, type MonetaryTotal, type PlanningContexts, type ProductPlanningContext, type ReadinessSnapshot, type SupplierOrderTerms } from '../engine.ts';
import { evaluatePurchaseProduct, joinPurchaseEvidence, type PurchaseDrafts } from '../purchase-plan/model.ts';
import { getSavedDataset, savedStockOutcomes, type SavedDataset } from '../storage/saved-datasets.ts';
import { downloadAnalysisWorkbook, downloadPlannedOrdersWorkbook, NoPlannedOrdersError, printAnalysisReport } from '../purchase-plan/analysis-report-export.ts';
import type { ReportLanguageChoice } from '../purchase-plan/report-language.ts';

import { automaticPurchaseDrafts } from '../purchase-plan/suggested-orders.ts';
import { productEstimateDetails, type PlanningDetail } from '../components/product-estimates.ts';
import { ImpactStory, type ImpactTile } from '../components/ImpactStory.tsx';
import { ImpactIcon, type ImpactIconName } from '../components/ImpactIcon.tsx';
import './impact-reference.css';
import '../components/cp3-controls.css';
import '../components/impact-open.css';

interface Props {
  snapshot: ReadinessSnapshot; forecast: DemandForecastReview; drafts: PurchaseDrafts;
  contexts?: PlanningContexts; datasetId?: string; shopName?: string; datasetName?: string;
  supplierDrafts?: Readonly<Record<string, SupplierOrderTerms | undefined>>;
  onContextChange?: (key:string,value:ProductPlanningContext)=>void;
  onContextsChange?: (updates:PlanningContexts)=>void;
  selectedKey?: string | null; onSelect?: (key:string)=>void;
  focus?: { section: ImpactSection; revision: number };
  onProductDetails?: (key:string)=>void;
  onBack:()=>void; onNew?:()=>void;
}
export type ImpactSection = 'downloads';
type BusinessMeasure = 'planned' | 'excess' | 'scenario' | 'difference';
type EnvironmentMeasure = 'potential' | 'scenario';
const EMPTY_CONTEXTS: PlanningContexts = Object.freeze({});

/** Compatibility helper; business calculations are owned by the shared engine. */
export function calculatePotentialExcess(snapshot: ReadinessSnapshot, forecast: DemandForecastReview, drafts: PurchaseDrafts) {
  return buildImpactReview(snapshot,forecast,drafts).products.flatMap(p => p.excessUnits === undefined ? [] : [{key:p.productKey,name:p.name,sku:p.code,available:p.available!,demandHigh:p.demandHigh!,units:p.excessUnits}]);
}

/** Step 5 in the supplied Impact Dashboard design, filled from the same CP3 engine figures as Step 4. */
export function ImpactDashboard({snapshot,forecast,drafts:enteredDrafts,contexts=EMPTY_CONTEXTS,datasetId,shopName,datasetName,supplierDrafts,focus,onProductDetails,onBack,onNew}:Props) {
  const language=useLanguage(), c=(en:string,zh:string,ms:string)=>language==='zh'?zh:language==='ms'?ms:en;
  const n=(v:number)=>v.toLocaleString(getLocale(),{maximumFractionDigits:3});
  const units=(v:number)=>Math.round(v).toLocaleString(getLocale());
  const day=(iso:string)=>new Date(`${iso}T00:00:00Z`).toLocaleDateString(getLocale(),{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const money=(amount:number)=>`MYR ${amount.toFixed(2)}`;
  const co2=(kg:number)=>Math.abs(kg)>=1000?`${(kg/1000).toLocaleString(getLocale(),{maximumFractionDigits:2})} t CO₂e`:`${n(kg)} kg CO₂e`;
  const unavailable=c('Unavailable','不可用','Tidak tersedia'), notEntered=c('Not entered','未输入','Belum dimasukkan');
  const products=useMemo(()=>joinPurchaseEvidence(snapshot,forecast,contexts),[snapshot,forecast,contexts]);
  const drafts=useMemo(()=>automaticPurchaseDrafts(products,enteredDrafts,supplierDrafts??{},snapshot.analysisDate,evaluateProductPurchasePlan).drafts,[products,enteredDrafts,supplierDrafts,snapshot.analysisDate]);
  const plans=useMemo(()=>products.flatMap(p=>{const plan=evaluatePurchaseProduct(p,snapshot.analysisDate,drafts[p.key]??p.fileInputs,evaluateProductPurchasePlan,p.fileExpiry); return plan?[plan]:[];}),[products,snapshot.analysisDate,drafts]);
  const impact=useMemo(()=>buildImpactReview(snapshot,forecast,drafts,undefined,contexts),[snapshot,forecast,drafts,contexts]);
  const costQueue=useMemo(()=>buildMissingCostQueue(snapshot,impact,contexts),[snapshot,impact,contexts]);
  const [saved,setSaved]=useState<SavedDataset>();
  const historyRequest=useRef(0);
  const [error,setError]=useState(''), [noOrders,setNoOrders]=useState(false), [busy,setBusy]=useState(false);
  const [reportLanguage,setReportLanguage]=useState<ReportLanguageChoice>('follow');
  const exportLanguage=reportLanguage==='follow'?language:reportLanguage;
  const [lens,setLens]=useState<'business'|'environment'>('environment');
  const [businessMeasure,setBusinessMeasure]=useState<BusinessMeasure>('planned');
  const [environmentMeasure,setEnvironmentMeasure]=useState<EnvironmentMeasure>('potential');
  const downloads=useRef<HTMLElement>(null);
  const [businessOpen,setBusinessOpen]=useState(false), [environmentOpen,setEnvironmentOpen]=useState(false);
  const excessProducts=useRef<HTMLElement>(null), businessBreakdown=useRef<HTMLDetailsElement>(null), environmentBreakdown=useRef<HTMLDetailsElement>(null);
  const [excessSort,setExcessSort]=useState<'units'|'money'>('units');
  useEffect(()=>{if(focus)requestAnimationFrame(()=>{downloads.current?.scrollIntoView?.({behavior:'smooth',block:'start'});downloads.current?.querySelector<HTMLElement>('button')?.focus({preventScroll:true});});},[focus]);
  useEffect(()=>{let cancelled=false;const request=++historyRequest.current;setSaved(undefined); if(datasetId)void getSavedDataset(datasetId).then(value=>{if(!cancelled&&request===historyRequest.current)setSaved(value);}).catch(()=>{if(!cancelled&&request===historyRequest.current)setError(c('Saved history could not be read.','无法读取已保存记录。','Sejarah tersimpan tidak dapat dibaca.'));});return()=>{cancelled=true;};},[datasetId]);
  const outcomes=useMemo(()=>saved?savedStockOutcomes(saved):[],[saved]);
  const environmental=useMemo(()=>buildEnvironmentalImpact(snapshot,impact,contexts,outcomes,{datasetId}),[snapshot,impact,contexts,outcomes,datasetId]);
  const monetary=(total:MonetaryTotal|MonetaryFigure)=>total.state==='estimated'?money(total.amount):total.state==='not_entered'?notEntered:unavailable;
  const carbon=(summary:CarbonImpactSummary)=>summary.state==='estimated'?`≈ ${co2(summary.kgCO2e!)}`:unavailable;

  // One set of derived figures feeds the story, both lenses and the FAQ examples.
  const assessed=impact.products.filter(p=>p.excessUnits!==undefined);
  const missingImpactDetails=useMemo(()=>{
    const eligible=new Set(impact.products.filter(p=>p.excessUnits!==undefined).map(p=>p.productKey));
    return products.flatMap(product=>{
      if(!eligible.has(product.key))return [];
      const missing=productEstimateDetails(snapshot,product.key,product.planningContext).missing;
      return missing.length?[{product,missing}]:[];
    });
  },[products,snapshot,impact]);
  const detailLabel=(field:PlanningDetail)=>field==='cost'?c('purchase cost','采购成本','kos belian'):field==='category'?c('food category','食品类别','kategori makanan'):c('weight per unit','单位重量','berat seunit');
  const lines=assessed.map(p=>({key:p.productKey,name:p.name,sku:p.code,available:p.available!,demandHigh:p.demandHigh!,units:p.excessUnits!}));
  const excess=assessed.reduce((sum,p)=>sum+p.excessUnits!,0);
  const planned=assessed.reduce((sum,p)=>sum+Math.max(0,p.available!),0);
  const withExcess=[...assessed].filter(p=>p.excessUnits!>0).sort((a,b)=>b.excessUnits!-a.excessUnits!);
  const excessCost=impact.totals.excessCost, potential=environmental.potential;
  const sample=snapshot.sourceMode==='sample';
  const anyCost=(snapshot.productCosts??[]).some(cost=>cost.state==='usable');
  const queue=potential.confirmationQueue;
  const costHint=!assessed.length?c('No reliable purchase check is available for these products yet.','这些商品暂没有可靠的采购检查结果。','Belum ada semakan belian yang boleh dipercayai bagi produk ini.')
    :!anyCost?c('Purchase cost is unavailable. Stock and demand results remain available.','采购成本暂不可用，库存和需求结果仍可使用。','Kos belian tidak tersedia. Hasil stok dan permintaan masih tersedia.')
    :c('No usable purchase cost for the checked products.','已检查商品没有可用的采购成本。','Tiada kos belian boleh digunakan bagi produk disemak.');
  const emissionsHint=!assessed.length?c('No reliable purchase check is available for these products yet.','这些商品暂没有可靠的采购检查结果。','Belum ada semakan belian yang boleh dipercayai bagi produk ini.')
    :queue.length?c('No supported automatic CO₂e estimate for these products yet. Stock and money results remain available.','这些商品暂没有支持的自动 CO₂e 估算。库存和金额结果仍可使用。','Tiada anggaran CO₂e automatik disokong bagi produk ini. Hasil stok dan wang masih tersedia.')
    :c('No supported category, weight or emission factor for these products yet.','这些商品暂缺支持的类别、重量或排放因子。','Belum ada kategori, berat atau faktor pelepasan disokong bagi produk ini.');
  const businessTile:ImpactTile=excessCost.state==='estimated'?{value:money(excessCost.amount),note:c(`From ${excessCost.includedCount} of ${assessed.length} checked products`,`来自 ${assessed.length} 件已核对商品中的 ${excessCost.includedCount} 件`,`Daripada ${excessCost.includedCount} daripada ${assessed.length} produk disemak`)}:{note:costHint};
  const emissionsTile:ImpactTile=potential.state==='estimated'&&potential.includedProductCount*4<potential.totalProductCount?{value:c('Need more data','需要更多数据','Perlu lebih data'),note:c(`Only ${potential.includedProductCount} of ${potential.totalProductCount} products have an emission factor yet`,`${potential.totalProductCount} 件商品中目前只有 ${potential.includedProductCount} 件有排放因子`,`Hanya ${potential.includedProductCount} daripada ${potential.totalProductCount} produk mempunyai faktor pelepasan setakat ini`)}:potential.state==='estimated'?{value:`≈ ${co2(potential.kgCO2e!)}`,note:c(`From ${potential.includedProductCount} of ${potential.totalProductCount} products`,`来自 ${potential.totalProductCount} 件商品中的 ${potential.includedProductCount} 件`,`Daripada ${potential.includedProductCount} daripada ${potential.totalProductCount} produk`)}:{note:emissionsHint};

  const reveal=(target:HTMLElement|null)=>{target?.scrollIntoView?.({behavior:'smooth',block:'start'});target?.querySelector<HTMLElement>('summary,button')?.focus({preventScroll:true});};
  const openBusinessProducts=(measure:BusinessMeasure)=>{setBusinessMeasure(measure);setBusinessOpen(true);setLens('business');requestAnimationFrame(()=>reveal(businessBreakdown.current));};
  const openEnvironmentProducts=(measure:EnvironmentMeasure)=>{setEnvironmentMeasure(measure);setEnvironmentOpen(true);setLens('environment');requestAnimationFrame(()=>reveal(environmentBreakdown.current));};
  const openExcessProducts=()=>requestAnimationFrame(()=>reveal(excessProducts.current));
  const switchTab=(event:KeyboardEvent<HTMLButtonElement>)=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'environment':event.key==='End'?'business':lens==='business'?'environment':'business';setLens(next);document.getElementById(`${next}-tab`)?.focus();};
  const reviewProduct=(key:string)=>onProductDetails?.(key);
  const makeReport=(history=saved)=>{const reportOutcomes=history?savedStockOutcomes(history):[];
    const reportEnvironment=history===saved?environmental:buildEnvironmentalImpact(snapshot,impact,contexts,reportOutcomes,{datasetId});
    return buildAnalysisReport({snapshot,forecast,plans,impact,datasetId:datasetId??'sample-preview',shopName,datasetName,
    outcomes:reportOutcomes,carbonResults:[...reportEnvironment.actualResults,...reportEnvironment.potentialResults,...reportEnvironment.scenarioResults],
    supplierScenariosByProduct:Object.fromEntries(Object.entries(supplierDrafts??{}).filter((entry):entry is [string,SupplierOrderTerms]=>!!entry[1]).map(([key,terms])=>[key,[{id:'current-terms',name:'Entered supplier terms',terms}]]))});};
  const currentReport=async()=>{const request=++historyRequest.current, history=datasetId?await getSavedDataset(datasetId):undefined;if(datasetId&&!history)throw new Error(c('Saved records could not be read. Reopen this dataset and try again.','无法读取已保存的记录。请重新打开此数据集后重试。','Rekod disimpan tidak dapat dibaca. Buka semula set data ini dan cuba lagi.'));if(history&&request===historyRequest.current)setSaved(history);return makeReport(history);};
  const fail=(e:unknown)=>{setNoOrders(e instanceof NoPlannedOrdersError);setError(e instanceof NoPlannedOrdersError?c('No planned orders. Enter a positive quantity in Purchase plan.','没有计划订单。请在采购计划中填写大于零的数量。','Tiada pesanan dirancang. Masukkan kuantiti positif dalam Pelan belian.'):e instanceof Error?t(e.message):unavailable);};
  const download=async(finalOnly=false)=>{const target=exportLanguage;setError('');setNoOrders(false);setBusy(true);try{const report=await currentReport();if(finalOnly)await downloadPlannedOrdersWorkbook(report,target);else await downloadAnalysisWorkbook(report,target);}catch(e){fail(e);}finally{setBusy(false);}};
  const pdf=async()=>{const target=exportLanguage;setError('');setNoOrders(false);setBusy(true);try{const {downloadAnalysisPdf}=await import('../purchase-plan/analysis-report-pdf.ts');await downloadAnalysisPdf(await currentReport(),target);}catch(e){fail(e);}finally{setBusy(false);}};
  const baselineOf=(kind:CarbonImpactKind)=>kind==='potential_excess'?c('the top of the expected four-week demand range','预期四周需求区间的上限','had atas julat permintaan empat minggu dijangka'):'';
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
  const spendDifference=impact.totals.spendDifference;
  const differenceTitle=spendDifference.state!=='estimated'
    ? c('Suggested-order cost comparison','建议订单成本比较','Perbandingan kos pesanan dicadangkan')
    : spendDifference.amount<0
      ? c('Suggested orders would cost more','建议订单预计花费更多','Pesanan dicadangkan akan menelan belanja lebih tinggi')
      : spendDifference.amount>0
        ? c('Suggested orders would cost less','建议订单预计花费更少','Pesanan dicadangkan akan menelan belanja lebih rendah')
        : c('Suggested orders would cost the same','建议订单预计花费相同','Pesanan dicadangkan akan menelan belanja yang sama');
  const businessCard=(id:BusinessMeasure,title:string,total:MonetaryTotal)=><div className={`ix-card ix-card--${id}${businessOpen&&businessMeasure===id?' ix-card--on':''}`} key={id}>
    <span className="ix-card__k">{title}</span><b>{id==='difference'&&total.state==='estimated'?money(Math.abs(total.amount)):monetary(total)}</b><small>{id==='difference'&&total.state==='estimated'
      ? c(`Compared with your plan · same ${total.includedCount} ${total.includedCount===1?'product':'products'}`, `与当前计划比较 · 相同的 ${total.includedCount} 件商品`, `Berbanding pelan anda · ${total.includedCount} produk yang sama`)
      : `${c('Products included','计入商品','Produk termasuk')}: ${total.includedCount}/${impact.products.length}`}</small>
    {total.state!=='estimated'&&whyUnavailable(total.reason,c('Available stock and demand results are shown separately. Purchase cost is an optional correction in Purchase plan.','库存和需求结果单独显示。采购成本可在采购计划中选填修正。','Hasil stok dan permintaan tersedia ditunjukkan berasingan. Kos belian ialah pembetulan pilihan dalam pelan belian.'))}
    <button type="button" className="ix-card__open" aria-pressed={businessMeasure===id} aria-expanded={businessOpen&&businessMeasure===id} aria-controls="business-breakdown" onClick={()=>openBusinessProducts(id)}>{businessOpen&&businessMeasure===id?c('Showing products ↓','正在显示商品 ↓','Memaparkan produk ↓'):c('See products','查看商品','Lihat produk')}</button>
  </div>;
  const environmentCard=(id:EnvironmentMeasure,title:string,summary:CarbonImpactSummary,quantity:string)=><div className={`ix-card ix-card--env-${id}${environmentOpen&&environmentMeasure===id?' ix-card--on':''}`} key={id}>
    <span className="ix-card__k">{title}</span><b>{carbon(summary)}</b><small>{c('Contributing products','计入商品','Produk menyumbang')}: {summary.includedProductCount}/{summary.totalProductCount}</small>
    {summary.massKg!==undefined&&<span className="ix-card__mass">{n(summary.massKg)} kg · {c('Source-agreement mass / estimated-factor mass','来源一致重量／估算因子重量','Jisim sumber bersetuju / faktor anggaran')}: {n(summary.massKgSourcesAgree)} / {n(summary.massKgEstimate)} kg</span>}
    <span className="ix-card__qty">{quantity}</span>
    {summary.state==='unavailable'&&whyUnavailable(summary.reason,c('Other stock and money estimates remain available.','其他库存和金额估算仍可使用。','Anggaran stok dan wang lain masih tersedia.'))}
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
  const measureTitle={planned:c('Your planned spend, product by product','各商品计划采购支出','Perbelanjaan belian dirancang mengikut produk'),excess:c('Excess-stock cost by product','各商品过量库存成本','Kos stok berlebihan mengikut produk'),scenario:c('Restock scenario spend by product','各商品补货情景支出','Belanja senario stok semula mengikut produk'),difference:c('Purchase-spend difference by product','各商品采购支出差异','Perbezaan belanja belian mengikut produk')}[businessMeasure];
  const environmentResults=environmentMeasure==='potential'?environmental.potentialResults:environmental.scenarioResults;
  const faq:readonly [ImpactIconName,string,string][]=[
    ['search',c('How is potential excess estimated?','潜在多余库存是怎么估算的？','Bagaimana lebihan berpotensi dianggarkan?'),c(`For each product StockLess could judge, it takes the stock you would hold after your planned order and subtracts the top of the expected four-week demand range. Anything above that figure is stock you are unlikely to sell inside four weeks. In this plan: ${units(excess)} units across ${withExcess.length} of ${assessed.length} checked products. Products without a planned order, demand range or usable stock count are left out, not counted as zero.`,`对于 StockLess 能够判断的每件商品，用下单后将持有的库存减去预期四周需求区间的上限，超出部分就是四周内不太可能卖完的库存。本计划：${assessed.length} 件已核对商品中有 ${withExcess.length} 件，共 ${units(excess)} 件。没有计划订单、需求区间或可用库存盘点的商品会被排除，而不是计为零。`,`Bagi setiap produk yang StockLess dapat nilai, stok selepas pesanan dirancang ditolak dengan had atas julat permintaan empat minggu. Lebihan itu ialah stok yang mungkin tidak terjual dalam empat minggu. Dalam pelan ini: ${units(excess)} unit merentasi ${withExcess.length} daripada ${assessed.length} produk disemak. Produk tanpa pesanan dirancang, julat permintaan atau kiraan stok yang sah dikecualikan, bukan dikira sifar.`)],
    ['coins',c('How are the money figures calculated?','金额是怎么计算的？','Bagaimana angka wang dikira?'),c(`Each quantity is multiplied by the unit cost Step 3 validated from your file, or the purchase cost you entered in Step 4. The purchase-spend difference is your planned spend minus the restock-scenario spend for the same products; it is an estimate, not achieved savings or profit. Products without a usable cost are left out of totals, never priced at a guess. In this plan the excess-stock cost is ${monetary(excessCost)}.`,`每个数量乘以第 3 步从文件验证的单位成本，或您在第 4 步填写的采购成本。采购支出差异＝同一批商品的计划支出－补货情景支出，属于估算，不是已实现的节省或利润。没有可用成本的商品不计入合计，绝不凭猜测定价。本计划的过量库存成本为 ${monetary(excessCost)}。`,`Setiap kuantiti didarab dengan kos seunit yang disahkan dalam Langkah 3 daripada fail anda, atau kos belian yang anda masukkan dalam Langkah 4. Perbezaan belanja ialah belanja dirancang tolak belanja senario stok semula bagi produk yang sama; ia anggaran, bukan penjimatan atau keuntungan sebenar. Produk tanpa kos yang sah dikecualikan, tidak sekali-kali diteka. Dalam pelan ini kos stok berlebihan ialah ${monetary(excessCost)}.`)],
    ['cloud',c('What does CO₂e mean, and how is it estimated?','CO₂e 是什么意思？怎么估算？','Apakah maksud CO₂e dan bagaimana ia dianggarkan?'),c(`CO₂e (carbon dioxide equivalent) puts several greenhouse gases into one figure. StockLess converts units to kilograms using your file's weight, the pack size or a weight you enter, then multiplies by a factor for the supported automatic or chosen food category from four published sources (farm to retail). A figure is shown only when the sources agree, or as a labelled estimate when their median is within ×2 of every source. Potential excess in this plan: ${potential.state==='estimated'?`≈ ${co2(potential.kgCO2e!)}`:'not yet available'}.`,`CO₂e（二氧化碳当量）把多种温室气体合成一个数字。StockLess 用文件中的重量、包装规格或您填写的重量把件数换算成公斤，再乘以支持的自动匹配或选定食品类别在四个公开数据源（从农场到零售）中的系数。只有在来源一致时才显示，或在中位数与每个来源相差不超过 2 倍时标注为估算。本计划潜在多余库存：${potential.state==='estimated'?`≈ ${co2(potential.kgCO2e!)}`:'暂时无法计算'}。`,`CO₂e (setara karbon dioksida) menggabungkan beberapa gas rumah hijau dalam satu angka. StockLess menukar unit kepada kilogram menggunakan berat dalam fail, saiz pek atau berat yang anda masukkan, kemudian mendarab dengan faktor kategori makanan automatik disokong atau dipilih daripada empat sumber terbitan (ladang hingga runcit). Angka hanya ditunjukkan apabila sumber bersetuju, atau sebagai anggaran berlabel apabila median dalam ×2 setiap sumber. Lebihan berpotensi dalam pelan ini: ${potential.state==='estimated'?`≈ ${co2(potential.kgCO2e!)}`:'belum tersedia'}.`)],
    ['puzzle',c('What happens when data is missing?','缺少数据时会怎样？','Apa berlaku apabila data tiada?'),c(`A missing cost, weight, category or planned order stays “Unavailable” or “Not entered” — never zero. Every total says how many products it includes, and the products left out show their reason and what to do next. Right now ${impact.excludedCount} of ${impact.products.length} products are left out of the plan-based figures.`,`缺少成本、重量、类别或计划订单时，显示“不可用”或“未输入”，绝不当作零。每个合计都会说明计入了多少商品，被排除的商品会显示原因和下一步。目前 ${impact.products.length} 件商品中有 ${impact.excludedCount} 件未计入基于计划的数字。`,`Kos, berat, kategori atau pesanan dirancang yang tiada kekal “Tidak tersedia” atau “Belum dimasukkan” — tidak pernah sifar. Setiap jumlah menyatakan bilangan produk yang dikira, dan produk yang dikecualikan menunjukkan sebab serta langkah seterusnya. Kini ${impact.excludedCount} daripada ${impact.products.length} produk dikecualikan daripada angka berasaskan pelan.`)],
    ['target',c('Are these figures exact?','这些数字精确吗？','Adakah angka ini tepat?'),c('No. They are estimates based on the sales, stock and purchase data in your file, and they are meant to support your decision rather than to report a verified outcome. A longer and cleaner sales history gives a steadier estimate; a short or patchy one gives a rougher estimate.','不精确。它们是根据您文件中的销售、库存和采购数据做出的估算，用于辅助您做决定，而不是报告经过验证的结果。销售历史越长、越干净，估算越稳定；记录短或不完整，估算就越粗略。','Tidak. Ia ialah anggaran berdasarkan data jualan, stok dan pembelian dalam fail anda, dan ia bertujuan menyokong keputusan anda, bukan melaporkan hasil yang disahkan. Sejarah jualan yang lebih panjang dan lebih bersih memberikan anggaran yang lebih mantap; yang pendek atau berlubang memberikan anggaran yang lebih kasar.')],
  ];
  const facts:readonly [string,string,string][]=[
    ['40.03%',c('of Malaysia’s 36,900 tonnes of daily solid waste is food','马来西亚每天 36,900 吨固体垃圾中是食物','daripada 36,900 tan sisa pepejal harian di Malaysia ialah makanan'),c('SWCorp, via Achariam 2026','SWCorp，引自 Achariam 2026','SWCorp, melalui Achariam 2026')],
    ['80.5%',c('of retail food returns are caused by expiry','的零售食品退货是因为过期','pemulangan makanan di kedai berpunca daripada barang luput'),c('Vijayan et al., 2014','Vijayan 等，2014','Vijayan et al., 2014')],
    ['62.7%',c('of Klang Valley food retailers send leftover food to landfill','的巴生谷食品零售商把剩余食物送去填埋场','peruncit makanan di Lembah Klang buang lebihan makanan ke tapak pelupusan'),c('Vijayan et al., 2014','Vijayan 等，2014','Vijayan et al., 2014')],
    ['8.6%',c('of global food-system emissions come from food waste at end of life','的全球食品系统碳排放来自被丢弃的食物','pelepasan sistem makanan dunia datang daripada sisa makanan yang dibuang'),c('Crippa et al., 2021','Crippa 等，2021','Crippa et al., 2021')],
  ];
  const head:ReactNode=<>
    <p className="eyebrow"><ImpactIcon name="globe" size={16} className="growth-icon--inline" /> {c('Your purchase plan → your impact','您的进货计划 → 带来的改变','Pelan belian anda → impaknya')}{sample&&<span className="pill pill--amber impact__sample">{c('Sample data','示例数据','Data contoh')}</span>}</p>
    <h1 data-guide="impact-summary" className="impact__title" id="impact-title">{c('See the impact of your purchase plan','看看这次进货计划带来的改变','Lihat impak pelan belian anda')}</h1>
    <p className="impact__lede">{c('Projected for your current purchase plan over the next four weeks, from your sales and order data. These are estimates of waste risk avoided, not measured waste; record outcomes to compare real results.','根据您的销售和订单数据，对当前采购计划未来四周的预估。这些是可避免浪费风险的估算，并非实际测得的浪费；记录实际结果即可对比真实情况。','Unjuran bagi pelan belian semasa anda untuk empat minggu akan datang, daripada data jualan dan pesanan anda. Ini anggaran risiko pembaziran yang dapat dielakkan, bukan pembaziran yang diukur; rekod hasil sebenar untuk membandingkan keputusan.')}</p>
  </>;

  const about:ReactNode=<aside className="impact__about" aria-labelledby="impact-about-title"><h2 id="impact-about-title">{c('About this plan','关于此计划','Tentang pelan ini')}</h2><dl>
      <div><dt>{c('Shop','店铺','Kedai')}</dt><dd>{shopName&&shopName!=='My store'?shopName:shopName?c('Your store','您的店铺','Kedai anda'):c('Shop not named','未命名店铺','Kedai belum dinamakan')}</dd></div>
      <div><dt>{c('Dataset','数据集','Set data')}</dt><dd>{datasetName||snapshot.sourceName}</dd></div>
      <div><dt>{c('Analysis date','分析日期','Tarikh analisis')}</dt><dd>{day(snapshot.analysisDate)}</dd></div>
      <div className="is-wide"><dt>{c('Planning period','规划期间','Tempoh perancangan')}</dt><dd>{day(snapshot.analysisDate)} – {day(addCalendarDays(snapshot.analysisDate,27))}</dd></div>
  </dl></aside>;
  const secHead=(icon:ImpactIconName,id:string,title:string,sub:string,extra?:ReactNode,amber=false)=><div className="impact-sec__head"><span className={`impact-sec__icon${amber?' impact-sec__icon--amber':''}`} aria-hidden="true"><ImpactIcon name={icon} size={24} /></span><div className="impact-sec__titles"><h2 id={id}>{title}</h2><p>{sub}</p></div>{extra}</div>;
  const excessRows=[...withExcess].sort((a,b)=>excessSort==='money'?(b.excessCost.state==='estimated'?b.excessCost.amount:-1)-(a.excessCost.state==='estimated'?a.excessCost.amount:-1):b.excessUnits!-a.excessUnits!);
  const maxExcess=Math.max(1,...withExcess.map(p=>p.excessUnits!));

  const detailedEstimates =
    <section className="impact-sec impact__analysis" aria-labelledby="impact-analysis-title">
      {secHead('calc','impact-analysis-title',c('Your numbers in detail','详细估算及计算方法','Anggaran terperinci dan cara ia dikira'),c('What your plan may cost and waste, and how we worked it out','更详细的数字，以及计算方式','Angka dengan lebih terperinci, dan cara ia dikira'))}
    <h3 className="impact-sec__sub">{c('Choose a view','选择视图','Pilih paparan')}</h3>
    <div className="sx-lens">
      <div className="sx-tabs" data-guide="impact-views" role="tablist" aria-label={c('Impact view','影响视图','Paparan impak')}>
        <button type="button" role="tab" id="environment-tab" className="sx-tab" aria-controls="environment-impact" aria-selected={lens==='environment'} tabIndex={lens==='environment'?0:-1} onKeyDown={switchTab} onClick={()=>setLens('environment')}><ImpactIcon name="sprout" size={18} /> {c('Environmental','环境','Alam sekitar')}</button>
        <button type="button" role="tab" id="business-tab" className="sx-tab" aria-controls="business-impact" aria-selected={lens==='business'} tabIndex={lens==='business'?0:-1} onKeyDown={switchTab} onClick={()=>setLens('business')}><ImpactIcon name="coins" size={18} /> {c('Business','生意','Perniagaan')}</button>
      </div>
      <section id="environment-impact" role="tabpanel" aria-labelledby="environment-tab" hidden={lens!=='environment'}>
        <div className="ix-body">
          <p className="ix-sub">{c('Measured separately, never added together. Values are kg CO₂e.','分开计算，从不相加。单位为公斤 CO₂e。','Diukur berasingan, tidak pernah dijumlahkan. Nilai dalam kg CO₂e.')}</p>
          <div className="ix-cards ix-cards--two">
            {environmentCard('potential',c('Potential excess: estimated CO₂e','潜在过量：CO₂e 估算','Lebihan berpotensi: anggaran CO₂e'),potential,`${assessed.length?units(excess):'—'} ${c('sales units above expected demand','销售单位超出预期需求','unit jualan melebihi permintaan dijangka')}`)}
            {environmentCard('scenario',c('Named scenario difference','当前计划与补货情景差异','Perbezaan senario dinamakan'),environmental.scenario,c('Your planned order minus the restock recommendation','您的计划订单减去补货建议','Pesanan dirancang tolak cadangan stok semula'))}
          </div>
          <details className="cp3-controls ix-more"><summary>{c('How we estimate emissions','CO₂e 估算的计算方法','Cara anggaran CO₂e dikira')}</summary>
          {potential.state==='estimated'&&<p>{c('Potential excess estimate range','潜在过量估算区间','Julat anggaran lebihan berpotensi')}: {co2(potential.kgCO2eRange!.low)} – {co2(potential.kgCO2eRange!.high)}</p>}
          <p>{c('CP3 v2: agreeing-group mean; otherwise median only within ×2 of every source, labelled estimate. Single-source factors are excluded. No consumer stage. Supported automatic categories are labelled AI estimates.','CP3 v2：一致来源组取均值；否则，仅当中位数与每个来源均在 ×2 内时显示估算。单一来源不显示。排除消费者阶段，支持的自动类别标记为 AI 估算。','CP3 v2: min kumpulan sumber bersetuju; jika tidak, median hanya apabila dalam ×2 setiap sumber, berlabel anggaran. Faktor satu sumber dan peringkat pengguna dikecualikan. Kategori automatik disokong dilabel anggaran AI.')}</p>
          <p>{c('The scenario compares potential excess under your current order with the restock recommendation. Positive means potentially less excess; negative means more. It is not a measured reduction.','情景比较当前采购与补货建议下的潜在过量。正值表示可能减少，负值表示可能增加，不代表实测减排。','Senario membandingkan lebihan berpotensi pesanan semasa dengan cadangan stok semula. Positif mungkin kurang; negatif lebih. Ia bukan pengurangan diukur.')}</p>
          </details>
          {queue.length>0 && <details className="cp3-controls ix-more"><summary>{c('Products outside the CO₂e estimate','未计入 CO₂e 估算的商品','Produk di luar anggaran CO₂e')} ({queue.length})</summary><p>{c('These products could not be matched reliably. Available stock and money figures still include eligible products.','这些商品未能可靠匹配。可用库存及金额仍计入符合条件的商品。','Produk ini tidak dapat dipadankan dengan pasti. Angka stok dan wang tersedia tetap mengira produk layak.')}</p><ul>{queue.map(row=><li key={row.productKey}>{row.productName??row.productKey}</li>)}</ul></details>}
          <p className="ix-note">{c('Forecast period: the next 28 days from the analysis date. These estimates describe potential excess under your current purchase plan.','预测期间：分析日起未来 28 天。这些估算反映当前采购计划下可能出现的多余库存。','Tempoh ramalan: 28 hari selepas tarikh analisis. Anggaran ini menerangkan lebihan berpotensi berdasarkan pelan belian semasa anda.')}</p>
          <details className="ix-breakdown" id="environment-breakdown" ref={environmentBreakdown} aria-live="polite" open={environmentOpen} onToggle={event=>setEnvironmentOpen(event.currentTarget.open)}><summary>{environmentMeasure==='potential'?c('Why these estimates? Potential excess by product','这些估算如何得出？各商品潜在过量','Mengapa anggaran ini? Lebihan berpotensi mengikut produk'):c('Scenario difference by product','各商品情景差异','Perbezaan senario mengikut produk')}</summary>
            {breakdown(environmentResults)}
          </details>
          <details className="cp3-controls ix-more"><summary>{c('Comparison and sustainability notes','比较与可持续发展说明','Nota perbandingan dan kemampanan')}</summary>
          <p className="ix-note">{c('Illustrative comparison only','仅作直观比较','Perbandingan ilustrasi sahaja')}: {potential.kgCO2e===undefined?unavailable:`${n(potential.kgCO2e/CARBON_MALAYSIA_ILLUSTRATION.kgCO2ePerPersonPerDay)} ${c('Malaysia person-days','马来西亚人均排放天数','hari-orang Malaysia')}`} · 29.95 kg CO₂e/{c('person/day','人／天','orang/hari')} · {CARBON_MALAYSIA_ILLUSTRATION.source}. {c('All sectors; not a food-waste reduction baseline.','包括所有行业，不是食品浪费减排基线。','Semua sektor; bukan garis dasar pengurangan pembaziran makanan.')}</p>
          <p className="ix-note">{c('SDG 12.3 aims to halve food waste at the retail and consumer level by 2030. These CO₂e figures describe the possible effect of potential excess; they do not prove an achieved emissions reduction.','SDG 12.3 目标是在 2030 年前将零售和消费环节的食物浪费减半。这些 CO₂e 数字说明潜在多余库存可能带来的影响，并不证明已实现减排。','SDG 12.3 menyasarkan pembaziran makanan di peringkat runcit dan pengguna dikurangkan separuh menjelang 2030. Angka CO₂e ini menerangkan kesan yang mungkin daripada lebihan berpotensi; ia tidak membuktikan pengurangan pelepasan yang tercapai.')}</p>
          </details>
        </div>
      </section>
      <section id="business-impact" role="tabpanel" aria-labelledby="business-tab" hidden={lens!=='business'}>
        <details className="cp3-controls ix-more"><summary>{c('How we work out the cost of excess stock','多余库存成本的计算方法','Cara kos stok berlebihan dikira')}</summary><div className="sx-panel sx-panel--biz">
          <div>
            {excessCost.state==='estimated'?<><p className="sx-eq__head">{c('Excess units × validated unit cost','多余数量 × 已验证单位成本','Unit berlebihan × kos seunit disahkan')}</p>
              <ul className="sx-eq">{withExcess.filter(p=>p.excessCost.state==='estimated').map(p=><li key={p.productKey}><span>{p.name} <span className="num">{p.code}</span></span><span className="sx-eq__m"><b>{units(p.excessUnits!)}</b> × {p.excessCost.state==='estimated'?money(p.excessCost.unitCost):''}</span><span className="sx-eq__r">{monetary(p.excessCost)}</span></li>)}</ul>
              <div className="sx-eq__total"><span>{c('Total excess-stock cost','过量库存成本合计','Jumlah kos stok berlebihan')}</span><b>{money(excessCost.amount)}</b></div></>
              :<><p className="sx-big sx-big--locked">{c('Not yet available','暂时无法计算','Belum tersedia')}</p><p className="sx-sub">{costHint}</p></>}
          </div>
          <p className="sx-note">{c('Money is shown only from a unit cost Step 3 could confirm, or a purchase cost you entered. StockLess never guesses a price.','只有第 3 步确认过的单价或您填写的采购成本才会用来算钱，StockLess 绝不乱猜价格。','Nilai wang hanya ditunjukkan daripada kos seunit yang disahkan di Langkah 3, atau kos belian yang anda masukkan. StockLess tak pernah teka harga.')}</p>
        </div></details>
        <div className="ix-body">
          <p className="ix-sub">{c(`Prices in MYR · Your planned order compared with the StockLess suggested order · ${day(snapshot.analysisDate)} – ${day(addCalendarDays(snapshot.analysisDate,27))}`,`币种：MYR · 比较基线：当前计划订单与补货建议 · 期间：${day(snapshot.analysisDate)} – ${day(addCalendarDays(snapshot.analysisDate,27))}`,`Mata wang: MYR · Dibandingkan: pesanan dirancang semasa dengan cadangan stok semula · Tempoh: ${day(snapshot.analysisDate)} – ${day(addCalendarDays(snapshot.analysisDate,27))}`)}</p>
          <div className="ix-cards ix-cards--four">
            {businessCard('planned',c('Your planned spend','计划采购支出','Perbelanjaan belian dirancang'),impact.totals.plannedSpend)}
            {businessCard('excess',c('Cost of excess stock','过量库存成本','Kos stok berlebihan'),impact.totals.excessCost)}
            {businessCard('scenario',c('Spend if you follow our suggestion','补货情景支出','Belanja senario stok semula'),impact.totals.scenarioSpend)}
            {businessCard('difference',differenceTitle,spendDifference)}
          </div>
          <details className="cp3-controls ix-more"><summary>{c('How these amounts compare','金额之间如何比较','Cara angka wang dibandingkan')}</summary>
          <p>{c('The comparison card shows how much more or less the suggested orders would cost than your current orders, using the same products. In the product breakdown, positive differences mean lower suggested costs; negative differences mean higher suggested costs. These are estimates, not achieved savings or profit.','比较卡片显示同一批商品的建议订单比当前订单预计多花或少花多少。在商品明细中，正差额表示建议成本更低，负差额表示建议成本更高。这些是估算，并非已实现的节省或利润。','Kad perbandingan menunjukkan berapa banyak lebih atau kurang kos pesanan dicadangkan berbanding pesanan semasa, bagi produk yang sama. Dalam pecahan produk, perbezaan positif bermakna kos cadangan lebih rendah; perbezaan negatif bermakna kos cadangan lebih tinggi. Ini ialah anggaran, bukan penjimatan atau keuntungan yang dicapai.')}</p>
          <p className="ix-note">{c('Current planned spend for comparable products','参与情景比较的当前采购支出','Belanja dirancang semasa bagi produk boleh dibandingkan')}: {monetary(impact.totals.comparisonPlannedSpend)} · {impact.totals.comparisonPlannedSpend.includedCount}/{impact.products.length}. {c('Compare this subtotal with the restock scenario above. Other costed orders remain in total planned spend.','此小计与上方补货情景比较；其他已有成本的订单仍计入总计划支出。','Bandingkan jumlah kecil ini dengan senario stok semula di atas. Pesanan lain dengan kos kekal dalam jumlah belanja dirancang.')}</p>
          <p className="ix-note">{c('Potential excess','潜在过量库存','Lebihan berpotensi')}: {impact.assessedCount?n(excess):unavailable} {c('sales units','销售单位','unit jualan')} · {impact.assessedCount}/{impact.products.length} {c('assessed','已评估','dinilai')}</p>
          </details>
          <details className="ix-breakdown" id="business-breakdown" ref={businessBreakdown} aria-live="polite" open={businessOpen} onToggle={event=>setBusinessOpen(event.currentTarget.open)}><summary>{measureTitle}</summary>
            {includedRows.length?<div className="ix-table"><table>{measureHead}<tbody>{includedRows.map(measureRow)}</tbody></table></div>:<p className="impact__empty">{c('No product is included yet: this total is Unavailable, not zero.','尚无商品计入：此合计为不可用，而不是零。','Belum ada produk dikira: jumlah ini Tidak tersedia, bukan sifar.')}</p>}
            {leftOutRows.length>0&&<details className="ix-left-out" open={!includedRows.length||undefined}><summary>{c(`${leftOutRows.length} products left out of this total, with reasons`,`${leftOutRows.length} 件商品未计入此合计（含原因）`,`${leftOutRows.length} produk dikecualikan daripada jumlah ini, dengan sebab`)}</summary><div className="ix-table"><table>{measureHead}<tbody>{leftOutRows.map(measureRow)}</tbody></table></div></details>}
          </details>
          <details className="cp3-controls ix-more"><summary>{c('Add missing costs: top 10 products to fill in','缺失采购成本：优先补录前 10 项','Kos belian tiada: 10 keutamaan pertama')}</summary><p>{c('Ranked by potential excess × explicitly matched reference retail price. This reference amount is not an estimated purchase cost. Unmatched items remain listed for manual input.','按潜在过量 × 人工确认对应的参考零售价排序。此参考金额不是采购成本估算。未匹配的商品仍列出供人工补录。','Disusun mengikut lebihan berpotensi × harga runcit rujukan dipadankan secara nyata. Amaun rujukan ini bukan kos belian. Item tanpa padanan kekal untuk input manual.')}</p>
            <ul className="ix-queue">{costQueue.top10.map((r,i)=><li key={r.productKey}><span>{i+1}. {impact.products.find(p=>p.productKey===r.productKey)?.name} · {money(r.referenceRisk)} <small>{r.source}</small></span><button type="button" className="btn btn--ghost btn--small" disabled={!onProductDetails} onClick={()=>reviewProduct(r.productKey)}>{c('Add cost','补录成本','Tambah kos')}</button></li>)}
              {costQueue.unranked.map(r=><li key={r.productKey}><span>{impact.products.find(p=>p.productKey===r.productKey)?.name} · {c('Purchase cost missing','缺少采购成本','Kos belian tiada')}</span><button type="button" className="btn btn--ghost btn--small" disabled={!onProductDetails} onClick={()=>reviewProduct(r.productKey)}>{c('Add cost','补录成本','Tambah kos')}</button></li>)}</ul>
            {costQueue.remaining.length>0&&<p>{costQueue.remaining.length} {c('more ranked products; the next priorities appear as costs are completed.','个后续排序商品；补录成本后自动显示下一批。','produk berkeutamaan lagi; muncul selepas kos dilengkapkan.')}</p>}
            {!costQueue.top10.length&&!costQueue.unranked.length&&<p>{c('No missing costs for entered orders.','已填写订单均有采购成本。','Tiada kos hilang bagi pesanan dimasukkan.')}</p>}</details>
        </div>
      </section>
    </div>
    </section>;

  const whyItMatters =
    <section className="impact-sec impact__why" aria-labelledby="impact-why-title">
      {secHead('leaf','impact-why-title',c('Why it matters','为什么重要','Mengapa ia penting'),c('How your plan connects to food waste, and who benefits','您的计划与食物浪费的关系，以及谁会受益','Kaitan pelan anda dengan pembaziran makanan, dan siapa yang mendapat manfaat'))}
    <section className="sx-sec" aria-labelledby="sx-flow-title">
      <h3 className="impact-sec__sub" id="sx-flow-title">{c('1 · From data to less waste','1 · 从数据到少浪费','1 · Dari data ke kurang pembaziran')}</h3>
      <ol className="sx-flow">
        <li><span className="sx-flow__tag"><ImpactIcon name="data" size={18} /> {c('DATA','数据','DATA')}</span><b className="sx-flow__big">{c(`${units(impact.products.length)} products`,`${units(impact.products.length)} 个商品`,`${units(impact.products.length)} produk`)}</b><span>{c('Weekly sales, stock on hand and the orders you planned.','每周销量、现有库存和您计划的订单。','Jualan mingguan, stok sedia ada dan pesanan yang anda rancang.')}</span></li>
        <li><span className="sx-flow__tag"><ImpactIcon name="warning" size={18} /> {c('PROBLEM','问题','MASALAH')}</span><b className="sx-flow__big">{assessed.length?c(`${units(planned)} planned`,`原计划 ${units(planned)} 件`,`${units(planned)} dirancang`):'—'}</b><span>{assessed.length?c(`Only about ${units(planned-excess)} are expected to sell in the next four weeks.`,`未来四周预计只卖得掉大约 ${units(planned-excess)} 件。`,`Cuma kira-kira ${units(planned-excess)} dijangka laku dalam empat minggu akan datang.`):c('Enter planned orders in Step 4 to compare them with demand.','在第 4 步填写计划订购量即可与需求对比。','Masukkan pesanan dirancang dalam Langkah 4 untuk membandingkannya dengan permintaan.')}</span></li>
        <li><span className="sx-flow__tag"><ImpactIcon name="check" size={18} /> {c('RECOMMENDATION','建议','CADANGAN')}</span><b className="sx-flow__big">{c('Order to demand','按销量进货','Pesan ikut jualan')}</b><span>{c('Keep each order at or below the top of its demand range.','每张订单都不超过预计销量的上限。','Pastikan setiap pesanan tak melebihi had atas jangkaan jualan.')}</span></li>
        <li><span className="sx-flow__tag"><ImpactIcon name="leaf" size={18} className="impact-flow-leaf" /> {c('WASTE PREVENTION','减少浪费','KURANG PEMBAZIRAN')}</span><b className="sx-flow__big">{assessed.length?c(`${units(excess)} fewer`,`少进 ${units(excess)} 件`,`${units(excess)} kurang`):'—'}</b><span>{c('units to reconsider before ordering','件下单前值得再考虑','unit untuk disemak semula sebelum memesan')}</span></li>
      </ol>
      <ul className="sx-stats">{facts.map(([value,detail,source])=><li key={value}><b className="sx-stat__n">{value}</b><span>{detail}</span><small>{source}</small></li>)}</ul>
    </section>

    <section className="sx-sec" aria-labelledby="sx-who-title">
      <h3 className="impact-sec__sub" id="sx-who-title">{c('2 · Who feels the difference','2 · 谁能感受到改变','2 · Siapa yang rasa perbezaannya')}</h3>
      <ul className="sx-who">
        <li><span className="sx-who__icon" aria-hidden="true"><ImpactIcon name="shop" size={28} /></span><span className="sx-who__who">{c('YOU · THE SHOP OWNER','您 · 店主','ANDA · PEMILIK KEDAI')}</span><b>{c('More cash in the till','钱不会压在货上','Lebih banyak duit dalam laci')}</b><span>{c('Less money tied up in unsold stock.','更少资金压在卖不掉的货上。','Kurang wang terikat pada stok tak laku.')}</span></li>
        <li><span className="sx-who__icon" aria-hidden="true"><ImpactIcon name="people" size={28} /></span><span className="sx-who__who">{c('CUSTOMERS & COMMUNITY','顾客与社区','PELANGGAN & KOMUNITI')}</span><b>{c('Fresher food on the shelf','货架上的东西更新鲜','Barang di rak lebih segar')}</b><span>{c('The same products in stock, with less of it sitting close to expiry.','该有的货都有，只是快过期的少了。','Produk sama tetap ada, cuma kurang yang hampir luput.')}</span></li>
        <li><span className="sx-who__icon" aria-hidden="true"><ImpactIcon name="leaf" size={28} /></span><span className="sx-who__who">{c('ENVIRONMENT','环境','ALAM SEKITAR')}</span><b>{c('Less food in landfill','更少食物被送去填埋','Kurang makanan dibuang ke tapak pelupusan')}</b><span>{c('Fewer units at risk of going to waste.','更少商品面临被浪费的风险。','Kurang unit berisiko terbuang.')}</span></li>
        <li><span className="sx-who__icon" aria-hidden="true"><ImpactIcon name="building" size={28} /></span><span className="sx-who__who">{c('GOVERNMENT & SWCORP','政府与 SWCorp','KERAJAAN & SWCORP')}</span><b>{c('Progress on SDG 12.3','为 SDG 12.3 出一份力','Menyumbang kepada SDG 12.3')}</b><span>{c('Prevention at the shop counter supports the push to cut landfill reliance from 61% to 52% by 2030.','从店里的柜台做起，帮助国家在 2030 年前把填埋依赖从 61% 降到 52%。','Langkah kecil di kaunter kedai membantu usaha kurangkan pergantungan pada tapak pelupusan daripada 61% kepada 52% menjelang 2030.')}</span></li>
      </ul>
    </section>

    <section className="impact-sdg" aria-labelledby="impact-sdg-title">
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#FDF0D8" /><path d="M32 10a22 22 0 0 1 19 11" fill="none" stroke="#E0A13A" strokeWidth="4" strokeLinecap="round" /><path d="M51 21l1-7M51 21l-7-1" stroke="#E0A13A" strokeWidth="4" strokeLinecap="round" /><path d="M32 54a22 22 0 0 1-19-11" fill="none" stroke="#34B08F" strokeWidth="4" strokeLinecap="round" /><path d="M13 43l-1 7M13 43l7 1" stroke="#34B08F" strokeWidth="4" strokeLinecap="round" /><path d="M21 30h22l-3 14H24z" fill="#167D74" /><path d="M25 30l4-7M39 30l-4-7" stroke="#167D74" strokeWidth="2.6" strokeLinecap="round" /><path d="M30 35c0-3 2-5 5-5 0 3-2 5-5 5z" fill="#8FD2C8" /></svg>
      <div className="impact-sdg__text"><span className="impact-sdg__label">{c('SDG 12.3 · Halve food waste','SDG 12.3 · 食物浪费减半','SDG 12.3 · Kurangkan separuh pembaziran makanan')}</span>
        <h3 id="impact-sdg-title">{c('Your plan supports less food waste in shops','您的计划有助于减少商店的食物浪费','Pelan anda menyokong kurang pembaziran makanan di kedai')}</h3>
        <p>{c('StockLess shows overstock to review before you order. It does not claim a measured reduction.','StockLess 显示下单前值得检查的过量库存，并不声称已实现可测量的减少。','StockLess menunjukkan lebihan stok untuk disemak sebelum memesan. Ia tidak mendakwa pengurangan yang diukur.')}</p></div>
      <a href="https://sdgs.un.org/goals/goal12" target="_blank" rel="noreferrer noopener">{c('Read about SDG 12','了解可持续发展目标 12','Baca tentang SDG 12')} <span aria-hidden="true">↗</span></a>
    </section>

    <section className="learn impact-faq" aria-labelledby="impact-learn-title">
      <h3 className="impact-sec__sub" id="impact-learn-title">{c('3 · Common questions','3 · 常见问题','3 · Soalan lazim')}</h3>
      <div className="learn__list">{faq.map(([icon,question,answer])=><details className="learn__item" key={icon}><summary className="learn__q"><span className="learn__icon" aria-hidden="true"><ImpactIcon name={icon} size={22} /></span><span className="learn__qtext">{question}</span><span className="learn__chevron" aria-hidden="true" /></summary><p className="learn__a">{answer}</p></details>)}</div>
    </section>
    <p className="impact__method">{c('Method: estimates use the demand range StockLess worked out from your sales rows, the stock figures in your file, and the order quantities you entered. Figures change when your file or your planned orders change.','方法：估算使用 StockLess 根据您的销售记录得出的需求区间、您文件中的库存数字，以及您输入的订购数量。文件或计划订单变动时，数字也会随之变化。','Kaedah: anggaran menggunakan julat permintaan yang StockLess kira daripada baris jualan anda, angka stok dalam fail anda, dan kuantiti pesanan yang anda masukkan. Angka berubah apabila fail atau pesanan yang anda rancang berubah.')}</p>
    </section>;

  return <main className="impact" aria-labelledby="impact-title">
    <ImpactStory head={head} aside={about} afterStory={detailedEstimates} lines={lines} totalProducts={impact.products.length} business={businessTile} emissions={emissionsTile} onBack={onBack} onExcess={openExcessProducts} onBusiness={()=>openBusinessProducts('excess')} onEmissions={()=>openEnvironmentProducts('potential')} />
    {missingImpactDetails.length>0 && <details className="impact-sec impact__missing-details">
      <summary>{c('Review products with missing details','查看缺少信息的商品','Semak produk dengan butiran yang belum lengkap')} ({missingImpactDetails.length})</summary>
      <p>{c('Some products are not included in the money or carbon estimates yet. Add their missing details to include them where supported. You can keep planning without filling these in.','部分商品尚未计入资金或碳排放估算。补充缺少的信息后，支持的商品即可计入。您也可以不填写并继续规划采购。','Sesetengah produk belum dikira dalam anggaran wang atau karbon. Tambah butiran yang belum lengkap untuk memasukkannya jika disokong. Anda boleh terus merancang tanpa mengisinya.')}</p>
      <ul>{missingImpactDetails.map(({product,missing})=><li key={product.key}><span><b>{product.title}</b><small>{missing.map(detailLabel).join(' · ')}</small></span>{onProductDetails && <button type="button" className="btn btn--ghost btn--small" aria-label={`${c('Add details for','补充信息：','Tambah butiran untuk')} ${product.title} ${product.sku??''}`} onClick={()=>onProductDetails(product.key)}>{c('Add details','补充信息','Tambah butiran')}</button>}</li>)}</ul>
    </details>}
    <section data-guide="impact-products" className="impact-sec impact__lines" id="impact-excess-products" ref={excessProducts} aria-labelledby="impact-excess-title">
      {secHead('box','impact-excess-title',c('Products with possible excess stock','可能有多余库存的商品','Produk dengan stok berlebihan berpotensi'),c(`${withExcess.length} of ${assessed.length} checked products`,`${assessed.length} 件已核对商品中的 ${withExcess.length} 件`,`${withExcess.length} daripada ${assessed.length} produk disemak`),withExcess.length>1?<div className="impact-sort" role="group" aria-label={c('Sort products','排序商品','Susun produk')}><button type="button" aria-pressed={excessSort==='units'} onClick={()=>setExcessSort('units')}>{c('By units','按数量','Ikut unit')}</button><button type="button" aria-pressed={excessSort==='money'} onClick={()=>setExcessSort('money')}>{c('By money','按金额','Ikut wang')}</button></div>:undefined,true)}
      {withExcess.length?<><div className="impact-bars__head" aria-hidden="true"><span>{c('Product','商品','Produk')}</span><span>{c('Units above expected demand','高于预期需求的数量','Unit melebihi permintaan dijangka')}</span><span style={{textAlign:'right'}}>{c('Money tied up','占用资金','Wang terikat')}</span></div>
        <ul className="impact-bars">{excessRows.map(p=><li key={p.productKey}><span className="impact-bars__name"><b>{p.name}</b><span>{p.code}</span></span><span className="impact-bars__bar"><span className="impact-bars__track"><i style={{width:`${Math.max(3,Math.round(p.excessUnits!/maxExcess*100))}%`}} /></span><b>{units(p.excessUnits!)}</b></span><span className="impact-bars__money">{p.excessCost.state==='estimated'?money(p.excessCost.amount):'—'}</span></li>)}</ul></>
        :<p className="impact__empty">{assessed.length?c('No potential excess is indicated by the checked plans.','已核对的计划未显示潜在多余库存。','Tiada lebihan berpotensi ditunjukkan oleh pelan yang disemak.'):c('No reliable purchase check is available for these products yet.','这些商品暂没有可靠的采购检查结果。','Belum ada semakan belian yang boleh dipercayai bagi produk ini.')}</p>}
    </section>

    {whyItMatters}

    <section data-guide="impact-downloads" className="impact-download impact__downloads" ref={downloads} aria-labelledby="impact-download-title">
    <div className="impact-download__language"><label htmlFor="impact-report-language">{c('Report language','报告语言','Bahasa laporan')}</label><select id="impact-report-language" value={reportLanguage} disabled={busy} onChange={event=>setReportLanguage(event.target.value as ReportLanguageChoice)}><option value="follow">{c('Follow page language','跟随页面语言','Ikut bahasa halaman')}</option><option value="en">English</option><option value="zh">简体中文</option><option value="ms">Bahasa Melayu</option></select><small>{c('Applies to all downloads below.','适用于下方所有导出。','Digunakan untuk semua muat turun di bawah.')}</small></div>
    <div><h2 id="impact-download-title"><span className="impact-sec__icon" aria-hidden="true"><ImpactIcon name="download" size={22} /></span>{c('Download your results','下载结果','Muat turun hasil anda')}</h2><p>{c('Your current plan, plus any recorded outcomes.','当前计划，以及已记录的实际结果。','Pelan semasa anda, serta hasil yang direkodkan.')}</p>
    <div className="impact__toolbar" role="group" aria-label={c('Download your results','下载结果','Muat turun hasil anda')}>
      <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={()=>void download()}>{c('Download analysis Excel','下载分析 Excel','Muat turun Excel analisis')}</button>
      <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={()=>void pdf()}>{c('Download analysis PDF','下载分析 PDF','Muat turun PDF analisis')}</button>
      <button type="button" className="btn btn--ghost btn--small" disabled={busy || (!!datasetId && !saved)} onClick={()=>{setError('');setNoOrders(false);try{printAnalysisReport(makeReport(),exportLanguage);}catch(e){fail(e);}}}>{c('Print / Save PDF','打印／保存 PDF','Cetak / Simpan PDF')}</button>
    </div>
    </div><div><h3><span className="impact-sec__icon" aria-hidden="true"><ImpactIcon name="cart" size={22} /></span>{c('Current order list','当前订单清单','Senarai pesanan semasa')}</h3><p>{c('Quantities in your Purchase plan now. Zero orders are left out.','采购计划当前的数量，不含零订购量。','Kuantiti dalam Pelan belian sekarang. Pesanan sifar dikecualikan.')}</p><div className="impact__toolbar"><button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={()=>void download(true)}>{c('Download order list Excel','下载订单清单 Excel','Muat turun Excel senarai pesanan')}</button></div></div>
    </section>
    {error&&<div className="notice notice--error impact__error" role="alert"><span>{error}</span>{noOrders&&<button type="button" className="btn btn--ghost btn--small" onClick={onBack}>{c('Edit quantities in Purchase plan','在采购计划中修改数量','Ubah kuantiti dalam Pelan belian')} →</button>}</div>}
    <div className="impact__actions sx-actions"><button type="button" className="btn btn--ghost" onClick={onBack}>{c('← Back to the purchase plan','← 返回采购计划','← Kembali ke pelan pembelian')}</button>{onNew&&<button type="button" className="btn btn--ghost" onClick={onNew}>{c('Start a new plan','重新规划','Buat pelan baru')}</button>}</div>
  </main>;
}
