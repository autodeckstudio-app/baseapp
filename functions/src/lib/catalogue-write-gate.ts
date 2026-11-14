import{HttpsError}from'firebase-functions/v2/https';
/** The managed tenant's public/operational service fields may change only via
 * an exact reviewed publication. Internal ratings are not catalogue content. */
export function assertReviewedCatalogueWrite(tenantId:string,input?:Record<string,unknown>):void{
 if(tenantId!=='automodz')return;
 if(input&&Object.keys(input).every(key=>key==='serviceId'||key==='internalRating'))return;
 throw new HttpsError('failed-precondition','Save a catalogue draft and use Review & publish to change this service.');
}
