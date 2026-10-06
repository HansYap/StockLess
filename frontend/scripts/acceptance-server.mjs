import { createServer } from "vite";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const failModels=process.env.STOCKLESS_QA_MODEL_MODE !== "normal";
const boundarySample=process.env.STOCKLESS_QA_SAMPLE === "boundary";
const port=boundarySample ? 5176 : failModels ? 5174 : 5175;
const logPath=process.env.STOCKLESS_QA_HTTP_LOG ?? `/private/tmp/stockless-browser-${port}-http.jsonl`;
function largeSample() {
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kuala_Lumpur",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const header="Date,SKU,Quantity,Reference\n",count=100000,target=10*1024*1024;
  const rows=Array.from({length:count},(_,i)=>`${date},000101,1,${i}\n`);
  const missing=target-header.length-rows.reduce((sum,row)=>sum+row.length,0);
  const each=Math.floor(missing/count),rest=missing%count;
  return header+rows.map((row,i)=>row.slice(0,-1)+" ".repeat(each+(i<rest?1:0))+"\n").join("");
}
// Synthetic input for exercising the actual UploadScreen, without changing
// production samples or requiring expanded browser file access permissions.
const sample=boundarySample ? largeSample() : null;
const observeWorker={name:"qa-observe-model-fetch",transform(code,id){
  if(!id.includes("/src/workers/semantic.worker.ts"))return;
  const observer=`const qaFetch=globalThis.fetch.bind(globalThis); globalThis.fetch=(input,init)=>{const request=input instanceof Request?input:null; const url=typeof input==='string'?input:input instanceof URL?input.href:request.url; const method=init?.method??request?.method??'GET'; const headers=Object.fromEntries(new Headers(init?.headers??request?.headers)); const body=typeof init?.body==='string'?init.body:''; self.postMessage({type:'qa-network',request:{url,method,headers,body,uninspectedBody:Boolean(init?.body && typeof init.body!=='string')}});return qaFetch(input,init);};\n`;
  return {code:observer+code,map:null};
}};
const server=await createServer({root,cacheDir:`node_modules/.vite-browser-qa-${port}`,optimizeDeps:{include:["@huggingface/transformers"]},plugins:[observeWorker,{name:"qa-model-mode-and-log",configureServer(server){
  server.middlewares.use((req,res,next)=>{
    const chunks=[];req.on("data",chunk=>chunks.push(chunk));
    res.on("finish",()=>{const body=Buffer.concat(chunks).toString("utf8");appendFileSync(logPath,JSON.stringify({time:new Date().toISOString(),method:req.method,path:req.url,status:res.statusCode,bodyBytes:Buffer.byteLength(body),sentinelLeak:/QA_DATE_SENTINEL|QA_CELL_SENTINEL/.test(req.url+JSON.stringify(req.headers)+body)})+"\n");});
    if(sample && req.url?.startsWith("/samples/sample_with_issues.csv")){res.setHeader("Content-Type","text/csv");res.setHeader("Cache-Control","no-store");res.end(sample);return;}
    if(failModels && req.url?.startsWith("/models/")){res.statusCode=503;res.setHeader("Cache-Control","no-store");res.end("Intentional QA model load failure");return;}next();
  });
}}],worker:{format:"es",plugins:()=>[observeWorker]},server:{host:"127.0.0.1",port,strictPort:true}});
await server.listen();server.printUrls();
console.log("QA only: model mode",failModels ? "HTTP 503" : "normal local loading","HTTP log:",logPath);
