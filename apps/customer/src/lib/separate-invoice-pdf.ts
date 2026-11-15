import{httpsCallable}from'firebase/functions';
import{assertConnectedVisitTarget}from'./connected-visit-release';
export type SeparatePdf={kind:'retained'|'cancellation';jobId:string;invoiceNumber:string;mimeType:'application/pdf';base64:string};
export async function getSeparateInvoicePdf(jobId:string,kind:SeparatePdf['kind']):Promise<SeparatePdf>{
 const sdk=await import('./firebase');assertConnectedVisitTarget(sdk);const{data}=await httpsCallable<{jobId:string;kind:SeparatePdf['kind']},SeparatePdf>(sdk.functions,'getVisitSeparateInvoicePdf',{timeout:30000})({jobId,kind});
 if(!data||data.jobId!==jobId||data.kind!==kind||data.mimeType!=='application/pdf'||typeof data.invoiceNumber!=='string'||!data.invoiceNumber.trim()||data.invoiceNumber.length>120||typeof data.base64!=='string'||data.base64.length>1000000||!data.base64.startsWith('JVBERi0')||! /^[A-Za-z0-9+/]+={0,2}$/.test(data.base64))throw Error('Original charge PDF unavailable.');return data;
}
