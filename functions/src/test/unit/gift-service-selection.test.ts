import {describe,it,expect,vi,beforeEach} from 'vitest';
const h=vi.hoisted(()=>({db:null as any,published:[] as any[],publicationFails:false}));
vi.mock('firebase-admin/firestore',()=>({getFirestore:()=>h.db}));
vi.mock('../../middleware/audit.js',()=>({writeAuditLog:()=>undefined}));
vi.mock('../../middleware/rateLimit.js',()=>({enforceRateLimit:async()=>undefined,subjectFrom:()=> 'local-only'}));
vi.mock('../../functions/service/getPublicCatalogue.js',()=>({readPublicCatalogue:async()=>{if(h.publicationFails)throw Error('offline');return {services:h.published}} }));
import {giftServiceEligible,currentGiftOffers} from '../../lib/gift-offers.js';
import {createGift,listMyGifts,redeemGift,getGiftCode} from '../../functions/gift/gift.js';
import {createGiftPurchase} from '../../lib/gift-purchase.js';
import {hashGiftCode} from '../../lib/gift-code.js';
import {fakeFirestore} from './fake-firestore.js';
const service=(id='wash',extra:any={})=>({id,tenantId:'t',name:id==='wash'?'Regular Wash':'Glass Coating',active:true,basePrice:60000,category:'washing',currency:'INR',vehicleCategoryPricing:[],customerMenu:{home:'washing',family:'Exterior wash',priceMode:'fixed'},...extra});
const user:any={uid:'login',claims:{tenantId:'t',role:'customer'}};
const auth={uid:'login',token:{tenantId:'t',role:'customer',email:'test@example.invalid'}};
function setup(extra:any={}){
 const f=fakeFirestore({customers:{canonical:{authUid:'login',tenantId:'t'}},services:{wash:service(),glass:service('glass',{category:'coating',basePrice:300000,customerMenu:{home:'detailing',family:'Glass',priceMode:'fixed'}})},...extra});
 const orig=f.db.collection;const wrap=(q:any):any=>({...q,where:(...a:any[])=>wrap(q.where(...a)),limit:(...a:any[])=>wrap(q.limit(...a)),orderBy:()=>wrap(q)});
 f.db.collection=(n:string)=>{const c=orig(n);return {...c,where:(...a:any[])=>wrap(c.where(...a))};};h.db=f.db;return f;
}
beforeEach(()=>{h.publicationFails=false;h.published=[service(),service('glass',{category:'coating',basePrice:300000,customerMenu:{home:'detailing',family:'Glass',priceMode:'fixed'}})];});
describe('exact washing/detailing gift selection',()=>{
 it('uses customer menu placement, not a nonexistent detailing raw category',()=>{
  expect(giftServiceEligible(service('glass',{category:'coating',customerMenu:{home:'detailing',priceMode:'fixed'}})as any,'t')).toBe(true);
  for(const x of [{active:false},{tenantId:'other'},{priceOnRequest:true},{priceFrom:true},{basePrice:0},{category:'ppf'},{catalogueEntryKind:'enquiry'},{customerMenu:{home:'paint',priceMode:'fixed'}},{customerMenu:{home:'detailing',priceMode:'quote'}},{customerMenu:{home:'detailing',priceMode:'fixed',bookingMode:'coordination'}}])expect(giftServiceEligible(service('wash',x)as any,'t')).toBe(false);
 });
 it('only offers published active records whose live prices still match',async()=>{
  setup({services:{wash:service(),glass:service('glass',{active:false})}});
  expect(await currentGiftOffers(h.db,'t')).toEqual([{serviceId:'wash',serviceName:'Regular Wash',amountPaise:60000,home:'washing'}]);
  setup({services:{wash:service('wash',{basePrice:60100})}});expect(await currentGiftOffers(h.db,'t')).toEqual([]);
 });
 it('creates the selected exact entitlement at server price and canonical owner',async()=>{
  const {data}=setup();const r=await (createGift as any).run({data:{serviceId:'glass'},auth});
  expect(r).toMatchObject({amountPaise:300000,serviceId:'glass',serviceName:'Glass Coating'});
  expect(data.gifts![r.giftId]).toMatchObject({serviceId:'glass',serviceName:'Glass Coating',buyerId:'canonical',amountPaise:300000,status:'PENDING_PAYMENT'});
  expect(data.payments![r.paymentId]).toMatchObject({customerId:'canonical',amount:300000,status:'pending'});
 });
 it('refuses client price injection, unknown, inactive and unpublished services without writes',async()=>{
  const {data}=setup();for(const input of [{serviceId:'wash',amountPaise:1},{serviceId:'missing'},{serviceId:'menu-wash-foam'}])await expect((createGift as any).run({data:input,auth})).rejects.toBeTruthy();
  expect(Object.keys(data.gifts??{})).toHaveLength(0);
 });
 it('same price different service cannot reuse another entitlement, retry still returns its exact purchase',async()=>{
  const {db,data}=setup();const a=await createGiftPurchase(db as any,user,'canonical',60000,{serviceId:'wash',serviceName:'Regular Wash'});
  const b=await createGiftPurchase(db as any,user,'canonical',60000,{serviceId:'glass',serviceName:'Glass Coating'});
  expect(b.giftId).not.toBe(a.giftId);const again=await createGiftPurchase(db as any,user,'canonical',60000,{serviceId:'wash',serviceName:'Regular Wash'});
  expect(again.giftId).toBe(a.giftId);expect(data.gifts![a.giftId]!.serviceId).toBe('wash');expect(data.gifts![b.giftId]!.serviceId).toBe('glass');
 });
 it('claim/list/code retain service identity and never expose a secret in public views',async()=>{
  const code='GW-ABCD-2345',expiresAt=new Date(Date.now()+86400000).toISOString();
  const g={id:'old',tenantId:'t',buyerId:'canonical',serviceId:'glass',serviceName:'Glass Coating',amountPaise:300000,status:'ACTIVE',createdAt:new Date().toISOString(),expiresAt,codeHash:hashGiftCode(code),codeTail:'2345',claimedBy:null};
  const {data}=setup({gifts:{old:g},giftSecrets:{old:{code}}});
  const list=await(listMyGifts as any).run({data:{},auth});expect(list.offers).toHaveLength(2);expect(list.gifts[0]).toMatchObject({serviceId:'glass',serviceName:'Glass Coating'});expect(JSON.stringify(list)).not.toContain('codeHash');
  expect(await(getGiftCode as any).run({data:{giftId:'old'},auth})).toMatchObject({serviceId:'glass',serviceName:'Glass Coating',code});
  expect(await(redeemGift as any).run({data:{code},auth,rawRequest:{ip:'local'}})).toMatchObject({serviceId:'glass'});expect(data.gifts!.old!.claimedBy).toBe('canonical');
 });
 it('legacy gifts preserve serviceId and display Foam wash, never substitute a new service',async()=>{
  const g={id:'old',tenantId:'t',buyerId:'canonical',serviceId:'menu-wash-foam',amountPaise:90000,status:'ACTIVE',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),codeTail:'2345'};
  const {data}=setup({gifts:{old:g}});const list=await(listMyGifts as any).run({data:{},auth});expect(list.gifts[0]).toMatchObject({serviceId:'menu-wash-foam',serviceName:'Foam wash',amountPaise:90000});expect(data.gifts!.old).toEqual(g);
 });
});

it('publication unavailable does not hide already-bought gifts or invent offers',async()=>{setup({gifts:{old:{id:'old',tenantId:'t',buyerId:'canonical',serviceId:'glass',serviceName:'Glass Coating',amountPaise:300000,status:'ACTIVE',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),codeTail:'2345'}}});h.publicationFails=true;const r=await(listMyGifts as any).run({data:{},auth});expect(r.gifts).toHaveLength(1);expect(r.offers).toEqual([]);});
it('a forged retry slot or foreign payment never gets adopted',async()=>{
 const now=new Date().toISOString();const {db,data}=setup({giftPurchaseSlots:{canonical:{giftId:'foreign',paymentId:'foreign-pay',amountPaise:60000,updatedAt:now}},gifts:{foreign:{id:'foreign',tenantId:'other',buyerId:'canonical',serviceId:'wash',amountPaise:60000,status:'PENDING_PAYMENT',createdAt:now}},payments:{'foreign-pay':{id:'foreign-pay',tenantId:'other',customerId:'canonical',giftId:'foreign',amount:60000,status:'pending'}}});
 const r=await createGiftPurchase(db as any,user,'canonical',60000,{serviceId:'wash'});expect(r.giftId).not.toBe('foreign');expect(data.gifts![r.giftId]!.tenantId).toBe('t');
});

it('reminder and share copy names the purchased service without changing legacy wash copy',async()=>{const {giftReminderText,giftShareMessage}=await import('@autodeck/core');expect(giftReminderText(7,'Glass Coating').body).toContain('Glass Coating');expect(giftReminderText(0).body).toContain('wash');expect(giftShareMessage({buyerFirstName:null,code:'GWABCD2345',expiresAt:'2026-12-20',studioName:'AutoDeck',serviceName:'Glass Coating'})).toContain('Glass Coating');});
