import{parseWorkRecordReceipt,type WorkRecordCommand,type WorkRecordReceipt}from'./job-work-coverage';
export type WorkCommandScope={uid:string;tenantId:string;role:'studio'|'admin'|'superadmin';studioId:string|null;jobId:string;vehicleId:string;customerId:string};
export type WorkCommandStore={getItem:(key:string)=>Promise<string|null>;setItem:(key:string,value:string)=>Promise<void>;removeItem:(key:string)=>Promise<void>};
const text=(v:unknown,max=120):v is string=>typeof v==='string'&&v.length>0&&v.length<=max;
const id=(v:unknown):v is string=>text(v)&&/^[A-Za-z0-9_-]+$/.test(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).sort().join('|')===keys.sort().join('|');
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function checkedWorkCommand(value:unknown,jobId:string):WorkRecordCommand{
 const fail=()=>{throw Error('Saved work submission needs review.')};if(!record(value))return fail();const c=value;const keys=['jobId','operationId','expectedRevision','action'];
 if(c.jobId!==jobId||!text(c.operationId)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(c.operationId)||typeof c.expectedRevision!=='number'||!Number.isSafeInteger(c.expectedRevision)||c.expectedRevision<0)return fail();
 if(c.action==='seal'){if(c.confirmed!==true||!exact(c,[...keys,'confirmed']))return fail()}
 else if(c.action==='qc'){if(!id(c.lineId)||c.checked!==true||!exact(c,[...keys,'lineId','checked']))return fail()}
 else if(c.action==='record'){
  if(!id(c.lineId)||c.performed!==true||!(c.approvalId===null||id(c.approvalId))||!record(c.work)||!exact(c,[...keys,'lineId','approvalId','performed','work']))return fail();
  const work=c.work;const product=(p:unknown)=>record(p)&&exact(p,['id','label','kind','coverage'])&&id(p.id)&&text(p.label,300)&&text(p.kind,80)&&text(p.coverage,300);const validTarget=(w:Record<string,unknown>)=>id(w.targetId)&&typeof w.targetRevision==='number'&&Number.isSafeInteger(w.targetRevision)&&w.targetRevision>=0;
  if(work.kind==='service'){if(!exact(work,['kind']))return fail()}
  else if(work.kind==='install'){if(!exact(work,['kind','product'])||!product(work.product))return fail()}
  else if(work.kind==='replace'){if(!exact(work,['kind','product','targetId','targetRevision'])||!product(work.product)||!validTarget(work))return fail()}
  else if(work.kind==='remove'){if(!exact(work,['kind','targetId','targetRevision'])||!validTarget(work))return fail()}
  else return fail();
 }else return fail();return JSON.parse(JSON.stringify(c))as WorkRecordCommand;
}
/** One durable exact command per verified owner/job scope. The app supplies its
 * cross-tab/process lock. No command is sent before durable storage succeeds.
 * A missing receipt is never permission to discard or mint another operation. */
export class WorkCommandJournal{
 readonly key:string;private pending:WorkRecordCommand|null=null;private static queues=new Map<string,Promise<void>>();
 constructor(private scope:WorkCommandScope,private store:WorkCommandStore,private current:()=>boolean){if(Object.entries(scope).some(([key,v])=>key==='studioId'?v!==null&&!text(v):!text(v))||!['studio','admin','superadmin'].includes(scope.role)||scope.role==='studio'&&scope.studioId===null)throw Error('Verified work account required.');this.scope=Object.freeze({uid:scope.uid,tenantId:scope.tenantId,role:scope.role,studioId:scope.studioId,jobId:scope.jobId,vehicleId:scope.vehicleId,customerId:scope.customerId});this.key='autodeck:work-command:v1:'+encodeURIComponent(JSON.stringify(this.scope))}
 private exclusive<T>(work:()=>Promise<T>):Promise<T>{const before=WorkCommandJournal.queues.get(this.key)??Promise.resolve();const result=before.then(work);const tail=result.then(()=>undefined,()=>undefined);WorkCommandJournal.queues.set(this.key,tail);void tail.then(()=>{if(WorkCommandJournal.queues.get(this.key)===tail)WorkCommandJournal.queues.delete(this.key)});return result}
 private active(){if(!this.current())throw Error('Account or visit changed. Reload work.')}
 private async load():Promise<WorkRecordCommand|null>{this.active();const raw=await this.store.getItem(this.key);this.active();if(!raw){this.pending=null;return null}let value:unknown;try{value=JSON.parse(raw)}catch{throw Error('Saved work submission needs review.')};if(!record(value)||value.version!==1||JSON.stringify(value.scope)!==JSON.stringify(this.scope))throw Error('Saved work submission needs review.');this.pending=checkedWorkCommand(value.command,this.scope.jobId);return checkedWorkCommand(this.pending,this.scope.jobId)}
 restore():Promise<WorkRecordCommand|null>{return this.exclusive(()=>this.load())}
 prepare(command:WorkRecordCommand):Promise<WorkRecordCommand>{return this.exclusive(async()=>{this.active();if(await this.load())throw Error('Check the saved work submission first.');const checked=checkedWorkCommand(command,this.scope.jobId);await this.store.setItem(this.key,JSON.stringify({version:1,scope:this.scope,command:checked}));this.active();this.pending=checked;return checkedWorkCommand(checked,this.scope.jobId)})}
 send(send:(command:WorkRecordCommand)=>Promise<unknown>):Promise<WorkRecordReceipt>{return this.exclusive(async()=>{this.active();const command=await this.load();if(!command)throw Error('No saved work submission.');const raw=await send(checkedWorkCommand(command,this.scope.jobId));this.active();const receipt=parseWorkRecordReceipt(raw,command);await this.store.removeItem(this.key);this.active();this.pending=null;return receipt})}
 check(check:(command:WorkRecordCommand)=>Promise<unknown|null>):Promise<WorkRecordReceipt|null>{return this.exclusive(async()=>{this.active();const command=await this.load();if(!command)throw Error('No saved work submission.');const raw=await check(checkedWorkCommand(command,this.scope.jobId));this.active();if(raw===null)return null;const receipt=parseWorkRecordReceipt(raw,command);await this.store.removeItem(this.key);this.active();this.pending=null;return receipt})}
}
