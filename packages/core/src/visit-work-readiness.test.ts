function fixtureValue<T>(value:T|null|undefined):T { if(value===null||value===undefined)throw Error('Missing required test fixture value'); return value; }
import {describe,it,expect} from 'vitest';
import {visitWorkReadiness} from './visit-work-readiness';
import type {WorkLedger} from './performed-work';
const scope={tenantId:'t',studioId:'s',jobId:'j',vehicleId:'v',customerId:'c'};
const booked=[{serviceId:'wash',name:'Wash'},{serviceId:'ceramic',name:'Ceramic'}];
const extras=[{id:'approval',serviceId:'repair',serviceName:'Repair',status:'approved'}];
function ledger():WorkLedger{return {scope:{...scope},revision:1,sealedAt:null,lines:[...booked.map((b,i)=>({id:`booked-${i}`,serviceId:b.serviceId,productId:null,title:b.name,source:'booked' as const,approvalId:null,approvalStatus:null})),{id:'extra-approval',serviceId:'repair',productId:null,title:'Repair',source:'approved_extra',approvalId:'approval',approvalStatus:'approved'}],facts:['booked-0','booked-1','extra-approval'].map(lineId=>({lineId,action:'service',productId:null,coverage:null,targetId:null,targetRevision:null,performedBy:'worker',performedAt:'2026-11-14T10:00:00Z',qcBy:'qc',qcAt:'2026-11-14T11:00:00Z',warranty:{kind:'unknown'}}))};}
const check=(l:WorkLedger|null=ledger(),e=extras)=>visitWorkReadiness({scope,booked,extras:e,ledger:l});
describe('visit work readiness without changing pickup, money or warranty',()=>{
 it('all booked and approved-extra services checked independently allow readiness without inferring warranty',()=>{expect(check()).toEqual({ready:true,reason:'ready',total:3,checked:3});expect(ledger().sealedAt).toBeNull()});
 it('purchase, payment or job stage cannot replace work facts',()=>{expect(check(null).reason).toBe('work_missing');const l=ledger();l.facts=[];expect(check(l).ready).toBe(false)});
 it.each(['tenantId','studioId','jobId','vehicleId','customerId'] as const)('rejects changed %s',field=>{const l=ledger();l.scope[field]='other';expect(check(l).reason).toBe('scope_changed')});
 it.each(['booked-0','booked-1','extra-approval'])('each service including %s needs its own QC',id=>{const l=ledger();fixtureValue(l.facts.find(f=>f.lineId===id)).qcAt=null;expect(check(l).reason).toBe('qc_missing')});
 it('a pending extra prevents ready even though booked work is checked',()=>{expect(check(ledger(),[...extras,{id:'next',serviceId:'next',serviceName:'Next',status:'pending'}]).reason).toBe('approval_pending')});
 it.each(['rejected','expired','cancelled'])('%s extras are not work to complete',status=>{expect(check(ledger(),[...extras,{id:'next',serviceId:'next',serviceName:'Next',status}]).ready).toBe(true)});
 it('an approved extra omitted from the ledger blocks ready',()=>{expect(check(ledger(),[...extras,{id:'next',serviceId:'next',serviceName:'Next',status:'approved'}]).reason).toBe('work_missing')});
 it.each(['serviceId','title','source','approvalId','approvalStatus'] as const)('changed work-line %s blocks ready',field=>{const l=ledger();(l.lines[2] as any)[field]='changed';expect(check(l).reason).toBe('work_changed')});
 it('duplicate facts, orphan facts and duplicated line identities cannot make work complete',()=>{for(const change of [(l:WorkLedger)=>{l.facts[2]={...fixtureValue(l.facts[1])}},(l:WorkLedger)=>{fixtureValue(l.facts[2]).lineId='orphan'},(l:WorkLedger)=>{l.lines[2]={...fixtureValue(l.lines[1])}}]){const l=ledger();change(l);expect(check(l).ready).toBe(false)}});
 it.each(['not-a-date','2026-11-14T09:00:00Z'])('invalid or earlier QC %s blocks ready',qcAt=>{const l=ledger();fixtureValue(l.facts[0]).qcAt=qcAt;expect(check(l).reason).toBe('qc_missing')});
 it('later approved scope changes and stale cancelled approval lines fail closed',()=>{expect(check(ledger(),[{...fixtureValue(extras[0]),status:'cancelled'}]).ready).toBe(false)});
 it('same service in two separately approved lines remains two work items',()=>{const l=ledger();fixtureValue(l.lines[1]).serviceId='wash';expect(visitWorkReadiness({scope,booked:[fixtureValue(booked[0]),fixtureValue(booked[0])],extras,ledger:{...l,lines:l.lines.map((x,i)=>i===1?{...x,title:'Wash'}:x)}}).ready).toBe(true)});
});
