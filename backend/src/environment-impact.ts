import type { ReadinessSnapshot } from './contracts.ts';
import type { ImpactReview } from './impact.ts';
import { planningMass, type PlanningContexts } from './planning-context.ts';
import { estimateCarbonImpact, summarizeCarbonImpact, type CarbonImpactInput } from './carbon.ts';
import { parsePackQuantity } from './cp3-mass.ts';
import type { RecordedStockOutcome, ReportingPeriod } from './outcomes.ts';
import { resolveProductPlanningContext } from './automatic-planning.ts';

/** Recorded waste, potential excess and the named scenario difference never share a total. */
export function buildEnvironmentalImpact(snapshot: ReadinessSnapshot, impact: ImpactReview, contexts: PlanningContexts = {}, outcomes: readonly RecordedStockOutcome[] = [], options: { datasetId?: string; period?: ReportingPeriod } = {}) {
  if (impact.snapshotId !== snapshot.id || impact.sourceSha256 !== snapshot.sourceSha256 || impact.analysisDate !== snapshot.analysisDate) throw new Error('Environmental impact requires current analysis evidence.');
  const evidence = (key:string) => {
    const context = resolveProductPlanningContext(snapshot,key,contexts[key]), mass = planningMass(snapshot,key,context,true);
    const base = { productKey:key, category:context?.category, categoryConfirmed:context?.categoryConfirmed ?? false, isFood:context?.isFood !== false,
      categorySource:context?.categorySource, categoryProvenance:context?.categoryProvenance,
      massKgPerUnit:mass.state === 'available' ? mass.kgPerUnit : undefined, conversionSource:mass.state === 'available' ? mass.provenance : undefined,
      massEstimated:mass.state === 'available' && mass.method !== 'manual' && (mass.method !== 'pack_parser' || mass.approximate) };
    return { base,mass };
  };
  const potentialResults = impact.products.map(p => estimateCarbonImpact({ ...evidence(p.productKey).base, productName:p.name, kind:'potential_excess', quantity:p.excessUnits, quantityUnit:'sales units' }));
  const scenarioResults = impact.products.map(p => {
    const nextExcess = p.available === undefined || p.plannedQuantity === undefined || p.scenarioQuantity === undefined || p.demandHigh === undefined ? undefined
      : Math.max(0,p.available - p.plannedQuantity + p.scenarioQuantity - p.demandHigh);
    return estimateCarbonImpact({ ...evidence(p.productKey).base,productName:p.name,kind:'scenario_difference',quantity:p.excessUnits === undefined || nextExcess === undefined ? undefined : p.excessUnits-nextExcess,
      quantityUnit:'sales units',baseline:'Current planned order minus restock recommendation; potential excess difference' });
  });
  const records = outcomes.filter(o => (!options.datasetId || o.datasetId === options.datasetId) && ['discarded','expired'].includes(o.kind)
    && (!options.period || (o.date >= options.period.start && o.date <= options.period.end)));
  const actualResults = records.map(o => {
    const {base,mass} = evidence(o.productKey);
    const identity = snapshot.rows.find(r=>r.productKey===o.productKey)?.interpretedValues;
    let conversion = o.conversion?.kilogramsPerUnit, source = o.conversion?.source;
    if (conversion === undefined && o.unit === 'pieces' && mass.state === 'available') { conversion=mass.kgPerUnit; source=mass.provenance; }
    if (conversion === undefined && o.unit === 'litres' && mass.state === 'available') {
      const pack = parsePackQuantity(identity?.packVariant ?? '');
      if (pack.state === 'available' && pack.dimension === 'l') { conversion=mass.kgPerUnit/pack.quantity; source=`${mass.provenance}; pack ${pack.quantity} litres`; }
    }
    const input: CarbonImpactInput = { ...base,productName:identity?.productName,kind:'recorded_waste',quantity:o.quantity,quantityUnit:o.unit,
      massEstimated:o.conversion ? o.conversion.estimated ?? false : base.massEstimated,
      massKgPerUnit:conversion,conversionSource:source,measuredMassKg:o.unit === 'kg' ? o.quantity : undefined };
    return estimateCarbonImpact(input);
  });
  // A missing record is represented for every current product, not interpreted as zero waste.
  for (const p of impact.products) if (!records.some(o=>o.productKey===p.productKey)) actualResults.push(estimateCarbonImpact({ ...evidence(p.productKey).base,productName:p.name,kind:'recorded_waste' }));
  return { potentialResults,scenarioResults,actualResults,potential:summarizeCarbonImpact(potentialResults),scenario:summarizeCarbonImpact(scenarioResults),recorded:summarizeCarbonImpact(actualResults) };
}
