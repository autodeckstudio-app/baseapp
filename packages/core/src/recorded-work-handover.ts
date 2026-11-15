import type{WorkLedger,WorkScope}from'./performed-work';
import type{ProtectionWorkEvent,ProtectionCosmeticKind,ProtectionCoverageScope}from'./types/protection';
/** Carry exact QC evidence into delivery, never infer work or manufacturer coverage.
 * Null means review is required. An empty list is only returned for a sealed,
 * fully recorded service-only visit, never for a missing or partial ledger. */
export function recordedWorkHandover(ledger:WorkLedger,scope:WorkScope):ProtectionWorkEvent[]|null{
 if(!Number.isSafeInteger(ledger.revision)||ledger.revision<1||!ledger.sealedAt||Number.isNaN(Date.parse(ledger.sealedAt))||Object.entries(scope).some(([k,v])=>ledger.scope[k as keyof WorkScope]!==v)||ledger.lines.length===0||ledger.facts.length!==ledger.lines.length||new Set(ledger.lines.map(l=>l.id)).size!==ledger.lines.length)return null;
 const events:ProtectionWorkEvent[]=[];const targets=new Set<string>();
 for(const line of ledger.lines){
  if(line.source==='approved_extra'&&(!line.approvalId||line.approvalStatus!=='approved'))return null;
  const facts=ledger.facts.filter(f=>f.lineId===line.id);if(facts.length!==1)return null;const f=checkedValue(facts[0]);
  if(!f.performedBy||!f.qcBy||!f.qcAt||Number.isNaN(Date.parse(f.performedAt))||Number.isNaN(Date.parse(f.qcAt))||Date.parse(f.qcAt)<Date.parse(f.performedAt)||Date.parse(ledger.sealedAt)<Date.parse(f.qcAt)||line.productId!==f.productId)return null;
  if(f.action==='service'){if(f.productId!==null||f.targetId!==null||f.targetRevision!==null)return null;continue}
  if(!f.productId||!f.coverage)return null;
  if(f.action==='remove'||f.action==='replace'){if(!f.targetId||!Number.isSafeInteger(f.targetRevision)||checkedValue(f.targetRevision)<0||targets.has(f.targetId))return null;targets.add(f.targetId)}else if(f.targetId!==null||f.targetRevision!==null)return null;
  if(f.action==='remove'){events.push({action:'remove',targetProtectionId:checkedValue(f.targetId),expectedRevision:checkedValue(f.targetRevision)});continue}
  if(!['ppf','ceramic'].includes(f.productKind??'')||!['full_body','full_front','high_impact'].includes(f.coverage))return null;
  const spec={kind:f.productKind as ProtectionCosmeticKind,coverage:f.coverage as ProtectionCoverageScope,brand:null,warrantyYears:null};
  if(f.action==='install')events.push({action:'install',...spec});else if(f.action==='replace')events.push({action:'replace',targetProtectionId:checkedValue(f.targetId),expectedRevision:checkedValue(f.targetRevision),...spec});else return null;
 }
 return events;
}

const checkedValue=<T>(value:T|null|undefined):T=>{if(value===null||value===undefined)throw Error("Missing checked work value.");return value};
