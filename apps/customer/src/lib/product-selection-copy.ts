import {presentationScope,reviewedPresentation,isScopeLimit} from './service-presentation';
import copy from './product-selection-copy.json';
/** Display-only descriptions matched to exact product names. Never mutates catalogue or booked snapshots. */
export function productSelectionDescription(service:{id?:string;name:string;description?:string|null}):string{
 const scoped=reviewedPresentation(service);if(scoped){const scope=presentationScope(service);return [scope.summary,...scope.included.filter(x=>x!==scope.summary),...scope.limits].join('\n');}
 const reviewed=(copy as Record<string,{summary:string;keyPoints:string[]}>)[service.name];
 if(!reviewed)return service.description??'';
 const conditions=(service.description??'').split('\n').slice(1).filter(line=>isScopeLimit(line));
 return [reviewed.summary,...reviewed.keyPoints,...conditions.filter(line=>!reviewed.keyPoints.includes(line))].join('\n');
}
