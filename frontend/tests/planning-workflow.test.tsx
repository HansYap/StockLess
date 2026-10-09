import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PurchasePlanScreen, type PurchasePlanView } from '../src/screens/PurchasePlanScreen.tsx';
import { ImpactDashboard } from '../src/screens/ImpactDashboard.tsx';
import { createPurchaseDecision, type AnalysisReport } from '../src/engine.ts';
import { getSavedDataset } from '../src/storage/saved-datasets.ts';
import { downloadFinalisedOrdersWorkbook, printAnalysisReport } from '../src/purchase-plan/analysis-report-export.ts';
import { setLanguage } from '../src/i18n/index.ts';
import { makeEvidence } from './fixtures.ts';

vi.mock('../src/storage/saved-datasets.ts', async original => ({ ...await original<object>(), getSavedDataset:vi.fn() }));
vi.mock('../src/purchase-plan/analysis-report-export.ts', async original => {
  const actual=await original<typeof import('../src/purchase-plan/analysis-report-export.ts')>();
  return { ...actual, printAnalysisReport:vi.fn(), downloadFinalisedOrdersWorkbook:vi.fn(async (report:AnalysisReport)=>{if(!report.tables.find(table=>table.id==='finalorders')?.rows.length)throw new actual.NoFinalisedOrdersError();}) };
});
beforeEach(()=>{setLanguage('en');vi.clearAllMocks();vi.mocked(getSavedDataset).mockResolvedValue({decisions:[],outcomes:[]} as never);});
const entered=(value:number)=>({plannedOrder:{state:'value' as const,value,source:'input by you' as const},incomingStock:{state:'empty' as const}});
const basePlan=()=>({ ...makeEvidence(),drafts:{A:entered(100)},selectedKey:'A',onSelect:vi.fn(),onDraftChange:vi.fn(),onBack:vi.fn() });

it('keeps final choices in Purchase plan and routes actual records and downloads to Impact', async ()=>{
  const props=basePlan(), onImpact=vi.fn(); render(<PurchasePlanScreen {...props} datasetId="D" onImpact={onImpact} />);
  const final=screen.getByText('Save your final choice'); expect(final.closest('details')?.open).toBe(false);
  expect(screen.queryByRole('button',{name:'Save decision'})).toBeNull();
  fireEvent.click(final);
  expect((await screen.findByLabelText('Final quantity') as HTMLInputElement).value).toBe('100');
  expect((screen.getByLabelText('Response') as HTMLSelectElement).value).toBe('Changed');
  expect(screen.queryByLabelText('Recorded quantity')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Record what happened in Impact →'}));
  expect(onImpact).toHaveBeenLastCalledWith('outcomes');
  fireEvent.click(screen.getByRole('button',{name:'Download saved final orders →'}));
  expect(onImpact).toHaveBeenLastCalledWith('downloads');
  expect(props.onDraftChange).not.toHaveBeenCalled();
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

it('opens the requested final choice even when its product is outside the saved filter', async ()=>{
  const props=basePlan();
  render(<PurchasePlanScreen {...props} initialView={{snapshotId:props.snapshot.id,query:'000202',group:'all',positiveOnly:false,financialSort:false,expanded:false}} decisionFocus={{productKey:'A',revision:1}} />);
  await waitFor(()=>expect(screen.getByText('Save your final choice').closest('details')?.open).toBe(true));
  expect(screen.getByText('Selected product outside current filter')).toBeTruthy();
  expect((screen.getByLabelText('Final quantity') as HTMLInputElement).value).toBe('100');
});

it('opens actual records for the shared selected product without duplicating purchase choices', async ()=>{
  const props=basePlan(), onSelect=vi.fn(), onPurchaseDecision=vi.fn();
  render(<ImpactDashboard {...props} selectedKey="B" onSelect={onSelect} focus={{section:'outcomes',revision:1}} onPurchaseDecision={onPurchaseDecision} />);
  await waitFor(()=>expect(screen.getByText('Record what happened').closest('details')?.open).toBe(true));
  expect((screen.getByLabelText('Product for actual records') as HTMLSelectElement).value).toBe('B');
  expect(screen.queryByLabelText('Response')).toBeNull();
  expect(screen.getByLabelText('Recorded quantity')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:"Review this product's final choice →"}));
  expect(onPurchaseDecision).toHaveBeenCalledWith('B');
  fireEvent.change(screen.getByLabelText('Product for actual records'),{target:{value:'A'}});
  expect(onSelect).toHaveBeenCalledWith('A');
});

it('downloads freshly saved final choices separately from later draft edits', async ()=>{
  const decision=createPurchaseDecision({id:'choice',datasetId:'D',response:'Changed',finalQuantity:6,reason:'Shelf space',referenceDate:'2026-10-08',recordedAt:'2026-10-08T10:00:00Z',recommendation:{productKey:'A',productName:'Same product name',productCode:'000101',sourceName:'test.csv',sourceSha256:'test',sourceMode:'user',analysisDate:'2026-09-14',policyVersion:'cp3-v2',recommendedQuantity:12,quantityUnit:'pieces'}});
  let resolveInitial!: (value:never)=>void;
  vi.mocked(getSavedDataset).mockImplementationOnce(()=>new Promise(resolve=>{resolveInitial=resolve;})).mockResolvedValue({decisions:[{id:decision.id,purchaseDecision:decision}],outcomes:[]} as never);
  render(<ImpactDashboard {...basePlan()} datasetId="D" focus={{section:'downloads',revision:1}} />);
  await screen.findByRole('button',{name:'Download final orders Excel'});
  fireEvent.click(screen.getByRole('button',{name:'Download final orders Excel'}));
  await waitFor(()=>expect(downloadFinalisedOrdersWorkbook).toHaveBeenCalledOnce());
  const report=vi.mocked(downloadFinalisedOrdersWorkbook).mock.calls[0][0], final=report.tables.find(table=>table.id==='finalorders')!, drafts=report.tables.find(table=>table.id==='results')!;
  expect(final.rows[0][final.columns.indexOf('Final quantity')]).toBe(6);
  expect(drafts.rows.find(row=>row[drafts.columns.indexOf('Product key')]==='A')?.[drafts.columns.indexOf('Planned quantity')]).toBe(100);
  await act(async()=>resolveInitial({decisions:[],outcomes:[]} as never));
  fireEvent.click(screen.getByRole('button',{name:'Print / Save PDF'}));
  expect(vi.mocked(printAnalysisReport).mock.calls[0][0].tables.find(table=>table.id==='finalorders')?.rows[0][4]).toBe(6);
});

it('returns an empty final-order download to the selected product final-choice prompt', async ()=>{
  const onPurchaseDecision=vi.fn(); render(<ImpactDashboard {...basePlan()} datasetId="D" selectedKey="B" focus={{section:'downloads',revision:1}} onPurchaseDecision={onPurchaseDecision} />);
  fireEvent.click(await screen.findByRole('button',{name:'Download final orders Excel'}));
  expect((await screen.findByText(/^No finalised orders\./)).closest('[role="alert"]')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Save a final choice in Purchase plan →'}));
  expect(onPurchaseDecision).toHaveBeenCalledWith('B');
  expect(screen.queryByRole('button',{name:'Save decision'})).toBeNull();
});
