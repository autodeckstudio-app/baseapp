import type{WorkCommandScope}from'@autodeck/core';
export type WorkTargetOption={id:string;revision:number;kind:'ppf'|'ceramic';coverage:string|null;label:string};
const id=(v:unknown,max=120):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&/^[A-Za-z0-9_-]+$/.test(v);
/** Current cosmetic Protection records offered as replace/remove targets for
 * work recording. The stored document ID and every ownership field are
 * checked, never name-matched. Non-cosmetic kinds and history records are
 * not targets; a corrupt record fails the whole read closed. A record with
 * no revision field is the explicit legacy revision 0. The label is
 * display-only and is never sent in a command. */
export function parseWorkTargets(docs:{id:string;data:unknown}[],scope:WorkCommandScope):WorkTargetOption[]{
 if(docs.length>100)throw Error('Protection records need review');const seen=new Set<string>();const result:WorkTargetOption[]=[];
 for(const doc of docs){const p=doc.data as Record<string,unknown>|null;if(!p)throw Error('Protection records need review');
  if(!id(doc.id)||seen.has(doc.id))throw Error('Protection records need review');seen.add(doc.id);
  if(p['tenantId']!==scope.tenantId||p['vehicleId']!==scope.vehicleId||p['customerId']!==scope.customerId)continue;
  if(p['id']!==undefined&&p['id']!==doc.id)throw Error('Protection records need review');
  if(p['kind']!=='ppf'&&p['kind']!=='ceramic')continue;
  if((p['lifecycle']??'current')!=='current')continue;
  const revision=p['revision']===undefined||p['revision']===null?0:p['revision'];
  if(!Number.isSafeInteger(revision)||(revision as number)<0)throw Error('Protection records need review');
  const coverage=p['coverage']===undefined||p['coverage']===null?null:p['coverage'];
  if(coverage!==null&&(typeof coverage!=='string'||!['full_body','full_front','high_impact'].includes(coverage)))throw Error('Protection records need review');
  const provider=p['provider']===undefined||p['provider']===null?null:p['provider'];
  if(provider!==null&&(typeof provider!=='string'||!provider.trim()||provider.length>200))throw Error('Protection records need review');
  result.push({id:doc.id,revision:revision as number,kind:p['kind'],coverage:coverage as string|null,label:(provider as string|null)??(p['kind']==='ppf'?'PPF':'Ceramic')});
 }return result;
}
