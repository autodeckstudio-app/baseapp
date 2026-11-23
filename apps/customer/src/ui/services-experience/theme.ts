import {glacierGround} from '../../lib/customer-glacier';
import {raised} from '../../lib/raised';
import {serviceActionSurface} from '../../lib/service-action-surface';
import {themeColors,material} from '@autodeck/ui/theme';

export function serviceThemeCSS(previewMode:'light'|'night'){ 
const c=themeColors[previewMode],r=raised(previewMode),control=material(previewMode,'control'),sheet=material(previewMode,'sheet'),field=material(previewMode,'field'),action=serviceActionSurface(previewMode);
const vars:Record<string,string|number>={bg:c.canvas,panel:c.surface,raised:c.surfaceElevated,ink:c.textPrimary,muted:c.textSecondary,line:c.borderSubtle,accent:previewMode==='light'?c.accentStrong:c.accent,'action-ink':c.textPrimary,soft:c.accentHaze,ground:glacierGround(previewMode!=='light'),'card-shadow':String((r.card as {boxShadow?:string}).boxShadow||'none'),'well-shadow':String((r.well as {boxShadow?:string}).boxShadow||'none'),'control-fill':control.fill,'control-image':control.web.backgroundImage,'control-shadow':control.web.boxShadow,'control-edge':control.edge,'sheet-fill':sheet.fill,'sheet-image':sheet.web.backgroundImage,'sheet-shadow':sheet.web.boxShadow,'sheet-edge':sheet.edge,'field-fill':field.fill,'selected-border':c.accentStrong,'card-radius':String(r.card.borderRadius)+'px','well-radius':String(r.well.borderRadius)+'px','action-radius':String(action.borderRadius)+'px'};
return '.services-experience{'+Object.entries(vars).map(([k,v])=>'--'+k+':'+v).join(';')+';--body:Inter,system-ui,sans-serif;--display:Inter,system-ui,sans-serif;color-scheme:'+ (previewMode==='light'?'light':'dark')+'}';
}
