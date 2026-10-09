import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import { StockOutcomeControls,malaysiaToday } from '../src/components/StockOutcomeControls.tsx';
import { createStockOutcome,OutcomeValidationError } from '../src/engine.ts';
import { setLanguage } from '../src/i18n/index.ts';
import { getSavedDataset,saveStockOutcome,updateSavedStockOutcome,removeSavedOutcome,savePurchaseDecision } from '../src/storage/saved-datasets.ts';
import { makeEvidence } from './fixtures.ts';
vi.mock('../src/storage/saved-datasets.ts',async original=>({...await original<object>(),getSavedDataset:vi.fn(),saveStockOutcome:vi.fn(),updateSavedStockOutcome:vi.fn(),removeSavedOutcome:vi.fn(),savePurchaseDecision:vi.fn()}));
beforeEach(()=>{setLanguage('en');vi.clearAllMocks();vi.mocked(getSavedDataset).mockResolvedValue(undefined);});
const props=()=>({datasetId:'D',snapshot:makeEvidence().snapshot,product:{key:'A',title:'Tea',sku:'0001',pack:'250 g'}});
it('opens actual records without saving anything or showing a purchase-decision form',async()=>{
  expect(malaysiaToday(new Date('2026-10-07T17:00:00Z'))).toBe('2026-10-08');render(<StockOutcomeControls {...props()} />);
  await waitFor(()=>expect(getSavedDataset).toHaveBeenCalled());
  expect(savePurchaseDecision).not.toHaveBeenCalled();expect(saveStockOutcome).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Final quantity')).toBeNull();expect(screen.queryByLabelText('Related decision (optional)')).toBeNull();
  expect(screen.getByText('No outcome recorded.')).toBeTruthy();
});
it('records explicit zero independently of any purchase choice',async()=>{
  render(<StockOutcomeControls {...props()} />);fireEvent.change(screen.getByLabelText('Recorded quantity'),{target:{value:'0'}});fireEvent.click(screen.getByRole('button',{name:'Save actual outcome'}));
  await waitFor(()=>expect(saveStockOutcome).toHaveBeenCalledWith('D',expect.objectContaining({productKey:'A',quantity:'0',kind:'discarded',unit:'pieces',decisionId:undefined})));
  expect(savePurchaseDecision).not.toHaveBeenCalled();
});
it('keeps invalid observed input visible and translates its correction',async()=>{
  setLanguage('zh');vi.mocked(saveStockOutcome).mockRejectedValue(new OutcomeValidationError({quantity:'Bad quantity'}));
  render(<StockOutcomeControls {...props()} />);fireEvent.change(screen.getByLabelText('实际记录数量'),{target:{value:'bad'}});fireEvent.click(screen.getByRole('button',{name:'保存实际结果'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('请修正数量'));expect((screen.getByLabelText('实际记录数量') as HTMLInputElement).value).toBe('bad');
});
it('preserves old links and conversion evidence when editing an actual record',async()=>{
  const outcome=createStockOutcome({id:'old',datasetId:'D',productKey:'A',kind:'discarded',date:'2026-10-08',quantity:2,unit:'pieces',decisionId:'historical-choice',conversion:{kilogramsPerUnit:.25,source:'Original measured pack'},referenceDate:'2026-10-08',recordedAt:'2026-10-08T10:00:00Z'});
  vi.mocked(getSavedDataset).mockResolvedValue({outcomes:[{id:'old',stockOutcome:outcome}]} as never);
  render(<StockOutcomeControls {...props()} />);fireEvent.click(await screen.findByText('Saved actual records (1)'));fireEvent.click(screen.getByRole('button',{name:'Edit outcome'}));
  fireEvent.change(screen.getByLabelText('Recorded quantity'),{target:{value:'3'}});fireEvent.click(screen.getByRole('button',{name:'Save actual outcome'}));
  await waitFor(()=>expect(updateSavedStockOutcome).toHaveBeenCalledWith('D','old',expect.objectContaining({quantity:'3',decisionId:'historical-choice',conversion:outcome.conversion})));
});
it('requires the existing deletion confirmation for actual records',async()=>{
  const outcome=createStockOutcome({id:'old',datasetId:'D',productKey:'A',kind:'discarded',date:'2026-10-08',quantity:0,unit:'kg',referenceDate:'2026-10-08',recordedAt:'2026-10-08T10:00:00Z'});
  vi.mocked(getSavedDataset).mockResolvedValue({outcomes:[{id:'old',stockOutcome:outcome}]} as never);render(<StockOutcomeControls {...props()} />);
  fireEvent.click(await screen.findByText('Saved actual records (1)'));fireEvent.click(screen.getByRole('button',{name:'Delete outcome'}));expect(removeSavedOutcome).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Confirm delete'}));await waitFor(()=>expect(removeSavedOutcome).toHaveBeenCalledWith('D','old'));
});
it('keeps sample records disabled',()=>{
  const input=props();render(<StockOutcomeControls {...input} snapshot={{...input.snapshot,sourceMode:'sample'}} />);
  expect(screen.getByRole('button',{name:'Save actual outcome'}).matches(':disabled')).toBe(true);
});
