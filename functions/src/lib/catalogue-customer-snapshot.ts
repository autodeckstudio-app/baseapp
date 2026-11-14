
import{serviceReference}from'./catalogue-reference-entries.js';
import type {BRAND_ENQUIRIES} from '@autodeck/core';
import {alignedCustomerServices,alignedCustomerWarranty,reviewedStartingPrice,servicePlacement,referenceChoices,customerOfferingVisible,type Service} from '@autodeck/core';
import {catalogueReviewHash} from './catalogue-draft.js';
export interface CustomerCatalogueSnapshot {tenantId:string;publishId:string;hash:string;publishedAt:string|null;services:Service[];sourceIds?:string[];references:typeof BRAND_ENQUIRIES}
// An explicit allowlist, never a spread of service data: staff-only metadata must
// not cross the anonymous website or customer boundary, now or after new fields.
const fields=['id','tenantId','name','category','brand','description','basePrice','currency','estimatedDurationMinutes','warrantyLabel','careTips','warrantyDurationValue','warrantyDurationUnit','vehicleCategoryPricing','requiredBayType','membershipWashEligible','priceOnRequest','productKey','ppfWork','coverageLevel','priceFrom','priceEstimate','imageUrl','active','displayOrder','createdAt','updatedAt','catalogueVersion','customerMenu','catalogueEntryKind','referenceKey','referenceGroup','referenceSurface'] as const;
export function safeCustomerService(row:Service):Service{return Object.fromEntries(fields.filter(k=>(row as any)[k]!==undefined).map(k=>[k,(row as any)[k]])) as unknown as Service;}
export function currentCustomerMenu(row:Service):NonNullable<Service['customerMenu']>{
 if(row.customerMenu)return row.customerMenu;
 const placement=servicePlacement(row);if(!placement)throw Error('Customer menu placement required');
 const reviewed=reviewedStartingPrice(row);
 return {...placement,priceMode:reviewed?'from':row.priceOnRequest?'quote':row.priceFrom?'from':'fixed',priceNote:reviewed?.note??'',priceCondition:reviewed?.condition??''};
}
export function buildCustomerCatalogueSnapshot(input:{tenantId:string;publishId:string;publishedAt:string|null;rows:Service[];changes:Service[]}):CustomerCatalogueSnapshot{
 if(!input.tenantId||!input.publishId)throw Error('Exact publication identity required');
 const byId=new Map(input.rows.filter(s=>s.tenantId===input.tenantId).map(s=>[s.id,s]));
 for(const changed of input.changes){if(changed.tenantId!==input.tenantId)throw Error('Publication tenant mismatch');if(changed.active===true&&!changed.customerMenu&&!customerOfferingVisible(changed))throw Error('Explicit customer menu placement required for a new offering');byId.set(changed.id,changed.active===true?{...changed,customerMenu:currentCustomerMenu(changed)}:changed);}
 const allEntries=[...byId.values()];const services=alignedCustomerServices(allEntries).filter(row=>row.catalogueEntryKind!=='enquiry').map(row=>safeCustomerService({...(!row.customerMenu?alignedCustomerWarranty(row):row),customerMenu:currentCustomerMenu(row)}));
 if(services.length>350)throw Error('Catalogue exceeds publication bound');
 const enquiryEntries=allEntries.filter(row=>row.catalogueEntryKind==='enquiry');const references=enquiryEntries.length?referenceChoices([...services,...enquiryEntries]):referenceChoices(services);const sourceIds=[...new Set([...services.map(row=>row.id),...enquiryEntries.map(row=>row.id)])].sort();const body={tenantId:input.tenantId,publishId:input.publishId,publishedAt:input.publishedAt,services,references,sourceIds};
 if(Buffer.byteLength(JSON.stringify(body),'utf8')>800_000)throw Error('Catalogue exceeds safe snapshot size');
 return {...body,hash:catalogueReviewHash(body)};
}
