import {it,expect}from 'vitest';
import{readFileSync}from'node:fs';
import type{Service}from'@autodeck/core';
import{alignedCustomerServices,servicePlacement,referenceChoices,referencePlacement,HOME_COPY,FAMILY_COPY}from'@autodeck/core';
import{currentServices,servicePlacement as customerPlacement,referencePlacement as customerRefPlacement,referenceChoices as customerReferences,HOME_COPY as customerHome,FAMILY_COPY as customerFamily}from'../../../customer/src/lib/services-navigation';
import{alignedCustomerPriceLabel,reviewedStartingPrice}from'../../../../packages/core/src/catalogue-price-display';
import{reviewedStartingPrice as customerPrice}from'../../../customer/src/lib/reviewed-starting-prices';
import{alignedCustomerWarranty}from'../../../../packages/core/src/catalogue-warranty-display';
import{applyBrandWarranty}from'../../../customer/src/lib/warranty-labels';
import{MENU_SEED}from'../../../../packages/core/src/menu';
it('Admin/Studio projection is exactly the frozen Customer classification, eligibility, ordering and references, excluding non-catalogue pickup',()=>{
 const rows=MENU_SEED.map(m=>({id:m.id,name:m.name,category:m.category,brand:m.brand,active:true,displayOrder:m.order,description:m.description,basePrice:m.rupees*100,currency:'INR'}as Service));
 expect(alignedCustomerServices(rows)).toEqual(currentServices(rows).filter(s=>customerPlacement(s)!==null));
 for(const row of rows){expect(servicePlacement(row)).toEqual(customerPlacement(row));expect(alignedCustomerWarranty(row)).toEqual(applyBrandWarranty(row));expect(reviewedStartingPrice(row)).toEqual(customerPrice(row));}
 const menu=alignedCustomerServices(rows);expect(referenceChoices(menu)).toEqual(customerReferences(menu));for(const ref of referenceChoices(menu))expect(referencePlacement(ref)).toEqual(customerRefPlacement(ref));expect(HOME_COPY).toEqual(customerHome);expect(FAMILY_COPY).toEqual(customerFamily);
});
it('unconfirmed, inactive, pickup and similarly named invented IDs never enter final menu',()=>{const s={id:'menu-wash-exterior',name:'Ceramic wash',category:'washing',active:true,description:'',basePrice:200000}as Service;expect(alignedCustomerServices([s,s])).toEqual([s]);expect(alignedCustomerServices([{...s,id:'fake'}, {...s,active:false},{...s,id:'menu-pickup',category:'pickup'}])).toEqual([]);});
it('quote-only products never show zero rupees; approved From labels stay conditional on exact ID/category/value',()=>{expect(alignedCustomerPriceLabel({id:'unreviewed',basePrice:0,priceOnRequest:true})).toBe('Quote on request');expect(alignedCustomerPriceLabel({basePrice:12300,priceFrom:true})).toBe('From ₹123');const customer=JSON.parse(readFileSync(new URL('../../../customer/src/lib/reviewed-starting-prices.json',import.meta.url),'utf8'));const mirror=JSON.parse(readFileSync(new URL('../../../../packages/core/src/catalogue-starting-prices.json',import.meta.url),'utf8'));expect(mirror).toEqual(customer);for(const[id,row]of Object.entries(mirror)as [string,{basePrice:number;category:string}][]){const s={id,...row};expect(reviewedStartingPrice(s)).toEqual(customerPrice(s));expect(reviewedStartingPrice({...s,basePrice:s.basePrice+1})).toBeNull();}});
