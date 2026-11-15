import{beforeEach,describe,it,expect,vi}from'vitest';
const h=vi.hoisted(()=>({rows:new Map<string,any>(),next:0,cid:'canonical',tenant:'t',audit:vi.fn(),writes:0,queue:Promise.resolve()}));
vi.mock('../../middleware/auth.js',()=>({extractCustomerUser:()=>({uid:'auth-uid',claims:{tenantId:h.tenant,role:'customer'}}),extractUser:vi.fn(),assertRole:vi.fn(),assertTenant:vi.fn()}));
vi.mock('../../middleware/rateLimit.js',()=>({enforceRateLimit:vi.fn(),subjectFrom:()=>''}));
vi.mock('../../middleware/audit.js',()=>({writeAuditLog:h.audit}));
vi.mock('../../lib/customer-identity.js',()=>({requireCustomerDocId:async()=>h.cid,resolveCustomerDocId:async()=>h.cid}));
vi.mock('firebase-admin/firestore',()=>{
 const ref=(path:string)=>({id:path.split('/').pop(),path,get:async()=>({id:path.split('/').pop(),exists:h.rows.has(path),data:()=>h.rows.get(path)})});
 return{getFirestore:()=>({collection:(name:string)=>({doc:(id?:string)=>ref(name+'/'+(id??'random'+(++h.next)))}),runTransaction:async(fn:any)=>{
 const run=async()=>{const pending:any[]=[];const result=await fn({get:(r:any)=>r.get(),set:(r:any,v:any)=>pending.push([r.path,v,false]),create:(r:any,v:any)=>pending.push([r.path,v,true])});for(const[k,v,create]of pending){if(create&&h.rows.has(k))throw Error('exists');h.rows.set(k,v);h.writes++}return result};const p=h.queue.then(run);h.queue=p.then(()=>{},()=>{});return p;
 }})};
});
import{submitMyListing,getMyListingSubmission}from'../../functions/carsale/carsale.js';
const payload={operationId:'operation-key-12345',make:'Sample',model:'Car',variant:null,year:2021,kmDriven:10000,fuel:'petrol',gearbox:'manual',bodyType:'hatchback',owners:1,colour:'Blue',area:'Ahmedabad',askingPrice:1000000,description:null,insuranceValidTill:null,photoPaths:['t/listings/sample.jpg'],sellerName:'Sample',sellerPhone:'9999999999',registrationNumber:'SAMPLE001'};
const request=(d:any=payload)=>({data:d}as any);const listings=()=>[...h.rows].filter(([k])=>!k.startsWith('carListingSubmissions/'));const receipt=()=>[...h.rows].find(([k])=>k.startsWith('carListingSubmissions/'))!;
beforeEach(()=>{h.rows.clear();h.next=0;h.cid='canonical';h.tenant='t';h.writes=0;h.audit.mockClear();h.queue=Promise.resolve()});
describe('keyed listing submission and exact readback',()=>{
 it('creates one pending listing linked to canonical customer, not login uid',async()=>{const r=await submitMyListing.run(request());expect(r).toMatchObject({replayed:false});expect(listings()).toHaveLength(1);expect(listings()[0]![1]).toMatchObject({sellerId:'canonical',status:'pending'});expect(receipt()[1]).not.toHaveProperty('sellerPhone')});
 it('retries exact input without another listing, audit or status reset',async()=>{const a=await submitMyListing.run(request());const[k,v]=listings()[0]!;h.rows.set(k,{...v,status:'live',approvedAt:'accepted'});const count=h.writes;const b=await submitMyListing.run(request());expect(b).toMatchObject({id:(a as any).id,replayed:true});expect(listings()).toHaveLength(1);expect(h.rows.get(k).status).toBe('live');expect(h.writes).toBe(count);expect(h.audit).toHaveBeenCalledOnce()});
 it('same key with different data conflicts, no second write',async()=>{await submitMyListing.run(request());const count=h.writes;await expect(submitMyListing.run(request({...payload,askingPrice:2000000}))).rejects.toMatchObject({code:'already-exists'});expect(h.writes).toBe(count)});
 it('object field insertion order does not change identity',async()=>{const a=await submitMyListing.run(request());const reversed=Object.fromEntries(Object.entries(payload).reverse());expect(await submitMyListing.run(request(reversed))).toMatchObject({id:(a as any).id,replayed:true})});
 it('concurrent attempts have one outcome under transaction serialization',async()=>{const r=await Promise.all([submitMyListing.run(request()),submitMyListing.run(request())]);expect((r[0]as any).id).toBe((r[1]as any).id);expect(listings()).toHaveLength(1);expect(h.audit).toHaveBeenCalledOnce()});
 it('missing prior listing fails closed, does not recreate it',async()=>{await submitMyListing.run(request());h.rows.delete(listings()[0]![0]);await expect(submitMyListing.run(request())).rejects.toMatchObject({code:'failed-precondition'});expect(listings()).toHaveLength(0)});
 it('changed listing principal fails closed',async()=>{await submitMyListing.run(request());const[k,v]=listings()[0]!;h.rows.set(k,{...v,sellerId:'buyer'});await expect(submitMyListing.run(request())).rejects.toMatchObject({code:'failed-precondition'})});
 it('exact readback returns current status without writing',async()=>{const a=await submitMyListing.run(request());const count=h.writes;expect(await getMyListingSubmission.run(request({operationId:payload.operationId}))).toMatchObject({status:'committed',id:(a as any).id,listingStatus:'pending'});expect(h.writes).toBe(count)});
 it('unknown operation readback does not guess by plate/name',async()=>expect(await getMyListingSubmission.run(request({operationId:payload.operationId}))).toEqual({status:'not_found'}));
 it('another principal cannot read a receipt from the first',async()=>{await submitMyListing.run(request());h.cid='other';expect(await getMyListingSubmission.run(request({operationId:payload.operationId}))).toEqual({status:'not_found'})});
 it('legacy unkeyed input stays compatible but is not claimed retry-safe',async()=>{const {operationId,...d}=payload;await submitMyListing.run(request(d));await submitMyListing.run(request(d));expect(listings()).toHaveLength(2);expect([...h.rows.keys()].some(k=>k.startsWith('carListingSubmissions/'))).toBe(false)});
 it('edit checks fresh owner in the transaction, not a stale pre-read',async()=>{await submitMyListing.run(request());const[k,v]=listings()[0]!;h.rows.set(k,{...v,sellerId:'other'});await expect(submitMyListing.run(request({...payload,operationId:'different-key-1234',listingId:v.id}))).rejects.toMatchObject({code:'permission-denied'})});
});
