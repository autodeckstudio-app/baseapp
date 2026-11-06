/** New isolated candidate. Quote enquiry is NOT a booking or bay reservation. */
export type QuotePhase='requested'|'offered'|'inspection_requested'|'inspection_confirmed'|'inspection_arrived'|'inspection_completed'|'accepted'|'declined'|'visit_booked';
export type QuoteActor={uid:string;tenantId:string;role:'customer'|'admin'|'superadmin'|'staff';studioIds:readonly string[]};
export type QuoteScope={serviceId:string|null;productKey:string|null;vehicleId:string;coverage:string};
export type QuoteOffer={revision:number;totalPaise:number;workingMinutes:number;included:string;excluded:string;termsVersion:string};
export type InspectionAgreement={version:string;feePaise:0;hoursText:string;hoursValidUntil:number};
export type QuoteReference={surface?:string;requestedWork?:string;key:string;brand:string|null;name:string;group:'ppf'|'coatings'};
export type QuoteJourney={requestedReference?:QuoteReference;id:string;tenantId:string;studioId:string;customerId:string;scope:QuoteScope;version:number;phase:QuotePhase;offer:QuoteOffer|null;inspection:InspectionAgreement|null;findings:string|null;acceptedRevision:number|null;bookingId:string|null;operations:Record<string,string>};
export type QuoteCommand=
 |{kind:'request_inspection'}
 |{kind:'offer';offer:QuoteOffer;binding?:{serviceId:string;productKey:string|null;coverage:string}}
 |{kind:'answer';decision:'accept'|'inspect'|'decline';offerRevision:number;acknowledgeReferenceMismatch?:boolean}
 |{kind:'confirm_inspection';agreement:InspectionAgreement}
 |{kind:'arrive'}|{kind:'findings';text:string}
 |{kind:'record_booking';bookingId:string;offerRevision:number;acceptedTermsVersion:string};
export class QuoteJourneyError extends Error{constructor(public code:'permission-denied'|'conflict'|'invalid'|'failed-precondition',message:string){super(message)}}
const fail=(code:QuoteJourneyError['code'],message:string):never=>{throw new QuoteJourneyError(code,message)};
const text=(s:unknown,max=2000):s is string=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
function access(q:QuoteJourney,a:QuoteActor){if(a.tenantId!==q.tenantId)fail('permission-denied','Wrong tenant');if(a.role==='customer'){if(a.uid!==q.customerId)fail('permission-denied','Not your request')}else if(a.role!=='superadmin'&&!a.studioIds.includes(q.studioId))fail('permission-denied','Studio access required')}
function role(a:QuoteActor,...roles:QuoteActor['role'][]){if(!roles.includes(a.role))fail('permission-denied','This action is not available to this role')}
export function createQuoteJourney(input:Omit<QuoteJourney,'version'|'phase'|'offer'|'inspection'|'findings'|'acceptedRevision'|'bookingId'|'operations'>,actor:QuoteActor):QuoteJourney{
 if(actor.role!=='customer'||input.customerId!==actor.uid||input.tenantId!==actor.tenantId)fail('permission-denied','Customer identity required');
 if(!text(input.id,120)||!text(input.studioId,120)||!(text(input.scope.serviceId,120)||input.scope.serviceId===null&&input.requestedReference&&text(input.requestedReference.key,160)&&text(input.requestedReference.name,200)&&['ppf','coatings'].includes(input.requestedReference.group))||!text(input.scope.vehicleId,120)||!text(input.scope.coverage)||input.scope.productKey!==null&&!text(input.scope.productKey,160))fail('invalid','Exact service, car and work scope required');
 return {...input,scope:{...input.scope},version:1,phase:'requested',offer:null,inspection:null,findings:null,acceptedRevision:null,bookingId:null,operations:{}};
}
/** Authority and identities must be resolved by the server adapter, never client-supplied claims. */
export function transitionQuote(q:QuoteJourney,a:QuoteActor,expectedVersion:number,operationId:string,command:QuoteCommand,now:number):{journey:QuoteJourney;replayed:boolean}{
 access(q,a);if(!Number.isFinite(now)||!text(operationId,120)||['__proto__','prototype','constructor'].includes(operationId))fail('invalid','Valid operation and time required');
 const body=JSON.stringify({actor:a.uid,command});const prior=Object.prototype.hasOwnProperty.call(q.operations,operationId)?q.operations[operationId]:undefined;
 if(prior!==undefined){if(prior!==body)fail('conflict','Operation ID was already used for another action');return{journey:q,replayed:true}}
 if(Object.keys(q.operations).length>=100)fail('failed-precondition','This request needs a studio review before more changes.');
 if(q.version!==expectedVersion)fail('conflict','The request changed. Refresh before trying again.');
 const next:QuoteJourney={...q,scope:{...q.scope},operations:{...q.operations,[operationId]:body},version:q.version+1};
 switch(command.kind){
 case'request_inspection':role(a,'customer');if(q.phase!=='requested')fail('failed-precondition','Inspection can be requested before an offer');next.phase='inspection_requested';break;
 case'offer':role(a,'admin','superadmin');if(!['requested','offered','inspection_completed'].includes(q.phase))fail('failed-precondition','An offer cannot change in this state');if(!Number.isSafeInteger(command.offer.totalPaise)||command.offer.totalPaise<=0||!Number.isSafeInteger(command.offer.workingMinutes)||command.offer.workingMinutes<=0||!text(command.offer.included)||typeof command.offer.excluded!=='string'||command.offer.excluded.length>2000||!text(command.offer.termsVersion,120)||command.offer.revision!==(q.offer?.revision??0)+1)fail('invalid','A complete exact offer with the next revision is required');if(q.scope.serviceId===null){if(!q.requestedReference||!command.binding||!text(command.binding.serviceId,120)||!text(command.binding.coverage)||command.binding.productKey!==null&&!text(command.binding.productKey,160))fail('failed-precondition','Select a verified published offering first');next.scope={...q.scope,...command.binding}}else if(command.binding)fail('failed-precondition','Published offering is already fixed');next.offer={...command.offer};next.acceptedRevision=null;next.phase='offered';break;
 case'answer':role(a,'customer');if(q.phase!=='offered'||!q.offer||command.offerRevision!==q.offer.revision)fail('conflict','Review the current offer first');if(command.decision==='accept'){if(q.requestedReference&&command.acknowledgeReferenceMismatch!==true)fail('failed-precondition','The proposed offering is not verified as your requested range. Review and acknowledge the difference first.');next.phase='accepted';next.acceptedRevision=q.offer!.revision}else if(command.decision==='inspect')next.phase='inspection_requested';else if(command.decision==='decline')next.phase='declined';else fail('invalid','Unknown decision');break;
 case'confirm_inspection':role(a,'customer');if(q.phase!=='inspection_requested')fail('failed-precondition','Inspection has not been requested');if(command.agreement.feePaise!==0||!text(command.agreement.version,120)||!text(command.agreement.hoursText)||!Number.isFinite(command.agreement.hoursValidUntil)||command.agreement.hoursValidUntil<=now)fail('invalid','Current free walk-in terms and verified opening hours required');next.inspection={...command.agreement};next.phase='inspection_confirmed';break;
 case'arrive':role(a,'staff','admin','superadmin');if(q.phase!=='inspection_confirmed')fail('failed-precondition','Confirmed walk-in required');next.phase='inspection_arrived';break;
 case'findings':role(a,'staff','admin','superadmin');if(q.phase!=='inspection_arrived'||!text(command.text))fail('failed-precondition','Actual arrival and customer-visible findings required');next.findings=command.text.trim();next.phase='inspection_completed';break;
 case'record_booking':role(a,'admin','superadmin');if(q.phase!=='accepted'||!q.offer||q.acceptedRevision!==q.offer.revision||command.offerRevision!==q.offer.revision||command.acceptedTermsVersion!==q.offer.termsVersion||!text(command.bookingId,120))fail('failed-precondition','Accepted current offer and canonical booking required');next.bookingId=command.bookingId;next.phase='visit_booked';break;
 default:fail('invalid','Unknown command');
 }
 return{journey:next,replayed:false};
}
