// One material recipe for all apps. CSS blur is an approximation, not Apple's
// system Liquid Glass. Opaque fallback remains legible without blur support.
export type MaterialMode='light'|'night'|'dark';
export type MaterialRole='surface'|'control'|'field'|'sheet'|'navigation';
export function material(mode:MaterialMode,role:MaterialRole='surface',state:{pressed?:boolean;disabled?:boolean;selected?:boolean;reduce?:boolean}={}){
 const dark=mode!=='light',fallback=dark?'#252C35':'#FAFBFE';
 const alpha=role==='sheet'?.82:role==='field'?.30:role==='navigation'?.42:role==='control'?.18:.36;
 const fill=state.reduce?fallback:dark?`rgba(28,36,46,${state.pressed?.70:.52})`:`rgba(255,255,255,${state.pressed?.66:alpha})`;
 const edge=state.selected?'rgba(194,84,10,.62)':dark?'rgba(255,255,255,.24)':'rgba(255,255,255,.86)';
 return{fill,fallback,edge,ink:dark?'#FAF8F5':'#1D1B26',muted:dark?'#E1E2DD':'#4A4655',web:{backgroundColor:fill,backgroundImage:state.reduce?'none':dark?'linear-gradient(145deg,rgba(255,255,255,.12),rgba(255,255,255,.025) 42%,rgba(255,255,255,.055))':'linear-gradient(145deg,rgba(255,255,255,.38),rgba(255,255,255,.015) 45%,rgba(255,255,255,.16))',backdropFilter:state.reduce?'none':'blur(22px) saturate(150%)',WebkitBackdropFilter:state.reduce?'none':'blur(22px) saturate(150%)',borderWidth:1,borderColor:edge,boxShadow:state.disabled?'inset 0 1px 0 rgba(255,255,255,.45)':dark?'inset 0 1px 0 rgba(255,255,255,.24), inset 0 -1px 0 rgba(255,255,255,.05), 0 5px 14px rgba(0,0,0,.18)':'inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(125,140,160,.10), 0 5px 14px rgba(44,58,80,.08)',color:dark?'#FAF8F5':'#1D1B26'}};
}
/** Native-web/admin share material values, not copied hand-tuned fills. */
export function materialVariables(mode:MaterialMode):Record<string,string>{const out:Record<string,string>={};for(const role of['surface','control','field','sheet','navigation']as const){const m=material(mode,role);for(const[k,v]of Object.entries({fill:m.fill,fallback:m.fallback,edge:m.edge,image:m.web.backgroundImage,shadow:m.web.boxShadow}))out[`--ad-material-${role}-${k}`]=v}return out}
/** Safe web fallback; no browser globals are required during server rendering. */
export function reduceWebTransparency():boolean{const g=globalThis as unknown as{CSS?:{supports:(q:string)=>boolean};matchMedia?:(q:string)=>{matches:boolean}};return!!g.matchMedia?.('(prefers-reduced-transparency: reduce)').matches||!g.CSS||!(g.CSS.supports('backdrop-filter: blur(1px)')||g.CSS.supports('-webkit-backdrop-filter: blur(1px)'))}

export const materialNightGround="radial-gradient(ellipse at 8% 2%, rgba(160,180,210,.13), transparent 48%), radial-gradient(ellipse at 100% 52%, rgba(180,150,125,.055), transparent 54%), linear-gradient(155deg, #262A30 0%, #1B2027 48%, #12171D 100%)";
