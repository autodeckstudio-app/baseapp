import type { Warranty } from './types/warranty.js';
// Legacy endDate=null means unknown OR lifetime. It never proves lifetime.
export function warrantyDisplay(w: Pick<Warranty,'startDate'|'endDate'|'revokedAt'>, today:string):{status:string;range:string}{
 const valid=(s:string|null)=>!!s&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 const start=valid(w.startDate)?w.startDate:'Start date not recorded';
 if(w.revokedAt)return {status:'Revoked',range:`${start} · Coverage revoked`};
 if(!valid(w.endDate))return {status:'End date not recorded',range:`${start} · Check the recorded terms`};
 const end=w.endDate as string;
 return {status:!valid(today)?'Check coverage dates':end<today?'Expired':end===today?'Ends today':'Within recorded dates',range:`${start} to ${end}`};
}
