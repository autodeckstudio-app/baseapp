import{it,expect}from'vitest';
import{resolveVisitReviewTarget,visitReviewTargetSchema}from'../../lib/visit-review-target.js';
const b={id:'b',tenantId:'t',customerId:'c',vehicleId:'v',studioId:'s',serviceId:'svc',status:'COMPLETED'};
const j={...b,id:'j',status:'DELIVERED',bookingId:null,isWalkIn:true};
function port(rows:Record<string,any>){const db={collection:(c:string)=>({doc:(id:string)=>({c,id})})};const tx={get:async(ref:any)=>({id:ref.id,data:()=>rows[ref.c+'/'+ref.id]})};return{db,tx}as any;}
async function target(input:any,rows:Record<string,any>){const{db,tx}=port(rows);return resolveVisitReviewTarget(db,tx,input,'t',['c','auth']);}
it('retains existing booking review ID and gives completed walkin one stable namespace',async()=>{expect(await target({bookingId:'b'},{'bookings/b':b})).toMatchObject({id:'b',bookingId:'b',source:'booking'});expect(await target({jobId:'j'},{'jobs/j':j})).toMatchObject({id:'walkin-j',bookingId:null,jobId:'j',source:'walkin'});});
it('job and booking routes converge on one review, never two service ratings',async()=>{expect(await target({jobId:'j'},{'jobs/j':{...j,bookingId:'b'},'bookings/b':b})).toMatchObject({id:'b',bookingId:'b',jobId:'j'});});
it('rejects foreign tenant/owner, unfinished/malformed job and missing app booking',async()=>{for(const change of[{tenantId:'other'},{customerId:'other'},{status:'READY_FOR_DELIVERY'},{id:'other'},{isWalkIn:false},{bookingId:'missing'}])await expect(target({jobId:'j'},{'jobs/j':{...j,...change}})).rejects.toBeDefined();});
it('linked visit identity must match exact customer car studio service, not a plausible link',async()=>{for(const key of['customerId','vehicleId','studioId','serviceId'])await expect(target({jobId:'j'},{'jobs/j':{...j,bookingId:'b'},'bookings/b':{...b,[key]:'other'}})).rejects.toBeDefined();});
it('noncompleted/foreign/missing booking cannot be reviewed',async()=>{for(const value of[undefined,{...b,status:'CONFIRMED'},{...b,tenantId:'other'},{...b,customerId:'other'},{...b,id:'other'}])await expect(target({bookingId:'b'},{'bookings/b':value})).rejects.toBeDefined();});
it('strict target rejects ambiguous, injected or absent destination',()=>{for(const input of[{},{bookingId:'b',jobId:'j'},{jobId:'../x'},{jobId:'j',customerId:'other'}])expect(visitReviewTargetSchema.safeParse(input).success).toBe(false)});
