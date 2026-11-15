import type { TopSvc } from './top-services';
import {parentPath,type ServicesPath} from './services-navigation';
export type HomeEntry='wash'|'coat'|'garage'|'inspect';
export const homeEntryPath=(entry:unknown):ServicesPath|null=>entry==='wash'?{home:'washing',family:'Exterior wash'}:entry==='coat'?{home:'paint',family:'Ceramic'}:entry==='garage'?{home:'garage'}:entry==='inspect'?{home:'garage',family:'Inspection'}:null;
/** A generic Home label opens choices, never the cheapest product used to show a starting price. */
export function homeServiceTarget(service:TopSvc,cardKey?:string){
 const entry=homeEntryPath(cardKey)?cardKey:service.category==='washing'?'wash':service.category==='ceramic'||(service.category==='coating'&&/ceramic/i.test(service.name))?'coat':null;
 return entry?{pathname:'/(tabs)/catalogue',params:{...homeEntryPath(entry),returnTo:'home',homeEntry:entry}}:{pathname:`/(tabs)/catalogue/${service.id}`,params:{returnTo:'home'}};
}
/** Deterministic app Back survives refresh. Only a fixed, app-owned Home origin is accepted. */
export function homeCatalogueBack(path:ServicesPath,entry:unknown):ServicesPath|null{
 const root=homeEntryPath(entry);if(!root||!path.home||(path.home===root.home&&path.family===root.family&&!path.brand&&!path.work))return null;
 if(path.home!==root.home||(root.family&&path.family!==root.family))return null;
 return parentPath(path);
}
export function catalogueReturnParams(path:ServicesPath,entry:unknown){return {returnTo:'home',...(homeEntryPath(entry)?{homeEntry:String(entry)}:{}),catalogueHome:path.home??'',catalogueFamily:path.family??'',catalogueBrand:path.brand??'',catalogueWork:path.work??''}}
export function detailHomeBack(params:Record<string,string|undefined>){
 if(params.returnTo!=='home')return null;
 const home=params.catalogueHome;
 return home?{pathname:'/(tabs)/catalogue',params:{returnTo:'home',homeEntry:params.homeEntry??'',home,family:params.catalogueFamily??'',brand:params.catalogueBrand??'',work:params.catalogueWork??''}}:{pathname:'/(tabs)',params:{}};
}
