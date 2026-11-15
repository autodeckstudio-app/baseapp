import type{RetainedTransportPhysical}from'./retained-transport-read.js';
/** Proposed concise labels only. Never a write permission or status rewrite. */
export function retainedTransportLabel(p:RetainedTransportPhysical):string{
 if(p.physicalState==='closed_unused')return'Unused legs closed';
 if(p.physicalState==='completed')return'Journey complete';
 if(p.requiresExplicitUnusedClosure&&!p.neededLegs.length)return'Needs closure';
 return p.neededLegs.length===2?'Pickup and drop pending':p.neededLegs[0]==='pickup'?'Pickup pending':p.neededLegs[0]==='drop'?'Drop pending':'Needs review';
}
