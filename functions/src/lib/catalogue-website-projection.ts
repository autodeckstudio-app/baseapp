import type{CustomerCatalogueSnapshot}from'./catalogue-customer-snapshot.js';
// The website uses the exact approved publication identity, never its prices.
// Keep this separate from the authenticated Customer/booking catalogue.
const monetary=/(?:₹|\b(?:INR|Rs\.?|USD|EUR|GBP)\s*\d|[$€£]\s*\d|\d[\d,.]*\s*(?:rupees?|paise)\b)/i;
export function websiteCatalogueText(value:unknown):string{
 if(typeof value!=='string')return '';
 // Free text is not a trusted non-price field. Withhold the whole field rather
 // than risk a partial range, tax amount or estimate leaking through.
 return monetary.test(value)?'':value;
}
export function websiteCatalogueProjection(data:CustomerCatalogueSnapshot){
 const identity=(value:unknown)=>{const text=websiteCatalogueText(value);if(!text)throw Error('Website catalogue identity unavailable');return text;};
 return{publishId:data.publishId,hash:data.hash,publishedAt:data.publishedAt,
 services:data.services.map(row=>({id:row.id,name:identity(row.name),description:websiteCatalogueText(row.description),customerMenu:{home:identity(row.customerMenu?.home),family:identity(row.customerMenu?.family)}})),
 references:data.references.map(row=>({key:row.key,name:identity(row.name),brand:websiteCatalogueText(row.brand),group:row.group,surface:row.surface,...(row.customerMenu?{customerMenu:{home:identity(row.customerMenu.home),family:identity(row.customerMenu.family)}}:{})}))};
}
