import type{WorkCommandScope}from'@autodeck/core';
export type WorkExtraOption={id:string;approvalId:string;title:string};
const id=(v:unknown,max=120):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&/^[A-Za-z0-9_-]+$/.test(v);
/** Stored doc ID and every ownership field are checked, never name-matched. */
export function parseWorkExtras(docs:{id:string;data:unknown}[],scope:WorkCommandScope):WorkExtraOption[]{
 if(docs.length>100)throw Error('Extra work needs review');const seen=new Set<string>();const result:WorkExtraOption[]=[];
 for(const doc of docs){const a=doc.data as Record<string,unknown>|null;if(!a||a['status']!=='approved')continue;
  if(!id(doc.id,114)||a['id']!==doc.id||seen.has(doc.id)||['tenantId','studioId','jobId','customerId','vehicleId'].some(k=>a[k]!==scope[k as keyof WorkCommandScope])||!id(a['serviceId'])||typeof a['serviceName']!=='string'||!a['serviceName'].trim()||a['serviceName'].length>300)throw Error('Extra work needs review');
  seen.add(doc.id);result.push({id:`extra-${doc.id}`,approvalId:doc.id,title:a['serviceName']});
 }return result;
}
