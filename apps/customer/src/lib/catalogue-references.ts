import{setPublishedBrandEnquiries,type BrandEnquiry}from'./brand-enquiries';
let references:BrandEnquiry[]|undefined;
/** The exact published enquiry set; undefined alone means pre-migration. */
export function setCatalogueReferences(value:BrandEnquiry[]|null|undefined){references=value??undefined;setPublishedBrandEnquiries(references)}
export function catalogueReferences(){return references}
