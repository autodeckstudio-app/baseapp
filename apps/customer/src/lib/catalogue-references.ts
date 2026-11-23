import{setPublishedBrandEnquiries,type BrandEnquiry}from'./brand-enquiries';
// Missing transport or a cold session is not permission to revive bundled offerings.
let references:BrandEnquiry[]=[];
/** Only an explicit fresh publication may supply enquiry offerings. */
export function setCatalogueReferences(value:BrandEnquiry[]|null|undefined){references=value??[];setPublishedBrandEnquiries(references)}
export function catalogueReferences(){return references}
