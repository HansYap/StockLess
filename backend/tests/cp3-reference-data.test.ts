import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CP3_CATEGORY_DICTIONARY, FOODKEEPER_PRODUCTS, FOODKEEPER_AGGREGATES, CARBON_REFERENCE_ROWS, CP3_SOURCE_MANIFEST, PRICECATCHER_REFERENCES,
  resolveCarbonFactor, suggestProductCategory, resolveStorageWindow, parseCsvBytes, createMappingState, setMapping, confirmIdentityMode, runReadinessCheck, resolveReferencePrice, applyPlanningContexts, planningStorageWindow } from '../src/index.ts';

test('authorised source snapshots are hash verified and reproduce the 78 food categories: 42 agree, 13 estimates, 23 unavailable',()=>{
  assert.ok(Object.values(CP3_SOURCE_MANIFEST).every(r=>r.sourceManifestVerified));
  assert.equal(CP3_CATEGORY_DICTIONARY.length,80);
  const food=CP3_CATEGORY_DICTIONARY.filter(r=>r.isFood);
  assert.equal(food.length,78);
  const states={agree:0,estimate:0,unavailable:0};
  for(const r of food){
    assert.ok(CARBON_REFERENCE_ROWS.some(f=>f.category===r.category&&f.inCategoryTable));
    const f=resolveCarbonFactor(r.category);
    if(f.state==='unavailable')states.unavailable++;
    else if(f.label==='sources_agree')states.agree++;else states.estimate++;
  }
  assert.deepEqual(states,{agree:42,estimate:13,unavailable:23});
  const rice=suggestProductCategory('Beras putih 5kg');
  assert.equal(rice.state,'suggested');assert.equal(rice.category,'rice');assert.equal(rice.requiresConfirmation,true);
  assert.ok(rice.evidence.keywordHits.every(h=>h.provenance.includes('7316eed5')));
});

test('all 994 FoodKeeper product/storage picks preserve valid ranges; pantry never falls back to a category',()=>{
  assert.equal(FOODKEEPER_PRODUCTS.length,994);
  assert.equal(new Set(FOODKEEPER_PRODUCTS.map(p=>p.id)).size,994);
  for(const p of FOODKEEPER_PRODUCTS)for(const [storage,w] of Object.entries(p.windows)){
    const result=resolveStorageWindow({confirmed:true,storage:storage as 'pantry'|'refrigerate'|'freeze',productId:p.id,categoryId:p.categoryId},FOODKEEPER_PRODUCTS,FOODKEEPER_AGGREGATES);
    assert.equal(result.state,'estimated');
    if(result.state==='estimated'){assert.equal(result.days,w.minDays);assert.equal(result.maxDays,w.maxDays);assert.match(result.source,/SHA-256/);}
  }
  assert.equal(resolveStorageWindow({confirmed:true,storage:'pantry',categoryId:7},FOODKEEPER_PRODUCTS,FOODKEEPER_AGGREGATES).state,'unavailable');
  assert.equal(resolveStorageWindow({confirmed:true,storage:'refrigerate',productId:'fk128-1-fridge',categoryId:10},FOODKEEPER_PRODUCTS).state,'unavailable');
});

async function fixture(pack='2 kg'){
  const file=await parseCsvBytes(new TextEncoder().encode(`date,sku,name,pack,sales,cost\n2026-10-05,1,Ayam,${pack},5,`),{sourceMode:'user',sourceName:'reference-test.csv'});
  let m=createMappingState();
  for(const [i,field] of (['transaction_date','product_code','product_name','pack_variant','quantity_sold','unit_cost'] as const).entries())m=setMapping(m,field,`column-${i}`,true);
  return runReadinessCheck(file,confirmIdentityMode(m,'stable'),{analysisDate:'2026-10-06'});
}
test('reference price needs an explicit match, scales compatible units and never supplies seller cost',async()=>{
  const s=await fixture(), key=s.rows[0].productKey!;
  assert.equal(resolveReferencePrice(s,key).state,'unavailable'); // SKU 1 is not a reference match.
  const context={evidenceKey:s.evidenceKey!,priceCatcherItemCode:'1'};
  const ref=resolveReferencePrice(s,key,context);
  assert.equal(ref.state,'available');if(ref.state==='available'){assert.equal(ref.price,19.38);assert.equal(ref.referenceOnly,true);assert.match(ref.source,/never seller purchase cost/);}
  assert.equal(applyPlanningContexts(s,{[key]:context}).productCosts?.find(r=>r.productKey===key)?.state,'missing');
  assert.equal(resolveReferencePrice(s,key,{...context,evidenceKey:'old'}).state,'unavailable');
  assert.equal(resolveReferencePrice(s,key,{...context,priceCatcherItemCode:'118'}).state,'unavailable'); // No stable egg price.
  const litres=await fixture('1 L');assert.equal(resolveReferencePrice(litres,key,{...context,evidenceKey:litres.evidenceKey!}).state,'unavailable');
  const pick=planningStorageWindow(s,{evidenceKey:s.evidenceKey!,storageSelection:{confirmed:true,storage:'refrigerate',categoryId:7,productId:'fk128-1-fridge'}});
  assert.equal(pick.state,'estimated');if(pick.state==='estimated'){assert.equal(pick.days,30);assert.equal(pick.maxDays,60);}
  assert.equal(PRICECATCHER_REFERENCES.length,328);
});
