import type {PriceBreakdown} from './types/booking';
/** An estimate is not a purchase, work completion, bay reservation, payment,
 * or permission to add later work. Every service remains independent. */
export type VisitIntakeLine={
 id:string;serviceId:string;name:string;workingMinutes:number;
 priceKind:'fixed'|'quote';price:PriceBreakdown|null;
 /** Quote-only amounts must be an explicit office offer, never a catalogue zero. */
 offeredBy:string|null;
};
export type VisitIntake={
 id:string;tenantId:string;studioId:string;customerId:string;vehicleId:string;
 revision:number;status:'draft'|'offered'|'accepted'|'declined'|'expired'|'cancelled';
 lines:VisitIntakeLine[];expiresAt:string|null;
};
const money=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const text=(s:unknown):s is string=>typeof s==='string'&&s.trim().length>0;
export type IntakeIssue='scope_changed'|'invalid_lines'|'quote_needed'|'invalid_price'|'expired'|'not_offered'|'stale_review';
export function visitIntakeIssue(intake:VisitIntake):IntakeIssue|null{
 if(![intake.id,intake.tenantId,intake.studioId,intake.customerId,intake.vehicleId].every(text)||!Number.isSafeInteger(intake.revision)||intake.revision<1)return'scope_changed';
 if(!Array.isArray(intake.lines)||!intake.lines.length||intake.lines.length>20||new Set(intake.lines.map(l=>l.id)).size!==intake.lines.length||new Set(intake.lines.map(l=>l.serviceId)).size!==intake.lines.length)return'invalid_lines';
 let quoteNeeded=false;
 for(const line of intake.lines){
  if(![line.id,line.serviceId,line.name].every(text)||!Number.isSafeInteger(line.workingMinutes)||line.workingMinutes<=0||!['fixed','quote'].includes(line.priceKind))return'invalid_lines';
  if(!line.price||line.priceKind==='quote'&&!text(line.offeredBy)){quoteNeeded=true;continue;}
  const p=line.price;if(![p.total,p.subtotal,p.tax,p.pickupFee,p.dropFee,p.basePrice,p.scopeAdjustment].every(money)||p.pickupFee!==0||p.dropFee!==0||p.currency!=='INR'||p.subtotal+p.tax!==p.total||!Number.isSafeInteger(p.subtotal+p.tax)||line.priceKind==='quote'&&p.total===0)return'invalid_price';
 }
 return quoteNeeded?'quote_needed':null;
}
/** This is a view over offered service amounts. Transport is selected and
 * quoted once separately; no duplicate fee or invented consolidated tender. */
export function visitIntakeTotal(intake:VisitIntake):number|null{
 if(visitIntakeIssue(intake))return null;
 const total=intake.lines.reduce((sum,line)=>sum+line.price!.total,0);return Number.isSafeInteger(total)?total:null;
}
export function checkIntakeReview(intake:VisitIntake,review:{revision:number;totalAmount:number;lineIds:readonly string[]},now:number):IntakeIssue|null{
 const issue=visitIntakeIssue(intake);if(issue)return issue;
 if(intake.status!=='offered')return'not_offered';
 if(!intake.expiresAt||!Number.isFinite(Date.parse(intake.expiresAt))||Date.parse(intake.expiresAt)<=now)return'expired';
 if(review.revision!==intake.revision||review.totalAmount!==visitIntakeTotal(intake)||review.lineIds.length!==intake.lines.length||new Set(review.lineIds).size!==intake.lines.length||review.lineIds.some((id,index)=>id!==intake.lines[index]?.id))return'stale_review';
 return null;
}

/** Minimal authenticated view, without staff IDs or private pricing inputs. */
export type VisitIntakeRead={id:string;revision:number;status:VisitIntake['status'];customerId:string;vehicleId:string;studioId:string;expiresAt:string|null;lines:{id:string;serviceId:string;name:string;workingMinutes:number;priceKind:'fixed'|'quote';totalAmount:number|null}[];totalAmount:number|null;visitId:string|null;customerName?:string;vehicleLabel?:string};
export function parseVisitIntakeRead(value:unknown):VisitIntakeRead{
 const i=value as VisitIntakeRead;const fail=()=>{throw new Error('Estimate unavailable. Refresh before reviewing.');};
 if(!i||![i.id,i.customerId,i.vehicleId,i.studioId].every(text)||!Number.isSafeInteger(i.revision)||i.revision<1||!['draft','offered','accepted','declined','expired','cancelled'].includes(i.status)||i.expiresAt!==null&&(!text(i.expiresAt)||!Number.isFinite(Date.parse(i.expiresAt)))||i.visitId!==null&&!text(i.visitId)||!Array.isArray(i.lines)||i.lines.length<2||i.lines.length>20)return fail();
 if(new Set(i.lines.map(l=>l.id)).size!==i.lines.length||new Set(i.lines.map(l=>l.serviceId)).size!==i.lines.length||i.lines.some(l=>!l||![l.id,l.serviceId,l.name].every(text)||!Number.isSafeInteger(l.workingMinutes)||l.workingMinutes<1||!['fixed','quote'].includes(l.priceKind)||l.totalAmount!==null&&!money(l.totalAmount)))return fail();
 const known=i.lines.every(l=>l.totalAmount!==null),sum=known?i.lines.reduce((n,l)=>n+l.totalAmount!,0):null;
 if(i.totalAmount!==sum||sum!==null&&!money(sum)||i.status==='offered'&&(!known||i.expiresAt===null))return fail();return i;
}

export type VisitIntakeCursor={id:string;createdAt:string};
export function parseVisitIntakePage(value:unknown):{intakes:VisitIntakeRead[];nextCursor:VisitIntakeCursor|null}{
 const p=value as {intakes:unknown[];nextCursor:VisitIntakeCursor|null};
 if(!p||!Array.isArray(p.intakes)||p.intakes.length>20||p.nextCursor!==null&&(!p.nextCursor||typeof p.nextCursor.id!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(p.nextCursor.id)||!Number.isFinite(Date.parse(p.nextCursor.createdAt))))throw Error('Estimates unavailable. Refresh before reviewing.');
 const intakes=p.intakes.map(parseVisitIntakeRead);if(new Set(intakes.map(i=>i.id)).size!==intakes.length||p.nextCursor!==null&&(intakes.length!==20||p.nextCursor.id!==intakes[19]!.id))throw Error('Estimate page changed. Refresh before reviewing.');return{intakes,nextCursor:p.nextCursor};
}
