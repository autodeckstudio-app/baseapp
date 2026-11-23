import terms from './product-manufacturer-warranty.json';
/** Maker-stated product terms, not an assertion that AutoDeck installation qualifies. */
export function manufacturerWarranty(name:string){return (terms as Record<string,{duration:string;terms:string;sourceUrl:string}>)[name];}

/** Customer-relevant application condition, separate from any warranty-duration claim. */
export function manufacturerApplicationTerms(name:string){
 return name==='Fireball DOK DO'?{terms:'The manufacturer reserves DOK DO for its hand-picked installers. Application is subject to that requirement.',sourceUrl:'https://www.fireballkorea.com/ceramic-coating/dok-do'}:undefined;
}
