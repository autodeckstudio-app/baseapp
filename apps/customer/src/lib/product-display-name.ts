import type{Service}from'@autodeck/core';
/** Display-only: punctuation differences in a brand prefix must not repeat the brand. */
export function productDisplayName(item:Pick<Service,'name'|'brand'>){
 if(item.brand==='Standard')return 'Standard';
 const words=[...(item.brand??'').replace(/[^\p{L}\p{N}]/gu,'')];
 if(!words.length)return item.name;
 const escaped=words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 const prefix=new RegExp('^'+escaped.join('[\\s\\p{P}]*')+'(?:[\\s\\p{P}]+|$)','iu');
 return item.name.replace(prefix,'')||item.name;
}
