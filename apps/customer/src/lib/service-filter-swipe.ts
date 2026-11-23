import type {ServicesPath} from './services-navigation';
/** Only the visible filter strip belongs to this gesture. Never cross service areas. */
export function serviceFilterSwipe(path:ServicesPath,families:readonly string[],groupFilter:string,blocked:boolean){
 const enabled=!!path.home&&path.home!=='paint'&&!blocked;
 const keys=path.home==='garage'?['All','Regular care','Repairs & replacements','Wheels & tyres','Checks & diagnosis']:['All',...families];
 const current=path.home==='garage'?groupFilter:path.family??'All';
 return {enabled,keys,current};
}
