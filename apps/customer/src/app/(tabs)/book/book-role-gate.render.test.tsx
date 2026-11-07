import React from'react';import{it,expect,vi,beforeEach,afterEach}from'vitest';import{create,act}from'react-test-renderer';
// Regression: a signed-in staff/admin account (no customerDocId by design) used
// to land on "Service not found - It may have been taken off the menu" for ANY
// real service, because the service-load effect never re-fires once auth is
// ready without a customer doc. The honest terminal account states must show
// instead, and no transient state may flash a misleading one.
const h=vi.hoisted(()=>({params:{serviceId:'menu-coat-kovalent-graphene'}as any,auth:{status:'ready',customerDocId:null,user:{uid:'auth'},claims:{tenantId:'t',role:'admin'}} as any}));
vi.mock('expo-router',()=>({useLocalSearchParams:()=>h.params,useRouter:()=>({replace:vi.fn(),push:vi.fn(),back:vi.fn()}),useNavigation:()=>({getState:()=>({routes:[]}),dispatch:vi.fn()})}));
vi.mock('../../../hooks/useAuth',()=>({useAuth:()=>h.auth}));
vi.mock('../../../lib/firebase',()=>({db:{}}));vi.mock('firebase/firestore',()=>({doc:(_:any,c:any,id:any)=>({c,id}),getDoc:async(ref:any)=>({exists:()=>true,data:()=>({id:ref.id,name:ref.id,estimatedDurationMinutes:60,priceOnRequest:false,onlinePaymentEnabled:false,payAtStudioEnabled:true})})}));
vi.mock('@react-native-async-storage/async-storage',()=>({default:{getItem:async()=>null}}));vi.mock('../../../lib/imagery',()=>({sceneImagery:{},serviceImagery:{}}));vi.mock('../../../ui/CarThumb',()=>({CarThumb:()=>null}));vi.mock('../../../lib/vehicle-service',()=>({listenToMyVehicles:()=>()=>{},updateVehicle:vi.fn()}));vi.mock('../../../lib/booking-service',()=>({getAvailability:async()=>[],peekAvailability:()=>null,todayIST:()=>'2099-01-01',createBooking:vi.fn(),generateIdempotencyKey:()=>'k',getStudioInfo:async()=>({operatingHours:[]})}));
vi.mock('../../../lib/catalogue-service',()=>({getServiceCatalogue:async()=>[{id:'menu-coat-kovalent-graphene',name:'Sample ceramic coat',active:true,category:'ceramic',estimatedDurationMinutes:480,requiredBayType:'protection',priceOnRequest:false,onlinePaymentEnabled:false,payAtStudioEnabled:true}],calculateServicePrice:async()=>({breakdown:{basePrice:10000,subtotal:10000,total:10000,tax:0,scopeAdjustment:0,membershipDiscount:null}})}));vi.mock('../../../lib/job-service',()=>({getJobIdForBooking:vi.fn()}));vi.mock('../../../lib/payment-service',()=>({initiatePayment:vi.fn(),requestAdvancePayment:vi.fn()}));vi.mock('../../../lib/razorpay-checkout',()=>({payOnline:vi.fn(),payWithPaymentLink:vi.fn()}));
vi.mock('../../../lib/gift',()=>({GIFT_LIVE:false,takePendingGiftCode:()=>null}));vi.mock('../../../lib/advance-booking',()=>({ADVANCE_SPLIT_ENABLED:false,advanceDisclosureLines:()=>({}),advancePreviewFromParts:()=>null,needsBookingAdvance:()=>false}));vi.mock('../../../lib/referral',()=>({REFERRAL_LIVE:false,normaliseReferralCode:()=>null,referralCodeToSend:()=>null}));vi.mock('../../../lib/membership-wash',()=>({MEMBERSHIP_WASH_LIVE:false,pickWash:()=>null,todayInIndia:()=>''}));vi.mock('../../../lib/membership-service',()=>({getMyMemberships:async()=>[],getMembershipPlans:async()=>[]}));vi.mock('../../../lib/pickup-service',()=>({getDeviceLocation:async()=>null,getPickupQuote:vi.fn(),requestPickupDrop:vi.fn(),describePickupQuote:()=>''}));vi.mock('../../../ui/ServicePhoto',()=>({ServicePhoto:()=>null}));
vi.mock('@autodeck/core',async(importOriginal)=>({...await importOriginal<any>(),bookingPayment:()=>({online:false,studioChoice:true})}));
vi.mock('../../../ui/kit',()=>({Button:'Button',Chip:'Chip',Plate:'Plate',Skeleton:'Skeleton',Field:'Field',Kicker:'Kicker',Loading:'Loading',Notice:({title,body,action}:any)=>React.createElement('notice',{title,body},action),Pane:'Pane',Row:({title,detail,trailing}:any)=>React.createElement('row',null,title,detail,trailing),Screen:({header,children}:any)=>React.createElement('screen',null,header,children),T:'T',rupees:String}));vi.mock('../../../ui/Sheet',()=>({Sheet:'Sheet',SheetTotal:'SheetTotal',SheetLine:'SheetLine',SheetDivider:'SheetDivider'}));vi.mock('../../../ui/inputs',()=>({SelectField:'SelectField'}));
import Entry from'./[serviceId]';beforeEach(()=>{h.params={serviceId:'menu-coat-kovalent-graphene'};h.auth={status:'ready',customerDocId:null,user:{uid:'auth'},claims:{tenantId:'t',role:'admin'}}});afterEach(()=>vi.useRealTimers());
const text=(r:any)=>JSON.stringify(r.toJSON());
it('a staff/admin sign-in gets the honest booking role gate, never "Service not found" for a real service',async()=>{
  let r:any;await act(async()=>{r=create(<Entry/>)});await act(async()=>{});
  expect(text(r)).toContain('Booking uses a customer account');
  expect(text(r)).toContain('staff or admin account');
  expect(text(r)).not.toContain('Service not found');
  await act(async()=>r.unmount())
});
it('a customer sign-in whose record is not verified gets the verification notice, not "Service not found"',async()=>{
  h.auth={status:'ready',customerDocId:null,user:{uid:'auth'},claims:{tenantId:'t',role:'customer'}};
  let r:any;await act(async()=>{r=create(<Entry/>)});await act(async()=>{});
  expect(text(r)).toContain('Customer profile could not be verified');
  expect(text(r)).not.toContain('Service not found');
  await act(async()=>r.unmount())
});
it('while auth is still resolving the page waits honestly - no role gate and no "Service not found" flash',async()=>{
  h.auth={status:'loading'};
  let r:any;await act(async()=>{r=create(<Entry/>)});await act(async()=>{});
  const t=text(r);
  expect(t).not.toContain('Booking uses a customer account');
  expect(t).not.toContain('Customer profile could not be verified');
  expect(t).not.toContain('Service not found');
  await act(async()=>r.unmount())
});
it('a signed-out or claims-less session gets a sign-in notice, not "Service not found"',async()=>{
  h.auth={status:'unauthenticated'};
  let r:any;await act(async()=>{r=create(<Entry/>)});await act(async()=>{});
  const t=text(r);
  expect(t).toContain('Sign in to book');
  expect(t).not.toContain('Service not found');
  await act(async()=>r.unmount())
});
it('when auth resolves to ready without a customer record, the gate appears - never stuck loading, never "Service not found"',async()=>{
  h.auth={status:'loading'};
  let r:any;await act(async()=>{r=create(<Entry/>)});await act(async()=>{});
  expect(text(r)).not.toContain('Service not found');
  h.auth={status:'ready',customerDocId:null,user:{uid:'auth'},claims:{tenantId:'t',role:'admin'}};
  await act(async()=>{r.update(<Entry/>)});await act(async()=>{});
  const t=text(r);
  expect(t).toContain('Booking uses a customer account');
  expect(t).not.toContain('Service not found');
  await act(async()=>r.unmount())
});
