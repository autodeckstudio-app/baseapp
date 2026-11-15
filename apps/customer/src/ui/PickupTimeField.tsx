import {createElement,useEffect,useId,useRef,useState} from 'react';
import {Platform} from 'react-native';
import {useExperienceTheme} from '@autodeck/ui/native';
import {SelectField} from './inputs';
type FocusTarget={focus:()=>void};
type PickerRoot={contains:(target:unknown)=>boolean;querySelectorAll:(selector:string)=>ArrayLike<FocusTarget>;querySelector:(selector:string)=>FocusTarget|null};
/** Web-only preference picker: focus is outlined, only a chosen value is marked. */
export function PickupTimeField({label,value,onChange,options,context}:{label:string;value:string;onChange:(value:string)=>void;options:Array<{value:string;label:string}>;context:string}){
 const [open,setOpen]=useState(false);const id=useId();const root=useRef<PickerRoot>(null);const day=useExperienceTheme().name==='light';
 useEffect(()=>setOpen(false),[context]);
 useEffect(()=>{if(!open||Platform.OS!=='web')return;const outside=(e:{target:unknown})=>{if(!root.current?.contains(e.target))setOpen(false)};const doc=(globalThis as unknown as {document:{addEventListener:(event:string,fn:(e:{target:unknown})=>void)=>void;removeEventListener:(event:string,fn:(e:{target:unknown})=>void)=>void}}).document;doc.addEventListener('pointerdown',outside);return()=>doc.removeEventListener('pointerdown',outside)},[open]);
 if(Platform.OS!=='web')return <SelectField label={label} value={value} onChange={onChange} options={options}/>;
 const ink=day?'#1D1B26':'#F6F4F1',surface=day?'#FFFFFF':'#1D1B26',line=day?'#d1ced4':'#68646e';
 const button={fontFamily:'Archivo,system-ui,sans-serif',fontSize:15,minHeight:48,width:'100%',textAlign:'left' as const,color:ink,cursor:'pointer'};
 const focusItem=(n:number)=>root.current?.querySelectorAll('[role="radio"]')[n]?.focus();
 const choose=(v:string)=>{onChange(v);setOpen(false);root.current?.querySelector('[aria-expanded]')?.focus()};
 return createElement('div',{ref:root,style:{position:'relative',width:'100%',minWidth:0},onKeyDown:(e:React.KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);root.current?.querySelector('[aria-expanded]')?.focus()}}},
 createElement('style',null,'.pickup-time-control:focus-visible{outline:2px solid #EC8638;outline-offset:2px}'),
 createElement('button',{type:'button','aria-label':label,'aria-expanded':open,'aria-controls':id,className:'pickup-time-control',onClick:()=>setOpen(!open),onKeyDown:(e:React.KeyboardEvent)=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);requestAnimationFrame(()=>focusItem(Math.max(0,options.findIndex(o=>o.value===value)))) }},style:{...button,border:`1px solid ${line}`,borderRadius:16,padding:'12px 16px',background:day?'rgba(29,27,38,.05)':'rgba(255,255,255,.08)',display:'flex',justifyContent:'space-between',alignItems:'center'}},createElement('span',null,options.find(o=>o.value===value)?.label??'No preference'),createElement('span',{'aria-hidden':true},'⌄')),
 open?createElement('div',{id,role:'radiogroup','aria-label':label,style:{background:surface,border:`1px solid ${line}`,borderRadius:12,marginTop:6,padding:4,maxHeight:260,overflowY:'auto'}},...options.map((o,i)=>createElement('button',{type:'button',key:o.value,role:'radio','aria-checked':value===o.value,className:'pickup-time-control',onClick:()=>choose(o.value),onKeyDown:(e:React.KeyboardEvent)=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();focusItem((i+(e.key==='ArrowDown'?1:options.length-1))%options.length)}if(e.key==='Home'){e.preventDefault();focusItem(0)}if(e.key==='End'){e.preventDefault();focusItem(options.length-1)}},style:{...button,border:0,borderRadius:8,padding:'10px 12px',background:value===o.value?(day?'#f4e9df':'#3d3026'):'transparent',display:'flex',justifyContent:'space-between'}},o.label,createElement('span',{'aria-hidden':true},value===o.value?'✓':'')))):null);
}
