import type {MenuService} from './model';

// Presentation only. Callers must actually show the context they declare.
// Original names, IDs, selection, search and prices are never rewritten.
export function displayName(s:MenuService,context:{brandShown?:boolean;familyShown?:boolean}={}){
 let label=s.name;
 const prefix=(value:string)=>label.toLowerCase().startsWith(value.toLowerCase()+' ');
 if(context.brandShown&&s.brand&&s.brand!=='Standard'&&prefix(s.brand))label=label.slice(s.brand.length+1);
 if(context.familyShown){
  const family=s.customerMenu.family;
  const suffix=' - '+family;
  if(label.toLowerCase().endsWith(suffix.toLowerCase()))label=label.slice(0,-suffix.length);
  if(prefix(family))label=label.slice(family.length+1);
 }
 return label.trim()||s.name;
}
export function serviceCaption(s:MenuService){
 return s.customerMenu.family+(s.brand&&s.brand!=='Standard'?' · '+s.brand:'');
}
