import {it,expect,vi} from "vitest";
const h=vi.hoisted(()=>({cb:null as any,error:null as any,ref:null as any}));
vi.mock("firebase/functions",()=>({httpsCallable:vi.fn()}));
vi.mock("./firebase",()=>({db:{},functions:{}}));
vi.mock("firebase/firestore",()=>({doc:(_d:any,c:any,id:any)=>({c,id}),collection:vi.fn(),query:vi.fn(),where:vi.fn(),orderBy:vi.fn(),limit:vi.fn(),onSnapshot:(ref:any,cb:any,error:any)=>{h.ref=ref;h.cb=cb;h.error=error;return()=>{}}}));
import {listenToPaymentForJob} from "./payment-service";
it("reads the exact booking advance, not the empty job-payment query; mismatches fail closed",()=>{
 const onData=vi.fn(),onError=vi.fn();
 listenToPaymentForJob("job","tenant","customer",onData,onError,{paymentId:"advance-book",bookingId:"book",amount:11900,studioId:"studio"});
 expect(h.ref.id).toBe("advance-book");
 const p={id:"advance-book",targetType:"booking",jobId:null,bookingId:"book",amount:11900,studioId:"studio",tenantId:"tenant",customerId:"customer",currency:"INR",status:"pending"};
 h.cb({exists:()=>true,data:()=>p});expect(onData).toHaveBeenCalledWith(p);
 for(const patch of [{id:"other"},{bookingId:"other"},{amount:12000},{jobId:"job"},{studioId:"other"},{customerId:"other"}])h.cb({exists:()=>true,data:()=>({...p,...patch})});
 h.cb({exists:()=>false});expect(onError).toHaveBeenCalledTimes(7);expect(onData).toHaveBeenCalledTimes(1);
});
