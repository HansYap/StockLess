import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { AnalysisReport, AnalysisReportTable } from '../engine.ts';
import { analysisReportFilename, compactSummary, downloadReportBytes } from './analysis-report-export.ts';

/** Same-origin font only: report text and merchant rows never leave the browser. */
export async function downloadAnalysisPdf(report: AnalysisReport) {
  const response = await fetch(`${import.meta.env.BASE_URL}fonts/NotoSansSC.ttf`);
  if (!response.ok) throw new Error('The local PDF font could not be loaded. Keep your results and try again.');
  const bytes = await buildAnalysisPdfBytes(report,new Uint8Array(await response.arrayBuffer()));
  downloadReportBytes(bytes,analysisReportFilename(report,'analysis','pdf'),'application/pdf');
}

/** Paginated, searchable Unicode summary generated from the same report contract as Excel. */
export async function buildAnalysisPdfBytes(report: AnalysisReport, fontBytes: Uint8Array): Promise<Uint8Array> {
  const doc=await PDFDocument.create(); doc.registerFontkit(fontkit);
  // Embed the complete static font: the JS subsetter drops some CJK/Latin outlines.
  const font=await doc.embedFont(fontBytes,{subset:false});
  const latin=await doc.embedFont(StandardFonts.Helvetica);
  const latinChars=new Set(latin.getCharacterSet());
  const characterFont=(ch:string)=>latinChars.has(ch.codePointAt(0)!)?latin:font;
  const chars=new Set([...font.getCharacterSet(),...latinChars]);
  const safe=(value:unknown)=>Array.from(String(value)).map(ch=>ch==='\n'?ch:ch==='\t'?' ':ch.codePointAt(0)!<32?'':chars.has(ch.codePointAt(0)!)?ch:`[U+${ch.codePointAt(0)!.toString(16).toUpperCase()}]`).join('');
  doc.setTitle(`StockLess ${report.metadata.sourceLabel} analysis`);doc.setAuthor('StockLess');
  doc.setCreationDate(new Date(report.metadata.generatedAt));
  const width=841.89,height=595.28,margin=36,inner=width-margin*2;
  let page:PDFPage, y=0;
  const draw=(text:string,options:{x:number;y:number;size:number;color?:ReturnType<typeof rgb>})=>{
    let run='',face=latin,x=options.x;
    const flush=()=>{if(run){page.drawText(run,{...options,x,font:face});x+=face.widthOfTextAtSize(run,options.size);run='';}};
    for(const ch of text){const next=characterFont(ch);if(next!==face){flush();face=next;}run+=ch;}flush();
  };
  const addPage=()=>{page=doc.addPage([width,height]);y=height-margin;draw('StockLess · '+report.metadata.sourceLabel,{x:margin,y,size:9,color:rgb(.18,.35,.26)});y-=25;};
  const ensure=(space:number)=>{if(y-space<margin+20)addPage();};
  const wrap=(text:string,maxWidth:number,size:number)=>wrapPdfText(safe(text),characterFont,maxWidth,size);
  const paragraph=(text:string,size=9,gap=7)=>{for(const line of wrap(text,inner,size)){ensure(size+4);draw(line,{x:margin,y,size});y-=size+4;}y-=gap;};
  const heading=(text:string)=>{ensure(48);paragraph(text,14,8);};
  addPage(); heading('Analysis summary');
  const m=report.metadata;
  paragraph(`Shop: ${m.shopName} · Dataset: ${m.datasetName}\nSource: ${m.sourceName}\nReporting period: ${m.period.start} to ${m.period.end} · Analysis date: ${m.analysisDate}\nGenerated: ${m.generatedAt}\nSource SHA-256: ${m.sourceSha256}`);
  paragraph('Current forecasts and scenarios are estimates. Recorded outcomes are separate. Missing data remains unavailable; recorded zero remains zero. The detailed Excel workbook contains all source rows and frozen decision evidence.');

  // Up to twelve readable charts; every product remains in the result tables/workbook.
  const history=report.tables.find(t=>t.id==='history');
  const groups=new Map<string,readonly (readonly (string|number|boolean)[])[]>();
  for(const row of history?.rows??[]){const key=String(row[3]);groups.set(key,[...(groups.get(key)??[]),row]);}
  if(groups.size){
    heading('Recorded weekly positive sales');
    paragraph('Returns are separate. Missing weeks have no bar; a recorded zero is labelled 0. Charts show up to twelve products, eight recent weeks each.');
    for(const rows of [...groups.values()].slice(0,12)){
      ensure(130);paragraph(`${rows[0][0]} · ${rows[0][1]} · ${rows[0][2]}`,10,3);
      const recent=rows.slice(-8),max=Math.max(1,...recent.map(r=>typeof r[6]==='number'?r[6]:0));
      const chartBottom=y-65,slot=inner/8;
      recent.forEach((r,i)=>{
        const amount=typeof r[6]==='number'?r[6]:undefined,h=amount===undefined?0:amount/max*50;
        page.drawRectangle({x:margin+i*slot+8,y:chartBottom,width:slot-20,height:h,color:rgb(.23,.45,.33)});
        draw(safe(amount===undefined?'Missing':amount),{x:margin+i*slot+8,y:chartBottom+h+3,size:8});
        draw(safe(r[4]),{x:margin+i*slot+8,y:chartBottom-13,size:7});
      });y=chartBottom-30;
    }
  }
  const drawTable=(table:AnalysisReportTable)=>{
    heading(table.title);
    if(!table.rows.length){paragraph(table.id==='finalorders'?'No finalised orders. Save a positive final quantity in purchase planning.':'No records available.');return;}
    const size=7.5,lineHeight=11,colWidth=inner/table.columns.length,pad=4;
    const header=()=>{
      const labels=table.columns.map(v=>wrap(v,colWidth-pad*2,size));
      const h=Math.max(...labels.map(v=>v.length))*lineHeight+pad*2;ensure(h+24);
      page.drawRectangle({x:margin,y:y-h,width:inner,height:h,color:rgb(.91,.95,.92)});
      labels.forEach((lines,i)=>lines.forEach((text,j)=>draw(text,{x:margin+i*colWidth+pad,y:y-pad-size-j*lineHeight,size})));y-=h;
    };
    header();
    for(const row of table.rows){
      const cells=table.columns.map((_,i)=>wrap(String(row[i]??''),colWidth-pad*2,size));
      const totalLines=Math.max(1,...cells.map(c=>c.length));let offset=0;
      while(offset<totalLines){
        if(y-margin-20<lineHeight+pad*2){addPage();header();}
        const count=Math.min(totalLines-offset,Math.max(1,Math.floor((y-margin-20-pad*2)/lineHeight)));
        const h=count*lineHeight+pad*2;
        cells.forEach((lines,i)=>{
          page.drawRectangle({x:margin+i*colWidth,y:y-h,width:colWidth,height:h,borderColor:rgb(.77,.82,.78),borderWidth:.35});
          lines.slice(offset,offset+count).forEach((text,j)=>draw(text,{x:margin+i*colWidth+pad,y:y-pad-size-j*lineHeight,size}));
        });y-=h;offset+=count;if(offset<totalLines){addPage();header();}
      }
    }y-=16;
  };
  for(const table of report.tables.filter(t=>!['metadata','sales','history','evidence','limitations'].includes(t.id))){
    if(table.id==='carbon'){
      const columns=['Product name','Measure','Status','Mass (kg)','CO2e (kg)','Factor label','Source names','Limitation'];
      const indices=columns.map(c=>table.columns.indexOf(c));
      drawTable({...table,columns,rows:table.rows.map(r=>indices.map(i=>i<0?'':r[i]))});
    }else drawTable(compactSummary(table));
  }
  heading('Explanations and limitations');report.limitations.forEach(t=>paragraph(t));
  paragraph('Unsupported characters, if any, are preserved as Unicode code points [U+...].');
  const pages=doc.getPages();pages.forEach((p,i)=>p.drawText(`${i+1} / ${pages.length}`,{x:width-margin-65,y:20,font:latin,size:8}));
  return doc.save();
}

/** Break at words when possible and at code points for Chinese or very long identifiers. */
const characterWidths=new WeakMap<PDFFont,Map<string,number>>();
function wrapPdfText(text:string,characterFont:(ch:string)=>PDFFont,maxWidth:number,size:number):string[]{
  const advance=(ch:string)=>{const font=characterFont(ch);let widths=characterWidths.get(font);if(!widths){widths=new Map();characterWidths.set(font,widths);}let value=widths.get(ch);if(value===undefined){value=font.widthOfTextAtSize(ch,1);widths.set(ch,value);}return value*size;};
  const measure=(s:string)=>Array.from(s).reduce((sum,ch)=>sum+advance(ch),0);
  const lines:string[]=[];
  for(const paragraph of text.split('\n')){
    let line='',lineWidth=0;
    for(const ch of paragraph){
      const charWidth=advance(ch);
      if(line&&lineWidth+charWidth>maxWidth-1){
        const space=line.lastIndexOf(' ');
        if(space>line.length/2){lines.push(line.slice(0,space));line=line.slice(space+1)+ch;lineWidth=measure(line);}
        else{lines.push(line);line=ch;lineWidth=charWidth;}
      }else{line+=ch;lineWidth+=charWidth;}
    }lines.push(line);
  }return lines;
}
