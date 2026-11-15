/** An explicit service plan can overlap compatible work in one bay, never
 * reserve one physical car in two bays at the same instant. No order is inferred. */
export type VisitScheduleLine={jobId:string;bayId:string;requiredBayType:string;bayType:string;startAt:string;endAt:string};
export function visitScheduleProblem(lines:readonly VisitScheduleLine[]):'invalid_schedule'|'different_bays_overlap'|null{
 if(!lines.length||lines.length>20||new Set(lines.map(l=>l.jobId)).size!==lines.length||lines.some(l=>!l.jobId||!l.bayId||!l.requiredBayType||l.requiredBayType!==l.bayType||!Number.isFinite(Date.parse(l.startAt))||!Number.isFinite(Date.parse(l.endAt))||Date.parse(l.endAt)<=Date.parse(l.startAt)))return'invalid_schedule';
 for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){const a=lines[i],b=lines[j];if(!a||!b)return'invalid_schedule';if(a.bayId!==b.bayId&&Date.parse(a.startAt)<Date.parse(b.endAt)&&Date.parse(b.startAt)<Date.parse(a.endAt))return'different_bays_overlap'}return null;
}
