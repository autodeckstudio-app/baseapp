export type VisitReceiptCommand={visitId:string;billId:string;reviewToken:string;operationId:string;receivedPaise:number;method:'cash'|'upi_manual'|'bank_transfer';reference:string;confirmActualReceipt:true};
export type VisitReceiptResult={receiptId:string;billId:string;invoiceId:string|null;receivedPaise:number;appliedPaise:number;balancePaise:number;entries:{jobId:string;appliedPaise:number}[];alreadyRecorded:boolean};
export function parseVisitReceiptCommand(raw:unknown,visitId:string):VisitReceiptCommand{
 const c=raw as VisitReceiptCommand,id=/^[A-Za-z0-9_-]{1,120}$/;
 if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['visitId','billId','reviewToken','operationId','receivedPaise','method','reference','confirmActualReceipt'].includes(k))||c.visitId!==visitId||!id.test(c.visitId)||typeof c.billId!=='string'||!id.test(c.billId)||!/^[a-f0-9]{64}$/.test(c.reviewToken)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(c.operationId)||!Number.isSafeInteger(c.receivedPaise)||c.receivedPaise<=0||!['cash','upi_manual','bank_transfer'].includes(c.method)||typeof c.reference!=='string'||c.reference.length>200||c.reference.trim()!==c.reference||c.confirmActualReceipt!==true)throw Error('Saved receipt needs office review. Do not record it again.');
 return{visitId:c.visitId,billId:c.billId,reviewToken:c.reviewToken,operationId:c.operationId,receivedPaise:c.receivedPaise,method:c.method,reference:c.reference,confirmActualReceipt:true};
}
export function parseVisitReceiptResult(raw:unknown,command:VisitReceiptCommand):VisitReceiptResult{
 const r=raw as VisitReceiptResult,money=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
 if(!r||typeof r.receiptId!=='string'||!/^vr_[a-f0-9]{64}$/.test(r.receiptId)||r.billId!==command.billId||!(r.invoiceId===null||typeof r.invoiceId==='string'&&r.invoiceId==='vi_'+r.receiptId)||r.receivedPaise!==command.receivedPaise||r.appliedPaise!==r.receivedPaise||!money(r.balancePaise)||typeof r.alreadyRecorded!=='boolean'||!Array.isArray(r.entries)||!r.entries.length||r.entries.length>20||new Set(r.entries.map(e=>e?.jobId)).size!==r.entries.length||r.entries.some(e=>!e||typeof e.jobId!=='string'||!money(e.appliedPaise)||!e.appliedPaise)||r.entries.reduce((n,e)=>n+e.appliedPaise,0)!==r.receivedPaise||(r.balancePaise===0)!==!!r.invoiceId)throw Error('Receipt response needs checking. Retry the saved receipt only.');
 return r;
}
export type VisitReceiptRejected={rejected:true;reason:'bill_changed';command:VisitReceiptCommand};
export type VisitReceiptOutcome=VisitReceiptResult|VisitReceiptRejected;
/** Only the authenticated callable's exact terminal-operation response permits
 * clearing a failed command. An exception or a missing receipt is not proof. */
export function parseVisitReceiptOutcome(raw:unknown,command:VisitReceiptCommand):VisitReceiptOutcome{
 if(raw&&typeof raw==='object'&&'rejected' in raw){
  const r=raw as VisitReceiptRejected;
  if(r.rejected!==true||r.reason!=='bill_changed'||Object.keys(r).some(k=>!['rejected','reason','command'].includes(k))||JSON.stringify(parseVisitReceiptCommand(r.command,command.visitId))!==JSON.stringify(parseVisitReceiptCommand(command,command.visitId)))throw Error('Receipt outcome needs checking. Retry the saved receipt only.');
  return{rejected:true,reason:'bill_changed',command:parseVisitReceiptCommand(r.command,command.visitId)};
 }
 return parseVisitReceiptResult(raw,command);
}
/** Write-once receipt identity. On uncertain transport, retain the exact
 * command so the only available retry cannot create a second money fact. */
export class VisitReceiptJournal{
 readonly key:string;
 constructor(readonly scope:{uid:string;tenantId:string;visitId:string},readonly store:{getItem(k:string):Promise<string|null>;setItem(k:string,v:string):Promise<void>;removeItem(k:string):Promise<void>},readonly current:()=>boolean){if(Object.values(scope).some(v=>typeof v!=='string'||!v))throw Error('Receipt scope unavailable.');this.key='autodeck-visit-receipt:'+JSON.stringify([scope.uid,scope.tenantId,scope.visitId]);}
 private active(){if(!this.current())throw Error('Receipt account or visit changed.');}
 async restore(){this.active();const value=await this.store.getItem(this.key);this.active();return value?parseVisitReceiptCommand(JSON.parse(value),this.scope.visitId):null;}
 async prepare(command:VisitReceiptCommand){this.active();const exact=parseVisitReceiptCommand(command,this.scope.visitId),prior=await this.restore();if(prior&&JSON.stringify(prior)!==JSON.stringify(exact))throw Error('A saved receipt must be checked first.');if(!prior){await this.store.setItem(this.key,JSON.stringify(exact));this.active();}return prior??exact;}
 async send(run:(command:VisitReceiptCommand)=>Promise<unknown>){const command=await this.restore();if(!command)throw Error('Review the receipt first.');this.active();const result=parseVisitReceiptOutcome(await run(command),command);this.active();await this.store.removeItem(this.key);this.active();return result;}
}
