import copy from './product-selection-copy.json';
/** Display-only descriptions matched to exact product names. Never mutates catalogue or booked snapshots. */
export function productSelectionDescription(service:{name:string;description?:string|null}):string{
 const reviewed=(copy as Record<string,{summary:string;keyPoints:string[]}>)[service.name];
 if(!reviewed)return service.description??'';
 const conditions=(service.description??'').split('\n').slice(1).filter(line=>/^(?:Not|Only for|Requires|Do not)\b/i.test(line));
 return [reviewed.summary,...reviewed.keyPoints,...conditions.filter(line=>!reviewed.keyPoints.includes(line))].join('\n');
}
