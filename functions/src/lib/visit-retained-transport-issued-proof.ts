import type{Firestore,Transaction}from'firebase-admin/firestore';import{HttpsError}from'firebase-functions/v2/https';
import{parseRetainedTransportInvoiceSnapshot}from'./visit-retained-transport-invoice-snapshot.js';import{retainedTransportChargeBasis}from'./visit-retained-transport-charge-basis.js';import{visitReturnHash}from'./visit-service-return-state.js';
const fail=():never=>{throw new HttpsError('failed-precondition','Original retained journey issued charge needs review.');};
/** Called only after original cancellation/money proof. Distinct issued charge,
 * never a reduced full-job invoice or new source of funds. */
export async function readRetainedTransportIssuedProof(tx:Transaction,db:Firestore,record:Record<string,any>,review:Record<string,any>,originalBreakdown:Record<string,any>){
 const required=!!review['transport']&&review['invoiceId']===null&&review['paidPaise']<review['transport']['review']['originalTotalPaise'];
 const obligationId='vto_'+visitReturnHash([record['tenantId'],record['visitId'],record['jobId']]),invoiceId='vti_'+visitReturnHash([record['tenantId'],obligationId]);
 const raw=(await tx.get(db.collection('visitRetainedTransportInvoices').doc(invoiceId))).data();
 if(!required&&!record['retainedTransportInvoiceId']&&!raw)return null;
 if(!required||!raw||record['retainedTransportInvoiceId']!==invoiceId||raw['id']!==invoiceId||raw['obligationId']!==obligationId||raw['sourceReviewHash']!==record['reviewHash']||
  raw['originalRequestHash']!==review['transport']?.['review']?.['requestToken']||['tenantId','studioId','customerId','vehicleId','visitId','jobId','bookingId'].some(k=>raw[k]!==record[k]))return fail();
 const parsed=parseRetainedTransportInvoiceSnapshot(raw),basis=retainedTransportChargeBasis(originalBreakdown as any,review['transport']['review']['retainedLegs']);
 if(visitReturnHash(raw['originalBreakdown'])!==visitReturnHash(originalBreakdown)||visitReturnHash(raw['basis'])!==visitReturnHash(basis)||raw['basis']['originalBreakdownHash']!==visitReturnHash(raw['originalBreakdown'])||
  visitReturnHash(raw['basis']['components'])!==visitReturnHash(review['transport']['review']['retainedLegs'].map((leg:string)=>({leg,...review['transport']['review']['components'][leg]})))||
  parsed.totalPaise!==review['transportRetainedPaise']+review['feePaise']||parsed.policyFeePaise!==review['feePaise']||review['feeDuePaise']!==0||review['retainedPaise']!==parsed.totalPaise||
  review['entries'].some((e:any)=>!['cash','upi_manual','bank_transfer'].includes(e.method))||review['entries'].reduce((n:number,e:any)=>n+e.retainedPaise,0)!==parsed.totalPaise)return fail();
 return{raw,invoice:parsed};
}
