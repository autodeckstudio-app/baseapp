import {it,expect,vi} from "vitest";
import {fakeFirestore} from "./fake-firestore.js";
const h=vi.hoisted(()=>({db:null as unknown}));
vi.mock("firebase-admin/firestore",async orig=>({...await orig<Record<string,unknown>>(),getFirestore:()=>h.db}));
vi.mock("../../middleware/rateLimit.js",()=>({enforceRateLimit:async()=>{},subjectFrom:()=>"test"}));
vi.mock("../../middleware/audit.js",()=>({writeAuditLog:()=>{}}));
import {upgradeMembership} from "../../functions/membership/upgradeMembership.js";
it("optimistic precommit model: actual upgrade handler must READ shared claim to prevent phantom double upgrades",async()=>{
 const {db,data}=fakeFirestore({membershipPlans:{old:{id:"old",tenantId:"t",active:true,priceInPaise:90000},target:{id:"target",tenantId:"t",active:true,priceInPaise:180000,includedWashes:3,tier:"gold",freePickups:0,discountPercent:10}},memberships:{active:{id:"active",tenantId:"t",customerId:"c",planId:"old",status:"active",washesUsed:0,pickupsUsed:0}},membershipClaims:{t_c:{membershipId:"active"}}});h.db=db;
 const originalCollection=db.collection;
 db.collection=(name:string)=>{
  const col=originalCollection(name);if(name!=="memberships")return col;
  const make=(filters:Array<[string,string,unknown]>):unknown=>({where:(f:string,op:string,v:unknown)=>make([...filters,[f,op,v]]),limit:()=>make(filters),get:async()=>{
    const ids=Object.keys(data.memberships!).filter(id=>filters.every(([f,op,v])=>op==="in"?(v as unknown[]).includes(data.memberships![id]![f]):data.memberships![id]![f]===v));
    const docs=await Promise.all(ids.map(id=>col.doc(id).get()));return{docs,empty:!docs.length,size:docs.length};
  }});
  return{...col,where:(f:string,op:string,v:unknown)=>make([[f,op,v]])};
 };
 // Firestore optimistic semantics: query phantom inserts do not replace a
 // read-version check of the shared claim. Defer writes until BOTH first
 // callbacks are ready, and retry only a transaction that READ a changed claim.
 let commit=Promise.resolve();let version=0,arrived=0;let release!:()=>void;const barrier=new Promise<void>(r=>{release=r;});
 db.runTransaction=async(fn:(tx:unknown)=>Promise<unknown>)=>{
  for(let attempt=0;attempt<3;attempt++){
   const seen=version;let readClaim=false;const writes:Array<()=>Promise<void>>=[];
   const tx={get:async(ref:{_col?:string;get:()=>Promise<unknown>})=>{if(ref._col==="membershipClaims")readClaim=true;return ref.get();},set:(ref:{_col?:string;set:(v:unknown)=>Promise<void>},v:unknown)=>writes.push(async()=>{await ref.set(v);if(ref._col==="membershipClaims")version++;})};
   const result=await fn(tx);
   if(attempt===0){if(++arrived===2)release();await barrier;}
   let unlock!:()=>void;const before=commit;commit=new Promise<void>(r=>{unlock=r;});await before;
   if(readClaim&&seen!==version){unlock();continue;}
   try{for(const write of writes)await write();return result;}finally{unlock();}
  }throw Error("retry cap");
 };
 const results=await Promise.allSettled([0,1].map(n=>upgradeMembership.run({data:{planId:"target",method:"cash",idempotencyKey:`key-${n}`},auth:{uid:"c",token:{role:"customer",tenantId:"t",studioId:null}}} as never)));
 console.warn(results);
 expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
 expect(Object.values(data.memberships!).filter(m=>m.status==="pending")).toHaveLength(1);expect(Object.keys(data.payments!)).toHaveLength(1);
});
