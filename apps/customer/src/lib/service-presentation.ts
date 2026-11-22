import rows from './service-presentation.json';
type Source={id?:string;name?:string;description?:string|null};
export function reviewedPresentation(s:Source){
 const row=rows.find(r=>r.id===s.id);
 // New catalogue wording must not silently inherit an older reviewed promise.
 return row && (s.description??'').trim()===row.source_description.trim() ? row : undefined;
}
export const isScopeLimit=(line:string)=>/\b(?:no|not|does not|do not|only for|requires|separate|excluded|excludes|subject to|if approved)\b/i.test(line);
export function presentationScope(s:Source){
 const row=reviewedPresentation(s);
 if(row)return {included:row.offer_points,limits:row.scope_notes,summary:row.short_description};
 const lines=(s.description??'').split(/\n+/).map(x=>x.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean);
 // Mixed inclusion/limit lines remain exact, but live under Details.
 const included=lines.filter(x=>!isScopeLimit(x)),limits=lines.filter(isScopeLimit);
 return {included,limits,summary:included[0]??''};
}
export const presentationTitle=(s:Source)=>reviewedPresentation(s)?.proposed_title??s.name??'';
export const presentationSummary=(s:Source)=>presentationScope(s).summary;
