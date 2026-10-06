import { createEmptySession, confirmIdentityMode, setMapping, updateSessionMapping, previousCompleteWeekStarts, runReadinessCheck, buildDemandForecastReview, emptyProductPurchaseInputs, createPurchaseQuantity, proposeMappings, type SessionEnvelope, type CanonicalField, type CsvProgress } from "../engine.ts";
import { replaceSessionSourceInWorker } from "../workers/import-session-client.ts";
import { createLocalSemanticScorer } from "../workers/semantic-client.ts";
import { createSavedDataset, getSavedDataset, saveDatasetWork } from "../storage/saved-datasets.ts";

const status = document.getElementById("status")!;
const results = document.getElementById("results")!;
const progress = document.getElementById("progress") as HTMLProgressElement;
const manual = document.getElementById("manual-date") as HTMLSelectElement;
const report: Record<string, unknown> = { browser: navigator.userAgent, synthetic: true, origin: location.origin, checks: {} };
const checks = report.checks as Record<string, unknown>;
const network: unknown[] = [];
let active: AbortController | null = null;
let envelope: SessionEnvelope | null = null;
const analysisDate = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Kuala_Lumpur",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const fields: CanonicalField[] = ["transaction_date","product_code","quantity_sold","product_name","pack_variant","current_stock","stock_as_of_date","unit_cost"];
function render() { results.textContent = JSON.stringify({...report, workerNetwork:network}, null, 2); }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function linkSaved(id: string) {
  const url = new URL(location.href); url.searchParams.set("dataset", id); history.replaceState(null,"",url);
  for (const [name, href] of [["reopen",url.href],["workspace",`${location.origin}/#dataset/${encodeURIComponent(id)}`]]) {
    const link=document.getElementById(name) as HTMLAnchorElement; link.href=href; link.hidden=false;
  }
}
function task(id: string, fn: ()=>Promise<void>) {
  const button=document.getElementById(id) as HTMLButtonElement;
  button.onclick=async()=>{ button.disabled=true; status.textContent=`Running ${id}`;
    try { await fn(); status.textContent=`PASS: ${id}`; }
    catch(error) { checks[id]={state:"failed",error:String(error)}; status.textContent=`FAIL: ${id} — ${String(error)}`; }
    finally { button.disabled=false; render(); }
  };
}
function fixture() {
  return new TextEncoder().encode(["QA_DATE_SENTINEL,SKU,Quantity,Name,Pack,Stock,Stock date,Unit Cost",...previousCompleteWeekStarts(analysisDate).map(date=>`${date},000101,10,QA_CELL_SENTINEL,250 g,0,${analysisDate},2.5`)].join("\n"));
}
async function imported(bytes=fixture(), onProgress: (p:CsvProgress)=>void=()=>{}) {
  const controller=new AbortController(); active=controller;
  (document.getElementById("cancel") as HTMLButtonElement).disabled=false;
  try { return await replaceSessionSourceInWorker(createEmptySession(),bytes,{sourceName:"synthetic-browser-qa.csv",sourceMode:"user",mimeType:"text/csv",signal:controller.signal,onProgress:p=>{progress.value=p.total?p.processed/p.total:0;onProgress(p);}}); }
  finally { active=null; (document.getElementById("cancel") as HTMLButtonElement).disabled=true; }
}
function confirmed(source:SessionEnvelope) {
  let mapping=source.session.mapping;
  fields.forEach((field,index)=>{mapping=setMapping(mapping,field,`column-${index}`,true);});
  return updateSessionMapping(source,confirmIdentityMode(mapping,"stable"));
}
task("save",async()=>{
  const importedEnvelope=confirmed(await imported()); const dataset=importedEnvelope.session.dataset!;
  const readiness=await runReadinessCheck(dataset,importedEnvelope.session.mapping,{analysisDate});
  const forecast=buildDemandForecastReview(readiness);
  const saved=await createSavedDataset("QA synthetic tests",`Browser acceptance ${new Date().toISOString()}`,importedEnvelope,analysisDate);
  await saveDatasetWork(saved.id,{readiness,forecast,purchaseDrafts:{"ID|000101":{...emptyProductPurchaseInputs(),plannedOrder:createPurchaseQuantity(40,"input by you")}},supplierTerms:{"QA supplier":"Case 6, minimum 24, lead 2"}});
  linkSaved(saved.id); checks.save={state:"passed",id:saved.id,rows:dataset.rows.length,code:dataset.rows[0].normalizedValues[1],plannedOrder:40};
});
task("restore",async()=>{
  const id=new URL(location.href).searchParams.get("dataset"); assert(id,"Save first or open the saved check link.");
  const saved=await getSavedDataset(id); assert(saved,"No saved dataset found.");
  assert(saved.envelope.session.dataset?.rows.length===8,"Stored row count changed.");
  assert(saved.envelope.session.dataset.rows[0].normalizedValues[1]==="000101","Leading zeros changed.");
  assert(saved.envelope.session.mapping.mappings.transaction_date?.confirmed,"Confirmed mapping was not restored.");
  assert(saved.readiness?.reconciliation.rowsUsed===8 && saved.forecast,"Readiness/forecast was not restored.");
  const planned=saved.purchaseDrafts["ID|000101"]?.plannedOrder;
  assert(planned?.state==="value" && planned.value===40,"Plan was not restored.");
  assert(saved.supplierTerms["QA supplier"],"Supplier terms were not restored.");
  linkSaved(id); checks.restore={state:"passed",id,rows:8,confirmedMapping:true,readiness:true,forecast:true,plannedOrder:40,supplierTerms:true};
});
function boundary() {
  const header="Date,SKU,Quantity,Reference\n",count=100000,target=10*1024*1024;
  const rows=Array.from({length:count},(_,i)=>`${analysisDate},000101,1,${i}\n`);
  const missing=target-header.length-rows.reduce((sum,row)=>sum+row.length,0);
  const each=Math.floor(missing/count),rest=missing%count;
  return new TextEncoder().encode(header+rows.map((row,i)=>row.slice(0,-1)+" ".repeat(each+(i<rest?1:0))+"\n").join(""));
}
task("capacity",async()=>{
  const bytes=boundary(); assert(bytes.byteLength===10*1024*1024,"Fixture is not at byte limit.");
  const ticks:number[]=[],updates:number[]=[];let last=performance.now();
  const timer=setInterval(()=>{const now=performance.now();ticks.push(now-last);last=now;},25);
  const started=performance.now();let importedEnvelope:SessionEnvelope;
  try { importedEnvelope=await imported(bytes,()=>updates.push(performance.now())); }
  finally { clearInterval(timer); }
  const ended=performance.now(); ticks.push(ended-last);
  const progressGaps=[started,...updates,ended].slice(1).map((time,i)=>time-[started,...updates,ended][i]);
  const rows=importedEnvelope.session.dataset!.rows.length;
  assert(rows===100000,"Boundary row count changed."); assert(Math.max(...ticks)<1000,"Main-thread heartbeat exceeded one second.");
  assert(Math.max(...progressGaps)<2000,"Progress gap exceeded two seconds.");
  checks.capacity={state:"passed",bytes:bytes.byteLength,rows,elapsedMs:Math.round(ended-started),heartbeatMaxMs:Math.round(Math.max(...ticks)),progressEvents:updates.length,progressMaxGapMs:Math.round(Math.max(...progressGaps)),scope:"Worker import and event-loop heartbeat; file-picker/scroll interactions are separate UI checks"};
});
task("cancel-check",async()=>{
  let cancelledAt=0,loaded=false;
  try { await imported(boundary(),p=>{if(p.phase==="parse" && !cancelledAt){cancelledAt=performance.now();active!.abort();}});loaded=true; }
  catch(error) { assert(error instanceof DOMException && error.name==="AbortError","Unexpected cancellation error."); }
  const latency=performance.now()-cancelledAt;
  assert(cancelledAt && !loaded && latency<2000,"Cancellation did not stop parsing within two seconds.");
  progress.value=0; checks.cancel={state:"passed",latencyMs:Math.round(latency),loaded:false,scope:"Actual Worker abort triggered on the first parse-progress event"};
});
document.getElementById("cancel")!.onclick=()=>active?.abort();
task("limits",async()=>{
  const over=boundary(); const tooLarge=new Uint8Array(over.length+1);tooLarge.set(over);tooLarge[over.length]=10;
  const tooMany=new TextEncoder().encode("Date,SKU,Quantity\n"+`${analysisDate},000101,1\n`.repeat(100001));
  const errors:Record<string,string>={};
  for (const [name,bytes] of [["bytes",tooLarge],["rows",tooMany]] as const) {
    try { await imported(bytes); throw new Error("Oversized input was accepted."); }
    catch(error) { assert(error instanceof Error && "code" in error,"Expected an import rejection."); errors[name]=String(error.code); }
  }
  assert(errors.bytes==="FILE_TOO_LARGE" && errors.rows==="ROW_LIMIT_EXCEEDED",`Unexpected rejection codes: ${JSON.stringify(errors)}`);
  checks.limits={state:"passed",...errors};
});
// Observe real model-worker requests in the dedicated QA server. No recording
// hook is included in the production worker or normal application page.
const NativeWorker=window.Worker;
window.Worker=class extends NativeWorker {
  constructor(url:string|URL,options?:WorkerOptions) {super(url,options);this.addEventListener("message",event=>{if(event.data?.type==="qa-network"){network.push(event.data.request);render();}});}
};
task("model",async()=>{
  envelope=await imported(); const dataset=envelope.session.dataset!;
  manual.replaceChildren(new Option("Not matched yet",""),...dataset.columns.map(column=>new Option(column.header,column.id)));
  const controller=new AbortController(); const scorer=createLocalSemanticScorer(controller.signal,message=>{status.textContent=message;});
  const proposal=await proposeMappings(dataset,scorer);
  assert(proposal.proposals.every(p=>!p.confirmed),"A suggestion was automatically confirmed.");
  assert(location.port!=="5175" || proposal.usedSemanticModel,"Normal local model inference failed.");
  assert(location.port!=="5174" || !proposal.usedSemanticModel,"The intentional model failure was not observed.");
  checks.model={state:"passed",usedModel:proposal.usedSemanticModel,notice:proposal.fallbackNotice??null,rowsStillLoaded:dataset.rows.length,source:dataset.sourceName,autoConfirmed:0,scope:location.port==="5174"?"Actual model files return HTTP 503 on the QA server":"Normal local model loading"};
});
task("manual",async()=>{
  assert(envelope?.session.dataset && manual.value,"Load the model check and select a date column first.");
  let edited=confirmed(envelope); edited=updateSessionMapping(edited,setMapping(edited.session.mapping,"transaction_date",manual.value,true));
  const snapshot=await runReadinessCheck(edited.session.dataset!,edited.session.mapping,{analysisDate});
  assert(snapshot.reconciliation.rowsUsed===8,"Manual matching did not restore all records.");
  checks.manual={state:"passed",rowsUsed:8,source:edited.session.dataset!.sourceName,reuploadRequired:false};
});
document.getElementById("download")!.onclick=()=>{
  const resources=performance.getEntriesByType("resource").map(entry=>({url:entry.name,type:(entry as PerformanceResourceTiming).initiatorType}));
  const blob=new Blob([JSON.stringify({...report,workerNetwork:network,pageResources:resources},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="stockless-browser-acceptance.json";a.click();URL.revokeObjectURL(url);
};
const savedId=new URL(location.href).searchParams.get("dataset");if(savedId)linkSaved(savedId);render();
