export const KERAMIK_COMPARISON_SOURCE='https://keramikcarcare.com/';
export const keramikSpecRows=[
 {key:'material',label:'What it is'},
 {key:'layer',label:'Layer'},
 {key:'system',label:'System'},
 {key:'finish',label:'Finish'},
 {key:'protection',label:'Protects'},
 {key:'warranty',label:'Warranty'},
 {key:'studioTime',label:'Time with us'},
] as const;
export type KeramikSpecKey=typeof keramikSpecRows[number]['key'];
export type KeramikSpecs=Record<KeramikSpecKey,string|null>;
/** Manufacturer facts, checked 24 November 2026. No inferred ceramic thickness,
 * duration, strength multiplier or warranty. Service IDs prevent similar names
 * or the held 10H product from acquiring the 9H Nano specifications.
 */
export function keramikSpecs(serviceId:string):KeramikSpecs|null{
 if(serviceId==='svc_12599d616b1d7ca131ab7249cf46141f')return {
  material:'Clear, two-part paint coating',layer:'About 20 microns',
  system:'Base A, then Active B; one panel at a time',finish:'Gloss, depth and a wet look',
  protection:'Helps protect against swirl marks, UV and everyday contamination',warranty:null,studioTime:null,
 };
 if(serviceId==='svc_a57eab7c55c8b31aaa52cc6463fc94b4')return {
  material:'9H ceramic coating for car paint',layer:null,
  system:'Applicator-applied, then buffed as directed',finish:'Mirror-like gloss and water beading',
  protection:'Helps protect against scratches, swirl marks and everyday environmental damage',warranty:null,studioTime:null,
 };
 return null;
}
