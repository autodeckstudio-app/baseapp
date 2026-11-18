/** Selection is intent only. It never supplies money, slot duration or booking authority. */
export function bookingExtras(value:string|undefined):string[]|null{
 if(value===undefined||value==='')return[];
 const ids=value.split(',');
 if(ids.length>4||ids.some(id=>!/^[A-Za-z0-9_-]{1,120}$/.test(id))||new Set(ids).size!==ids.length)return null;
 return ids;
}
export type SelectionOwner={uid:string;tenantId:string;customerId:string};
export function selectionOwnerKey(owner:SelectionOwner|null):string|null{return owner?JSON.stringify([owner.uid,owner.tenantId,owner.customerId]):null;}
/** One in-memory owner only. An account change discards selection, never caches it for a later person. */
export function createServiceSelection(){let owner:string|null=null,ids:readonly string[]=[];const listeners=new Set<()=>void>();const emit=()=>listeners.forEach(f=>f());return{
 subscribe(f:()=>void){listeners.add(f);return()=>{listeners.delete(f)}},
 bind(next:string|null){if(next===owner)return;owner=next;ids=[];emit()},
 read(scope:string|null):readonly string[]{return scope&&scope===owner?ids:EMPTY},
 toggle(scope:string|null,id:string){if(!scope||scope!==owner||!/^[A-Za-z0-9_-]{1,120}$/.test(id))return false;if(ids.includes(id)){ids=ids.filter(v=>v!==id);emit();return true}if(ids.length>=5)return false;ids=[...ids,id];emit();return true},
 clear(scope:string|null){if(scope&&scope===owner){ids=[];emit()}},
 reconcile(scope:string|null,currentIds:ReadonlySet<string>){if(!scope||scope!==owner)return;const next=ids.filter(id=>currentIds.has(id));if(next.length!==ids.length){ids=next;emit()}}
}}
const EMPTY:readonly string[]=Object.freeze([]);
export const serviceSelection=createServiceSelection();
