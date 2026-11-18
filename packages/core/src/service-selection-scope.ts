import type{Service}from'./types/service';
// Exact reviewed catalogue IDs: one option within each treatment, multiple treatments allowed.
const TREATMENT_CHOICES:Record<string,readonly string[]>={"Glass": ["menu-coat-glass", "svc-brand-kovalent-glass", "svc_ef4a584172be60f4e2a3a69fbc8b21ab"], "Fabric": ["menu-coat-fabric", "svc-brand-kovalent-fabric"], "Leather": ["menu-coat-leather", "svc_1bb3798064cbe66eb1cbc3ca0c0f5ab3"], "Trim": ["menu-coat-trim", "svc_31024f8c6f3177c1cdeda5cb70f07e0a"], "Wheels": ["menu-coat-wheels", "svc_c2f74071fe48615845d9b26f6be63d22"]};
/** Reviewed selection rule: choose at most one ceramic option and at most one
 * PPF option. This does not prohibit combining ceramic with PPF.
 * Read actual categories rather than legacy menu-ID prefixes. No repricing or substitution. */
export function selectionScopeIssue(services:readonly (Pick<Service,'name'|'category'|'customerMenu'|'description'>&{id?:string})[]):string|null{
 for(const category of['ceramic','ppf']as const){const matches=services.filter(s=>s.category===category);if(matches.length>1)return `${matches[0]!.name} and ${matches[1]!.name} are alternative ${category==='ppf'?'paint protection films':'ceramic coatings'}. Choose one for this booking.`;}
 // Meet's 18 Nov treatment decision applies to these five groups only.
 for(const [label,ids] of Object.entries(TREATMENT_CHOICES)){
  const matches=services.filter(s=>s.id!==undefined&&ids.includes(s.id));
  if(matches.length>1)return `${matches[0]!.name} and ${matches[1]!.name} are choices for ${label.toLowerCase()}. Choose one option for this treatment. You can add other services.`;
 }
 // The final washing scopes explicitly share wash/vacuum work. Do not silently
 // charge two full packages or guess an incremental price for the unique steps.
 const washes=services.filter(s=>s.category==='washing');
 for(let i=0;i<washes.length;i++)for(let j=i+1;j<washes.length;j++){
  const a=washes[i]!,b=washes[j]!;
  const vacuum=(s:typeof a)=>/\bvacuum\b|interior deep clean/i.test(s.description);
  if(vacuum(a)&&vacuum(b))return `${a.name} and ${b.name} both include interior cleaning work. Choose one package or ask the studio to agree the combined scope before booking.`;
 }
 return null;
}
