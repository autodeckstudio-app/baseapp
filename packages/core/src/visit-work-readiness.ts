import type { WorkLedger, WorkScope } from './performed-work';

export type VisitBookedWork = { serviceId: string; name: string };
export type VisitExtraWork = { id: string; serviceId: string; serviceName: string; status: string };
export type VisitWorkReadiness = { ready: boolean; reason: 'ready' | 'approval_pending' | 'scope_changed' | 'work_missing' | 'work_changed' | 'qc_missing'; total: number; checked: number };
/** Service work is separate from physical pickup. A purchased line is not a
 * performed line; one checked line cannot complete a different one. Warranty
 * and protection eligibility remain the responsibility of their own guards. */
export function visitWorkReadiness(input: { scope: WorkScope; booked: readonly VisitBookedWork[]; extras: readonly VisitExtraWork[]; ledger: WorkLedger | null }): VisitWorkReadiness {
  const {scope,booked,extras,ledger}=input;
  const approved=extras.filter(e=>e.status==='approved');
  const total=booked.length+approved.length;
  const result=(reason:VisitWorkReadiness['reason'],checked=0):VisitWorkReadiness=>({ready:reason==='ready',reason,total,checked});
  if(extras.some(e=>e.status==='pending'))return result('approval_pending');
  if(extras.some(e=>!['pending','approved','rejected','expired','cancelled'].includes(e.status))||!booked.length||new Set(extras.map(e=>e.id)).size!==extras.length)return result('work_changed');
  if(!ledger)return result('work_missing');
  if(Object.entries(scope).some(([k,v])=>ledger.scope[k as keyof WorkScope]!==v))return result('scope_changed');
  if(!Number.isSafeInteger(ledger.revision)||ledger.revision<1||ledger.lines.length!==total||ledger.facts.length!==total||new Set(ledger.lines.map(l=>l.id)).size!==total||new Set(ledger.facts.map(f=>f.lineId)).size!==total)return result('work_missing');
  const expected=[...booked.map((b,i)=>({id:`booked-${i}`,serviceId:b.serviceId,title:b.name,source:'booked',approvalId:null,approvalStatus:null})),...approved.map(e=>({id:`extra-${e.id}`,serviceId:e.serviceId,title:e.serviceName,source:'approved_extra',approvalId:e.id,approvalStatus:'approved'}))];
  let checked=0;
  for(const line of expected){
    const actual=ledger.lines.find(l=>l.id===line.id);
    if(!actual||Object.entries(line).some(([k,v])=>actual[k as keyof typeof actual]!==v))return result('work_changed',checked);
    const fact=ledger.facts.find(f=>f.lineId===line.id);
    if(!fact||fact.productId!==actual.productId||!fact.performedBy?.trim()||!Number.isFinite(Date.parse(fact.performedAt)))return result('work_missing',checked);
    if(!fact.qcBy?.trim()||!fact.qcAt||!Number.isFinite(Date.parse(fact.qcAt))||Date.parse(fact.qcAt)<Date.parse(fact.performedAt))return result('qc_missing',checked);
    checked++;
  }
  return result('ready',checked);
}
