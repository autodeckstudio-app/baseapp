import{httpsCallable}from'firebase/functions';import{functions}from'./firebase';import type{QuoteJourney,QuoteScope,QuoteCommand,InspectionAgreement}from'@autodeck/core';
export type CustomerQuote=Pick<QuoteJourney,'requestedReference'|'id'|'studioId'|'scope'|'version'|'phase'|'offer'|'inspection'|'findings'|'acceptedRevision'|'bookingId'>;
export const quoteOperationId=()=>`q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,12)}`;
export async function requestServiceQuote(requestId:string,studioId:string,scope:QuoteScope){return(await httpsCallable<unknown,CustomerQuote>(functions,'requestServiceQuote')({requestId,studioId,scope})).data}
export type QuoteCursor={createdAt:string;id:string};
export async function getServiceQuotes(cursor?:QuoteCursor){return(await httpsCallable<unknown,{quotes:CustomerQuote[];limited:boolean;nextCursor:QuoteCursor|null}>(functions,'getServiceQuotes')({customerContext:true,...(cursor?{cursor}:{})})).data}
export async function getQuoteInspectionTerms(id:string){return(await httpsCallable<unknown,InspectionAgreement>(functions,'getQuoteInspectionTerms')({id})).data}
export async function updateServiceQuote(q:CustomerQuote,operationId:string,command:Exclude<QuoteCommand,{kind:'confirm_inspection'}|{kind:'record_booking'}>|{kind:'confirm_inspection';agreedVersion:string}){return(await httpsCallable<unknown,CustomerQuote>(functions,'updateServiceQuote')({id:q.id,expectedVersion:q.version,operationId,command,customerContext:true})).data}
/** Release gate. Server, canonical booking integration and native acceptance must be verified before activation. */
export const SERVICE_QUOTE_JOURNEY_READY=true;

export async function requestReferenceQuote(requestId:string,studioId:string,referenceKey:string,vehicleId:string,requestedWork?:string){return(await httpsCallable<unknown,CustomerQuote>(functions,'requestReferenceQuote')({requestId,studioId,referenceKey,vehicleId,...(requestedWork?{requestedWork}:{})})).data}
