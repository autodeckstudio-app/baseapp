import {beforeEach,describe,it,expect,vi}from'vitest';
const h=vi.hoisted(()=>({owner:'customer-doc',tenant:'t',role:'customer',cid:'customer-doc' as string|null,update:vi.fn(),resolve:vi.fn()}));
vi.mock('../../middleware/auth.js',()=>({extractUser:()=>({uid:'auth-uid',claims:{tenantId:'t',role:h.role}}),assertRole:vi.fn(),assertTenant:(_u:any,t:string)=>{if(t!=='t')throw Error('tenant')}}));
vi.mock('../../middleware/rateLimit.js',()=>({enforceRateLimit:vi.fn(),subjectFrom:()=>''}));
vi.mock('../../middleware/audit.js',()=>({writeAuditLog:vi.fn()}));
vi.mock('../../lib/customer-identity.js',()=>({requireCustomerDocId:async()=>{h.resolve();if(!h.cid)throw Error('profile missing');return h.cid}}));
vi.mock('firebase-admin/firestore',()=>({getFirestore:()=>({collection:()=>({doc:(id:string)=>({id})}),runTransaction:async(fn:any)=>fn({get:async()=>({exists:true,data:()=>({tenantId:h.tenant,ownerId:h.owner,deletedAt:null,registrationNumber:'GJ01AB1234'})}),update:h.update})})}));
import{updateVehicle}from'../../functions/vehicle/updateVehicle.js';import{archiveVehicle}from'../../functions/vehicle/archiveVehicle.js';
beforeEach(()=>{h.owner='customer-doc';h.cid='customer-doc';h.role='customer';h.tenant='t';vi.clearAllMocks()});
for(const [name,fn,payload]of[['update',updateVehicle,{vehicleId:'v',color:'Blue'}],['archive',archiveVehicle,{vehicleId:'v'}]]as const)describe(name,()=>{
it('accepts canonical document owner different from login uid',async()=>{await fn.run({data:payload}as any);expect(h.update).toHaveBeenCalledOnce();expect(h.resolve).toHaveBeenCalledOnce()});
it('rejects uid-keyed owner when canonical binding differs',async()=>{h.owner='auth-uid';await expect(fn.run({data:payload}as any)).rejects.toMatchObject({code:'permission-denied'});expect(h.update).not.toHaveBeenCalled()});
it('requires customer profile',async()=>{h.cid=null;await expect(fn.run({data:payload}as any)).rejects.toThrow('profile missing');expect(h.update).not.toHaveBeenCalled()});
it('rejects current different owner',async()=>{h.owner='buyer';await expect(fn.run({data:payload}as any)).rejects.toMatchObject({code:'permission-denied'});expect(h.update).not.toHaveBeenCalled()});
it('keeps tenant guard',async()=>{h.tenant='other';await expect(fn.run({data:payload}as any)).rejects.toThrow('tenant');expect(h.update).not.toHaveBeenCalled()});
it('staff path does not need customer profile',async()=>{h.role='admin';h.cid=null;await fn.run({data:payload}as any);expect(h.resolve).not.toHaveBeenCalled();expect(h.update).toHaveBeenCalledOnce()});});
