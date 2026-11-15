import{referencePlacement,type BrandEnquiry,type Service}from'@autodeck/core';
/** Enquiry metadata is a catalogue record, never an operational booking. */
export function referenceEntry(reference:BrandEnquiry,order:number):Service{
 const placement=referencePlacement(reference);
 return{id:'enquiry_'+reference.key,tenantId:'automodz',catalogueEntryKind:'enquiry',referenceKey:reference.key,referenceGroup:reference.group,...(reference.surface?{referenceSurface:reference.surface}:{}),name:reference.name,brand:reference.brand,description:reference.note,category:placement.home==='modifications'?'modifications':reference.group==='ppf'?'ppf':'coating',basePrice:0,currency:'INR',estimatedDurationMinutes:0,warrantyLabel:null,warrantyDurationValue:null,warrantyDurationUnit:null,vehicleCategoryPricing:[],requiredBayType:'general',membershipWashEligible:false,priceOnRequest:true,priceFrom:false,displayOrder:order,active:true,createdAt:'baseline',updatedAt:'baseline',customerMenu:{...placement,priceMode:'quote',priceNote:'',priceCondition:''}};
}
export function serviceReference(row:Service):BrandEnquiry{
 if(row.catalogueEntryKind!=='enquiry'||!row.referenceKey||!row.referenceGroup||!row.customerMenu)throw Error('Exact enquiry metadata required');
 return{key:row.referenceKey,brand:row.brand,name:row.name,group:row.referenceGroup,note:row.description,...(row.referenceSurface?{surface:row.referenceSurface}:{}),customerMenu:{home:row.customerMenu.home,family:row.customerMenu.family}};
}
