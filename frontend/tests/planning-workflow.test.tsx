import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PurchasePlanScreen, type PurchasePlanView } from '../src/screens/PurchasePlanScreen.tsx';
import { ImpactDashboard } from '../src/screens/ImpactDashboard.tsx';
import { createPurchaseDecision, type AnalysisReport } from '../src/engine.ts';
import { getSavedDataset } from '../src/storage/saved-datasets.ts';
import { downloadAnalysisWorkbook, downloadPlannedOrdersWorkbook, printAnalysisReport } from '../src/purchase-plan/analysis-report-export.ts';
import { setLanguage } from '../src/i18n/index.ts';
import { makeEvidence } from './fixtures.ts';
vi.mock('../src/storage/saved-datasets.ts',async original=>({...await original<object>(),getSavedDataset:vi.fn()}));
vi.mock('../src/purchase-plan/analysis-report-export.ts',async original=>{
  const actual=await original<typeof import('../src/purchase-plan/analysis-report-export.ts')>();
  return {...actual,downloadAnalysisWorkbook:vi.fn(),printAnalysisReport:vi.fn(),downloadPlannedOrdersWorkbook:vi.fn(async(report:AnalysisReport)=>{if(!report.tables.find(table=>table.id==='orders')?.rows.length)throw new actual.NoPlannedOrdersError();})};
});
beforeEach(()=>{setLanguage('en');vi.clearAllMocks();vi.mocked(getSavedDataset).mockResolvedValue({decisions:[],outcomes:[]} as never);});
const entered=(value:number)=>({plannedOrder:{state:'value' as const,value,source:'input by you' as const},incomingStock:{state:'empty' as const}});
const basePlan=()=>({...makeEvidence(),drafts:{A:entered(100)},selectedKey:'A',onSelect:vi.fn(),onDraftChange:vi.fn(),onBack:vi.fn()});
it('uses the purchase quantity directly with no separate decision form',()=>{
  const props=basePlan();render(<PurchasePlanScreen {...props} datasetId="D" />);
  expect((screen.getByLabelText('Exact planned order quantity') as HTMLInputElement).value).toBe('100');
  expect(screen.queryByText('Save your final choice')).toBeNull();
  expect(screen.queryByText('Record your purchase decision')).toBeNull();
  expect(screen.queryByLabelText('Final quantity')).toBeNull();
  expect(props.onDraftChange).not.toHaveBeenCalled();
});
it('opens optional details for the selected product outside its saved filter',async()=>{
  const props=basePlan();render(<PurchasePlanScreen {...props} initialView={{snapshotId:props.snapshot.id,query:'000202',group:'all',positiveOnly:false,financialSort:false,expanded:false}} detailsFocus={{productKey:'A',revision:1}} />);
  await waitFor(()=>expect(screen.getByRole('navigation',{name:'Expiry checks'})).toBeTruthy());
  expect(screen.getByText('Selected product outside current filter')).toBeTruthy();
  expect(screen.queryByLabelText('Final quantity')).toBeNull();
});
it('shows snapshot estimates without recording, correction or history forms',()=>{
  render(<ImpactDashboard {...basePlan()} />);
  for(const title of ['Record what happened','Improve the data behind these estimates','Compare recorded history across two periods','Recorded waste: estimated CO₂e']) expect(screen.queryByText(title)).toBeNull();
  expect(screen.queryByLabelText('Recorded quantity')).toBeNull();
  expect(screen.queryByRole('button',{name:'Save actual outcome'})).toBeNull();
  const environment=screen.getByRole('tabpanel',{name:'Environmental'});
  expect(environment.querySelectorAll('.ix-card')).toHaveLength(2);
  expect(within(environment).getByText('Potential excess: estimated CO₂e')).toBeTruthy();
  expect(within(environment).getByText('Named scenario difference')).toBeTruthy();
  expect(within(screen.getByRole('list',{name:'Your plan at a glance'})).getAllByRole('button')).toHaveLength(3);
  fireEvent.click(screen.getByRole('tab',{name:'Business'}));
  expect(screen.getByRole('tabpanel',{name:'Business'}).querySelectorAll('.ix-card')).toHaveLength(4);
});
it('exports the current order, ignores older saved decisions and updates after a plan edit',async()=>{
  const decision=createPurchaseDecision({id:'old',datasetId:'D',response:'Changed',finalQuantity:6,reason:'Old choice',referenceDate:'2026-10-08',recordedAt:'2026-10-08T10:00:00Z',recommendation:{productKey:'A',productName:'Same product name',sourceName:'old.csv',sourceSha256:'old',sourceMode:'user',analysisDate:'2026-09-14',policyVersion:'cp3-v2',recommendedQuantity:12,quantityUnit:'pieces'}});
  const saved={decisions:[{id:decision.id,purchaseDecision:decision}],outcomes:[]},before=JSON.stringify(saved);
  vi.mocked(getSavedDataset).mockResolvedValue(saved as never);
  const props=basePlan(),view=render(<ImpactDashboard {...props} datasetId="D" focus={{section:'downloads',revision:1}} />);
  fireEvent.click(await screen.findByRole('button',{name:'Download order list Excel'}));
  await waitFor(()=>expect(downloadPlannedOrdersWorkbook).toHaveBeenCalledOnce());
  const orders=()=>vi.mocked(downloadPlannedOrdersWorkbook).mock.lastCall![0].tables.find(t=>t.id==='orders')!;
  expect(orders().rows.find(row=>row[3]==='A')?.[4]).toBe(100);
  expect(orders().columns).not.toContain('Decision date');
  view.rerender(<ImpactDashboard {...props} drafts={{A:entered(9),B:entered(0)}} datasetId="D" focus={{section:'downloads',revision:1}} />);
  fireEvent.click(screen.getByRole('button',{name:'Download order list Excel'}));
  await waitFor(()=>expect(downloadPlannedOrdersWorkbook).toHaveBeenCalledTimes(2));
  expect(orders().rows.map(row=>row[4])).toEqual([9]);
  fireEvent.click(screen.getByRole('button',{name:'Print / Save PDF'}));
  expect(vi.mocked(printAnalysisReport).mock.lastCall![0].tables.find(t=>t.id==='orders')?.rows[0][4]).toBe(9);
  expect(JSON.stringify(saved)).toBe(before);
});
it('returns an empty order list to quantity editing without requiring a decision',async()=>{
  const props=basePlan();render(<ImpactDashboard {...props} drafts={{A:entered(0),B:entered(0)}} datasetId="D" focus={{section:'downloads',revision:1}} />);
  fireEvent.click(await screen.findByRole('button',{name:'Download order list Excel'}));
  expect((await screen.findByText(/^No planned orders\./)).closest('[role="alert"]')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Edit quantities in Purchase plan →'}));
  expect(props.onBack).toHaveBeenCalledOnce();
});

it('restores filters and selection on returning, and resets the view for new source evidence', async ()=>{
  const props=basePlan(), onViewChange=vi.fn();
  const initialView:PurchasePlanView={snapshotId:props.snapshot.id,query:'000202',group:'all',positiveOnly:false,financialSort:true,expanded:true};
  const rendered=render(<PurchasePlanScreen {...props} selectedKey="B" initialView={initialView} onViewChange={onViewChange} />);
  expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('000202');
  expect((screen.getByRole('checkbox',{name:'Sort by estimated financial risk'}) as HTMLInputElement).checked).toBe(true);
  expect(within(screen.getByRole('region',{name:'Same product name'})).getByText(/000202/)).toBeTruthy();
  await waitFor(()=>expect(onViewChange).toHaveBeenLastCalledWith(initialView));
  rendered.rerender(<PurchasePlanScreen {...props} snapshot={{...props.snapshot,id:'new-source'}} selectedKey="B" initialView={initialView} onViewChange={onViewChange} />);
  await waitFor(()=>expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe(''));
  expect((screen.getByRole('checkbox',{name:'Sort by estimated financial risk'}) as HTMLInputElement).checked).toBe(false);
});


it('shares automatic draft quantities, AI provenance and manual zero between planning, impact and exports',async()=>{
  const data=makeEvidence();
  const snapshot={...data.snapshot,evidenceKey:'auto-evidence',rows:data.snapshot.rows.map(row=>({...row,interpretedValues:{...row.interpretedValues,productName:row.productKey==='C'?'Unknown item':'Beras',packVariant:'500g'}})),productCosts:[{productKey:'A',field:'unit_cost' as const,state:'usable' as const,value:2.5,sourceRows:[2]}]};
  const drafts={B:entered(0)},before=JSON.stringify(drafts),changed=vi.fn();
  const props={snapshot,forecast:data.forecast,drafts,selectedKey:'A',onSelect:vi.fn(),onDraftChange:changed,onBack:vi.fn()};
  const purchase=render(<PurchasePlanScreen {...props} />);
  expect((screen.getByLabelText('Exact planned order quantity') as HTMLInputElement).value).toBe('12');
  expect(screen.getByRole('img',{name:/Recorded sales/})).toBeTruthy();
  expect(screen.getByRole('img',{name:/^Stock after order:/})).toBeTruthy();
  expect(changed).not.toHaveBeenCalled(); purchase.unmount();
  render(<ImpactDashboard {...props} datasetId="D" focus={{section:'downloads',revision:1}} />);
  await screen.findByRole('button',{name:'Download analysis Excel'});
  fireEvent.click(screen.getByRole('button',{name:'Download analysis Excel'}));
  await waitFor(()=>expect(downloadAnalysisWorkbook).toHaveBeenCalledOnce());
  const report=vi.mocked(downloadAnalysisWorkbook).mock.calls[0][0],results=report.tables.find(table=>table.id==='results')!;
  const row=(key:string)=>results.rows.find(row=>row[results.columns.indexOf('Product key')]===key)!;
  expect(row('A')[results.columns.indexOf('Planned quantity')]).toBe(12);
  expect(row('B')[results.columns.indexOf('Planned quantity')]).toBe(0);
  expect(JSON.stringify(report)).toContain('AI-assigned food category, not manually confirmed');
  expect(report.tables.find(table=>table.id==='orders')?.rows.map(row=>row[4])).toEqual([12]);
  expect(report.tables.some(table=>['decisions','evidence','finalorders'].includes(table.id))).toBe(false);
  expect(JSON.stringify(drafts)).toBe(before);
});
