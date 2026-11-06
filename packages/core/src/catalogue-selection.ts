import type{Service,VehicleCategory,CoverageLevel}from'./types/service.js';
/** Migration-compatible selection. A legacy coverage record is not an exact film offer. */
export interface CatalogueChoice{serviceKind:'ppf'|'ceramic'|'washing'|'garage';brand:string|null;productId:string|null;coverage:CoverageLevel|null;vehicleCategory:VehicleCategory|null}
export interface OfferAssignment{offerId:string;serviceId:string;serviceKind:CatalogueChoice['serviceKind'];brand:string|null;productId:string|null;coverage:CoverageLevel|null;vehicleCategories:VehicleCategory[];status:'published'|'hidden';version:string}
export type SelectionResolution={kind:'choose';missing:Array<'brand'|'product'|'coverage'|'car'>}|{kind:'quote';reason:'combination-unpriced'|'needs-inspection';choice:CatalogueChoice}|{kind:'offer';service:Service;assignment:OfferAssignment;choice:CatalogueChoice};
export function resolveCatalogueSelection(choice:CatalogueChoice,assignments:OfferAssignment[],services:Service[]):SelectionResolution{
 if(choice.serviceKind==='garage')return{kind:'quote',reason:'needs-inspection',choice};
 const missing:Array<'brand'|'product'|'coverage'|'car'>=[];
 if(choice.serviceKind==='ppf'){if(!choice.brand)missing.push('brand');if(!choice.productId)missing.push('product');if(!choice.coverage)missing.push('coverage');if(!choice.vehicleCategory)missing.push('car');}
 if(missing.length)return{kind:'choose',missing};
 const matches=assignments.filter(a=>a.status==='published'&&a.serviceKind===choice.serviceKind&&a.brand===choice.brand&&a.productId===choice.productId&&a.coverage===choice.coverage&&(!choice.vehicleCategory||a.vehicleCategories.includes(choice.vehicleCategory)));
 if(matches.length>1)throw Error('Ambiguous published offer assignment');
 const assignment=matches[0],service=assignment?services.find(s=>s.id===assignment.serviceId&&s.active):undefined;
 if(!assignment||!service||service.priceOnRequest)return{kind:'quote',reason:'combination-unpriced',choice};
 if(service.brand!==assignment.brand||service.category!==assignment.serviceKind&&!(choice.serviceKind==='ceramic'&&service.category==='coating')||service.coverageLevel&&service.coverageLevel!==assignment.coverage)throw Error('Offer-service identity conflict');
 return{kind:'offer',service,assignment,choice};
}
/** Explicitly coverage-only. No manufacturer's film identity inferred from price/year/brand. */
export function legacyCoverageOffers(services:Service[]){return services.filter(s=>s.active&&s.category==='ppf'&&s.coverageLevel).map(s=>({legacyServiceId:s.id,brand:s.brand,coverage:s.coverageLevel!,productId:null,basePrice:s.basePrice,vehicleCategoryPricing:s.vehicleCategoryPricing,needsProductAssignment:true as const}));}
