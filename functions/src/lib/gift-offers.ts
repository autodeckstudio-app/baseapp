import type { Service, StudioConfig } from '@autodeck/core';
import { GIFT_PRICE_CATEGORY, servicePlacement, serviceOnlineBookingIssue, isSizePriced } from '@autodeck/core';
import { COLLECTIONS } from '@autodeck/database';
import { calculatePrice, taxFor } from './pricing.js';
import { readPublicCatalogue } from '../functions/service/getPublicCatalogue.js';

export interface ServiceGiftOffer {serviceId:string;serviceName:string;amountPaise:number;home:'washing'|'detailing'}
/** A gift buys one exact offered service, never an unpriced enquiry or credit balance. */
export function giftServiceEligible(service: Service, tenantId: string): boolean {
 const home=(service.customerMenu ?? servicePlacement(service))?.home;
 return service.tenantId===tenantId && service.active===true && (home==='washing'||home==='detailing') && service.catalogueEntryKind!=='enquiry' && !service.priceOnRequest && !service.priceFrom && (!service.customerMenu||service.customerMenu.priceMode==='fixed') && !serviceOnlineBookingIssue(service) && !isSizePriced(service.category) && Number.isSafeInteger(service.basePrice) && service.basePrice>0;
}
/** Publication membership and current operational availability must both agree. */
export async function currentGiftOffers(db:FirebaseFirestore.Firestore,tenantId:string):Promise<ServiceGiftOffer[]> {
 const published=await readPublicCatalogue(tenantId);
 const cfg=await db.collection(COLLECTIONS.studioConfig()).where('tenantId','==',tenantId).limit(1).get();
 const config=cfg.empty?null:cfg.docs[0]!.data() as StudioConfig;
 const candidates=published.services.filter(s=>giftServiceEligible(s,tenantId));
 const current=await Promise.all(candidates.map(s=>db.collection(COLLECTIONS.services()).doc(s.id).get()));
 return candidates.flatMap((s,i)=>{
  const live=current[i]!.exists?current[i]!.data() as Service:null;
  if(!live||!giftServiceEligible(live,tenantId)||live.basePrice!==s.basePrice||live.currency!==s.currency||live.category!==s.category)return [];
  const amountPaise=calculatePrice({basePrice:live.basePrice,serviceCategory:live.category,vehicleCategory:GIFT_PRICE_CATEGORY,vehicleCategoryPricing:live.vehicleCategoryPricing??[],...taxFor(config),...(config?{currency:config.currency}:{})}).total;
  return [{serviceId:s.id,serviceName:s.name,amountPaise,home:(s.customerMenu??servicePlacement(s))!.home as 'washing'|'detailing'}];
 });
}
