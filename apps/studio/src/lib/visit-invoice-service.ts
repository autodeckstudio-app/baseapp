import {httpsCallable} from 'firebase/functions';
import {functions} from './firebase';
export async function getVisitInvoicePdf(invoiceId:string):Promise<string>{
 if(!/^vi_vr_[a-f0-9]{64}$/.test(invoiceId))throw Error('Invoice PDF unavailable.');
 const {data}=await httpsCallable<{invoiceId:string},{url:string;expiresInSeconds:number}>(functions,'getVisitInvoicePdfUrl',{timeout:15000})({invoiceId});
 if(!data||data.expiresInSeconds!==600||typeof data.url!=='string')throw Error('Invoice PDF unavailable.');
 const url=new URL(data.url);if(url.protocol!=='https:'||url.username||url.password)throw Error('Invoice PDF unavailable.');
 return data.url;
}
