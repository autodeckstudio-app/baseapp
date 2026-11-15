import type{Service}from'@autodeck/core';
/** Navigation by need, never a claim that steps must be bundled or bought in order. */
export const CARE_NEEDS=[{key:'clean',title:'Clean my car',detail:'Washes, interior cleaning and detailing'},{key:'restore',title:'Restore the finish',detail:'Headlights and trim; ask about paint correction'},{key:'protect',title:'Protect a surface',detail:'Paint, glass, wheels, leather or fabric'},{key:'maintain',title:'Care for existing protection',detail:'Maintenance coating for existing protection'}]as const;
export type CareNeed=typeof CARE_NEEDS[number]['key'];
export function careNeedOf(s:Pick<Service,'id'|'category'|'name'>):CareNeed[]{
 const id=s.id;
 if(id==='svc-coating-maintenance')return['maintain'];
 if(id==='svc-wash-headlight-buffing'||id==='menu-coat-trim')return['restore'];
 if(s.category==='washing')return['clean'];
 if(s.category==='ceramic'||s.category==='coating')return['protect'];
 return[];
}
export function servicesForCareNeed(xs:Service[],need:CareNeed){return xs.filter(x=>careNeedOf(x).includes(need)).sort((a,b)=>(a.displayOrder??0)-(b.displayOrder??0)||a.name.localeCompare(b.name));}

/** Entry prices without a selected car are not a booking quote. Never decorate missing/quote values. */
export function careEntryPrice(label:string|null|undefined,hasCarPriceScope:boolean):string|null{if(!label)return null;if(hasCarPriceScope||!/^₹/.test(label))return label;return `From ${label}`;}
