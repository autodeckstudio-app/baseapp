import{describe,it,expect}from'vitest';import{reviewPerformedWork,workProjection,protectionLifecycleTarget,type WorkLedger,type WorkFact,type WorkScope}from'./performed-work.js';
const scope:WorkScope={tenantId:'t',studioId:'s',jobId:'j',vehicleId:'v',customerId:'c'};
const base=():WorkLedger=>({scope,revision:1,sealedAt:null,lines:[{id:'l',serviceId:'svc',productId:'p',title:'Protection',source:'booked',approvalId:null,approvalStatus:null}],facts:[]});
const fact=():WorkFact=>({lineId:'l',action:'install',productId:'p',productKind:'ppf',coverage:'full_front',targetId:null,targetRevision:null,performedBy:'staff',performedAt:'2026-11-09T01:00:00Z',qcBy:'qc',qcAt:'2026-11-09T02:00:00Z',warranty:{kind:'none',reviewedBy:'qc'}});
const current={scope,vehicleActive:true,terms:[],targets:[]};
const review=(change:Partial<WorkFact>={})=>reviewPerformedWork({...base(),facts:[{...fact(),...change}]},current);
describe('performed work cross-app contract',()=>{
it('purchase alone is not performed',()=>expect(reviewPerformedWork(base(),current).map(i=>i.code)).toContain('not_recorded'));
it('explicit reviewed work passes without inventing warranty',()=>expect(review()).toEqual([]));
it('unknown terms fail',()=>expect(review({warranty:{kind:'unknown'}}).map(i=>i.code)).toContain('terms_missing'));
it('product mismatch fails',()=>expect(review({productId:'other'}).map(i=>i.code)).toContain('product_changed'));
it('missing QC fails',()=>expect(review({qcAt:null}).map(i=>i.code)).toContain('qc_missing'));
it('QC before performance fails',()=>expect(review({qcAt:'2026-11-08T01:00:00Z'}).map(i=>i.code)).toContain('qc_missing'));
it('changed current owner fails',()=>expect(reviewPerformedWork(base(),{...current,scope:{...scope,customerId:'new'}}).map(i=>i.code)).toContain('scope_changed'));
it('archive fails',()=>expect(reviewPerformedWork(base(),{...current,vehicleActive:false}).map(i=>i.code)).toContain('scope_changed'));
it('changed target revision fails',()=>expect(review({action:'replace',targetId:'old',targetRevision:2}).map(i=>i.code)).toContain('target_changed'));
it('duplicates fail rather than choose a winner',()=>expect(reviewPerformedWork({...base(),facts:[fact(),fact()]},current).map(i=>i.code)).toContain('duplicate_fact'));
it('unknown term version fails',()=>expect(review({warranty:{kind:'terms',id:'term',version:9}}).map(i=>i.code)).toContain('terms_changed'));
it('removal cannot add warranty',()=>expect(review({action:'remove',warranty:{kind:'terms',id:'term',version:1}}).map(i=>i.code)).toContain('removal_terms'));
it('pending additional work fails',()=>{const l=base();l.lines[0]={...checkedValue(l.lines[0]),source:'approved_extra',approvalId:'a',approvalStatus:null};expect(reviewPerformedWork({...l,facts:[fact()]},current).map(i=>i.code)).toContain('unapproved_extra')});
it('all three use exact same linked records, customer drops staff identities',()=>{const l={...base(),facts:[fact()]};const c=workProjection(l,[],'customer'),s=workProjection(l,[],'studio'),a=workProjection(l,[],'admin');expect(c.jobId).toBe(s.jobId);expect(c.items[0]?.lineId).toBe(a.items[0]?.lineId);expect(c.items[0]).not.toHaveProperty('performedBy');expect(s.items[0]).toHaveProperty('performedBy','staff');expect(l.sealedAt).toBeNull()});
});

describe('approved exact term and prior visit target',()=>{it('accepts exact terms without issuing anything',()=>{const l={...base(),facts:[{...fact(),warranty:{kind:'terms' as const,id:'term',version:1}}]};expect(reviewPerformedWork(l,{...current,terms:[{id:'term',version:1,productId:'p',coverage:'full_front',text:'Approved sample only',label:'Sample'}]})).toEqual([])});it('prior job target is valid when car/customer/studio and revision match',()=>{const l={...base(),facts:[{...fact(),action:'replace' as const,targetId:'old',targetRevision:2}]};expect(reviewPerformedWork(l,{...current,targets:[{id:'old',revision:2,productId:'p',productKind:'ppf',coverage:'full_front',current:true,scope:{...scope,jobId:'oldJob'}}]})).toEqual([])})});

it('changed scope projects no stale work details',()=>{const l={...base(),facts:[fact()]};const i=reviewPerformedWork(l,{...current,scope:{...scope,customerId:'new'}});for(const audience of ['customer','studio','admin']as const)expect(workProjection(l,i,audience).items).toEqual([])});

describe('replacement scope without invented product equality',()=>{
 const target={id:'old',revision:2,productId:'old-brand',productKind:'ppf',coverage:'full_front',current:true,scope:{...scope,jobId:'oldJob'}};
 const l=():WorkLedger=>({...base(),facts:[{...fact(),action:'replace' as const,targetId:'old',targetRevision:2}]});
 it('allows a different product in same known kind/scope',()=>expect(reviewPerformedWork(l(),{...current,targets:[target]})).toEqual([]));
 it('does not infer kind from product id',()=>expect(reviewPerformedWork(l(),{...current,targets:[{...target,productKind:null}]}).map(i=>i.code)).toContain('target_changed'));
 it('rejects changed kind or coverage',()=>{for(const t of [{...target,productKind:'ceramic'},{...target,coverage:'full_body'}])expect(reviewPerformedWork(l(),{...current,targets:[t]}).map(i=>i.code)).toContain('target_changed')});
 it('removal needs exact old product',()=>{const x=l();x.facts[0]={...checkedValue(x.facts[0]),action:'remove'};expect(reviewPerformedWork(x,{...current,targets:[target]}).map(i=>i.code)).toContain('target_changed')});
 it('invalid QC is never presented as completed',()=>{const x={...base(),facts:[{...fact(),qcAt:'not-a-date'}]};const issues=reviewPerformedWork(x,current);expect(workProjection(x,issues,'customer').items[0]?.status).toBe('Needs review')});
});

it('work and coverage review are independent, unknown terms do not erase recorded QC',()=>{const ledger={...base(),facts:[{...fact(),warranty:{kind:'unknown' as const}}]};const issues=reviewPerformedWork(ledger,current);const view=workProjection(ledger,issues,'customer');expect(view.ready).toBe(false);expect(view.items[0]?.status).toBe('QC recorded');expect(view.items[0]?.warranty).toBe('Terms not confirmed');expect(view.items[0]).not.toHaveProperty('performedBy')});

it('newly recorded work awaits explicit QC, not an unexplained review error',()=>{const ledger={...base(),facts:[{...fact(),qcAt:null,qcBy:null,warranty:{kind:'unknown' as const}}]};const issues=reviewPerformedWork(ledger,current);expect(workProjection(ledger,issues,'customer').items[0]?.status).toBe('Needs QC')});

describe('lifecycle target resolution from the exact Protection record',()=>{
 const record={id:'prot1',tenantId:'t',vehicleId:'v',customerId:'c',kind:'ppf',provider:'SampleBrand',coverage:'full_front',lifecycle:'current',revision:2,installedByJobId:'oldJob'};
 it('maps only the record own fields, legacy revision explicit 0',()=>{expect(protectionLifecycleTarget({...record,revision:null},'s')).toMatchObject({id:'prot1',revision:0,productId:'SampleBrand',productKind:'ppf',coverage:'full_front',current:true,scope:{tenantId:'t',studioId:'s',jobId:'oldJob',vehicleId:'v',customerId:'c'}})});
 it('missing provider, kind or scope stay unknown, never assumed',()=>{expect(protectionLifecycleTarget({...record,provider:null,coverage:null,kind:'insurance'},'s')).toMatchObject({productId:null,productKind:null,coverage:null})});
 it('malformed stored revision can never equal a declared revision',()=>{const t=protectionLifecycleTarget({...record,revision:-1},'s');const l={...base(),facts:[{...fact(),action:'replace' as const,targetId:'prot1',targetRevision:0}]};expect(reviewPerformedWork(l,{...current,targets:[t]}).map(i=>i.code)).toContain('target_changed')});
 it('history records and former-owner records are not targets',()=>{for(const change of[{lifecycle:'removed'},{customerId:'former'}]){const t=protectionLifecycleTarget({...record,...change},'s');const l={...base(),facts:[{...fact(),action:'replace' as const,targetId:'prot1',targetRevision:2}]};expect(reviewPerformedWork(l,{...current,targets:[t]}).map(i=>i.code)).toContain('target_changed')}});
});

const checkedValue=<T>(value:T|null|undefined):T=>{if(value===null||value===undefined)throw Error("Missing checked work value.");return value};
