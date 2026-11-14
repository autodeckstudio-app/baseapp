import{setPublishedBrandEnquiries,type BrandEnquiry}from'./brand-enquiries';
let references:BrandEnquiry[]|undefined;
/** The exact published enquiry set; undefined alone means pre-migration. */
export function setCatalogueReferences(value:BrandEnquiry[]|undefined){references=value;setPublishedBrandEnquiries(value)}
export function catalogueReferences(){return references}
