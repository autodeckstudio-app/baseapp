export type VisitCancelCommand={visitId:string;jobId:string;reviewToken:string;operationId:string;expectedFeePaise:number;reason:string;confirmed:true};
export type VisitCancelResult={visitId:string;jobId:string;feePaise:number;feeReason:'another_service_continues'|'last_service_policy';revision:number;alreadyCancelled:boolean};
export function parseVisitCancelCommand(raw:unknown,visitId:string):VisitCancelCommand{
 const c=raw as VisitCancelCommand;
 if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['visitId','jobId','reviewToken','operationId','expectedFeePaise','reason','confirmed'].includes(k))||c.visitId!==visitId||typeof c.jobId!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(c.jobId)||!/^[a-f0-9]{64}$/.test(c.reviewToken)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(c.operationId)||!Number.isSafeInteger(c.expectedFeePaise)||c.expectedFeePaise<0||typeof c.reason!=='string'||c.reason.trim()!==c.reason||c.reason.length<3||c.reason.length>500||c.confirmed!==true)throw Error('Saved cancellation needs office review. Do not cancel another service.');
 return{visitId:c.visitId,jobId:c.jobId,reviewToken:c.reviewToken,operationId:c.operationId,expectedFeePaise:c.expectedFeePaise,reason:c.reason,confirmed:true};
}
export function parseVisitCancelResult(raw:unknown,c:VisitCancelCommand):VisitCancelResult{const r=raw as VisitCancelResult;if(!r||r.visitId!==c.visitId||r.jobId!==c.jobId||r.feePaise!==c.expectedFeePaise||!['another_service_continues','last_service_policy'].includes(r.feeReason)||r.feeReason==='another_service_continues'&&r.feePaise!==0||!Number.isSafeInteger(r.revision)||r.revision<2||typeof r.alreadyCancelled!=='boolean')throw Error('Cancellation response needs checking. Retry the saved decision only.');return r;}
export class VisitCancelJournal{
 readonly key:string;
 constructor(readonly scope:{uid:string;tenantId:string;visitId:string},readonly store:{getItem(k:string):Promise<string|null>;setItem(k:string,v:string):Promise<void>;removeItem(k:string):Promise<void>},readonly current:()=>boolean){if(Object.values(scope).some(v=>typeof v!=='string'||!v))throw Error('Cancellation scope unavailable.');this.key='autodeck-visit-cancel:'+JSON.stringify([scope.uid,scope.tenantId,scope.visitId]);}
 private active(){if(!this.current())throw Error('Cancellation account or visit changed.');}
 async restore(){this.active();const value=await this.store.getItem(this.key);this.active();return value?parseVisitCancelCommand(JSON.parse(value),this.scope.visitId):null;}
 async prepare(command:VisitCancelCommand){this.active();const exact=parseVisitCancelCommand(command,this.scope.visitId),prior=await this.restore();if(prior&&JSON.stringify(prior)!==JSON.stringify(exact))throw Error('Check the saved cancellation first.');if(!prior){await this.store.setItem(this.key,JSON.stringify(exact));this.active();}return prior??exact;}
 async send(run:(c:VisitCancelCommand)=>Promise<unknown>){const c=await this.restore();if(!c)throw Error('Review this service first.');this.active();const r=parseVisitCancelResult(await run(c),c);this.active();await this.store.removeItem(this.key);this.active();return r;}
}
