import{it,expect,beforeEach}from'vitest';
import{getFirestore}from'firebase-admin/firestore';
import{createWalkinJob}from'../../functions/job/createWalkinJob';
import{requestServiceQuote}from'../../functions/booking/serviceQuoteJourney';
import{randomUUID}from'node:crypto';
import{createBooking}from'../../functions/booking/createBooking';
import{getAvailability}from'../../functions/booking/getAvailability';
import{prepareWalkinVisitIntake}from'../../functions/visit/walkinVisitIntake';
const db=getFirestore();let uid:string;
const date=()=>new Date(Date.now()+2*86400000).toISOString().slice(0,10);
const request=(data:any,role='customer')=>({data,auth:{uid,token:{role,tenantId:'non-online-tests',studioId:'s'}}}as any);
beforeEach(async()=>{uid=randomUUID();await db.collection('customers').doc(uid).set({id:uid,tenantId:'non-online-tests',authUid:uid});await db.collection('vehicles').doc(uid).set({id:uid,tenantId:'non-online-tests',ownerId:uid,category:'sedan'});await db.collection('studioConfig').doc('s').set({id:'s',tenantId:'non-online-tests',bays:[{id:'general',bayType:'general',active:true}]});for(const mode of['walk_in','coordination','online'])await db.collection('services').doc(mode).set({id:mode,tenantId:'non-online-tests',name:mode,active:true,category:'garage',requiredBayType:'general',basePrice:mode==='walk_in'?0:180000,priceOnRequest:false,vehicleCategoryPricing:[],estimatedDurationMinutes:mode==='online'?60:0,customerMenu:{home:'garage',family:'Checks',priceMode:'fixed',priceNote:'',priceCondition:'',...(mode==='online'?{}:{bookingMode:mode})}})});
for(const mode of['walk_in','coordination']){
 it(mode+' blocks single scheduled walkin job',async()=>{await expect(createWalkinJob.run(request({serviceId:mode,customerId:uid,vehicleId:uid,vehicleCategory:'sedan',studioId:'s',bayId:'general'},'studio'))).rejects.toThrow(/cannot create/);expect((await db.collection('jobs').where('customerId','==',uid).get()).empty).toBe(true)});
 it(mode+' blocks new quote-journey conversion',async()=>{await expect(requestServiceQuote.run(request({requestId:randomUUID(),studioId:'s',scope:{serviceId:mode,vehicleId:uid,productKey:null,coverage:'Offline service'}}))).rejects.toThrow(/handled offline/);expect((await db.collection('serviceQuoteJourneys').where('customerId','==',uid).get()).empty).toBe(true)});
 for(const quote of[false,true]){
  const scope=quote?{quoteJourneyId:'not-accepted',quoteRevision:1,quoteTermsVersion:'v1'}:{};
  it(mode+' blocks availability even with quote='+quote,async()=>{await expect(getAvailability.run(request({serviceId:mode,studioId:'s',startDate:date(),...scope}))).rejects.toThrow(mode==='walk_in'?/walk-in only/:/coordinate/)});
  it(mode+' blocks booking even with quote='+quote,async()=>{await expect(createBooking.run(request({serviceId:mode,studioId:'s',vehicleId:uid,vehicleCategory:'sedan',scheduledDate:date(),scheduledTime:'12:00',idempotencyKey:randomUUID(),...scope}))).rejects.toThrow(mode==='walk_in'?/walk-in only/:/coordinate/);expect((await db.collection('bookings').where('customerId','==',uid).get()).empty).toBe(true);expect((await db.collection('jobs').where('customerId','==',uid).get()).empty).toBe(true)});
 }
 it(mode+' blocks availability as an extra',async()=>{await expect(getAvailability.run(request({serviceId:'online',studioId:'s',startDate:date(),extraServiceIds:[mode]}))).rejects.toThrow(/cannot be added/)});
 it(mode+' stays outside positive-duration walkin intake',async()=>{await expect(prepareWalkinVisitIntake.run(request({operationId:randomUUID(),customerId:uid,vehicleId:uid,studioId:'s',serviceIds:['online',mode]},'studio'))).rejects.toThrow(/unavailable/);expect((await db.collection('visitIntakes').where('customerId','==',uid).get()).empty).toBe(true)});
}
