import { createElement, useEffect, useId, useState } from 'react';
import { Image, Platform, Pressable, TextInput, View } from 'react-native';
import { pickImagesFromLibrary, type PickedUpload } from '../lib/native-image-pick';
import { space } from '@autodeck/ui/theme';
import { T } from './kit';
import { NavIcon } from './NavIcon';
import { useExperienceTheme } from '@autodeck/ui/native';

export type UploadFile = { blob: Blob; type: string };
const css = `autodeck-uploader input:focus-visible + span {outline:2px solid #EC8638;outline-offset:4px} .autodeck-control:focus-visible {outline:2px solid #EC8638;outline-offset:3px}`;
export const optionStyleFor = (day: boolean) => ({ background: day ? '#FFFFFF' : '#1D1B26', color: day ? '#1D1B26' : '#F6F4F1' });
const controlFor = (day: boolean) => ({width:'100%',minWidth:0,minHeight:48,boxSizing:'border-box' as const,padding:'12px 44px 12px 16px',borderRadius:16,border:day?'1px solid rgba(29,27,38,0.16)':'1px solid rgba(255,255,255,0.28)',background:day?'rgba(29,27,38,0.05)':'rgba(255,255,255,0.08)',color:day?'#1D1B26':'#F6F4F1',fontSize:15,fontFamily:'Archivo,system-ui,sans-serif',colorScheme:day?'light':'dark',appearance:'none' as const});
export function SelectField({label,value,onChange,options,placeholder}:{label:string;value:string;onChange:(v:string)=>void;options:Array<{value:string;label:string}>;placeholder?:string}) {
 const day=useExperienceTheme().name==='light';const control=controlFor(day);const optStyle=optionStyleFor(day);
 if(Platform.OS!=='web')return <View><T role="bodyStrong">＋  {label}</T>{options.map(o=><Pressable key={o.value} accessibilityRole="button" accessibilityState={{selected:value===o.value}} onPress={()=>onChange(o.value)} style={{paddingVertical:12}}><T tone={value===o.value?"accent":"secondary"}>{o.label}</T></Pressable>)}</View>;
 return createElement('div',{style:{position:'relative',width:'100%',minWidth:0}},createElement('style',null,css),createElement('select',{'aria-label':label,className:'autodeck-control',value,onChange:(e:{target:{value:string}})=>onChange(e.target.value),style:control},placeholder?createElement('option',{value:'',disabled:true,style:optStyle},placeholder):null,...options.map(o=>createElement('option',{key:o.value,value:o.value,style:optStyle},o.label))),createElement('span',{'aria-hidden':true,style:{position:'absolute',right:16,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'#b7b4b0',fontSize:18}},'⌄'));
}
export function DateField({label,value,onChange,min,max,error,disabled}:{label:string;value:string;onChange:(v:string)=>void;min?:string|undefined;max?:string|undefined;error?:string|undefined;disabled?:boolean|undefined}) {
 const day=useExperienceTheme().name==='light';const control=controlFor(day);
 return <View style={{gap:space.breath}}><T role="label" tone="tertiary">{label}</T>{Platform.OS==='web'?createElement('input',{'aria-label':label,type:'date',value,min,max,disabled:disabled??false,'aria-disabled':disabled?true:undefined,className:'autodeck-control',style:{...control,appearance:'auto',paddingRight:16},onChange:(e:{target:{value:string}})=>{if(!disabled)onChange(e.target.value);}}):<NativeDateInput label={label} value={value} onChange={onChange} min={min} max={max} disabled={disabled} day={day}/>}{error?<T role="caption" tone="danger">{error}</T>:null}</View>;
}
function NativeDateInput({label,value,onChange,min,max,disabled,day}:{label:string;value:string;onChange:(v:string)=>void;min:string|undefined;max:string|undefined;disabled:boolean|undefined;day:boolean}) {
 const [draft,setDraft]=useState(value);const [issue,setIssue]=useState('');
 useEffect(()=>{setDraft(value);setIssue('');},[value]);
 function commit(){
  if(disabled)return;
  if(!draft){setIssue('');onChange('');return;}
  const parts=/^(\d{4})-(\d{2})-(\d{2})$/.exec(draft);
  const date=parts?new Date(`${draft}T12:00:00Z`):null;
  if(!date||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==draft){setIssue('Enter a valid date as YYYY-MM-DD.');return;}
  if((min&&draft<min)||(max&&draft>max)){setIssue(`Choose a date${min?` from ${min}`:''}${max?` through ${max}`:''}.`);return;}
  setIssue('');onChange(draft);
 }
 return <View style={{gap:8}}><TextInput accessibilityLabel={label} value={draft} editable={!disabled} placeholder="YYYY-MM-DD" placeholderTextColor={day?'#77737D':'#99959F'} maxLength={10} autoCapitalize="none" keyboardType="numbers-and-punctuation" onChangeText={v=>{if(!disabled){setDraft(v);setIssue('');onChange(v);}}} onBlur={commit} onSubmitEditing={commit} style={{minHeight:48,padding:14,borderRadius:16,borderWidth:1,borderColor:day?'#BDB9C2':'#68646E',color:day?'#1D1B26':'#F6F4F1'}}/><T role="caption" tone="tertiary">Year-month-day (YYYY-MM-DD)</T>{issue?<T role="caption" tone="danger">{issue}</T>:null}</View>;
}
export function FileUploader({files,onChange,accept='image/jpeg,image/png,image/webp',multiple=false,maxFiles=1,label='Add image',compact=false,iconOnly=false,nativeEnabled=false,nativeFileCount,onNativeChange}:{files:UploadFile[];onChange:(files:UploadFile[])=>void;accept?:string;multiple?:boolean;maxFiles?:number;label?:string;compact?:boolean;iconOnly?:boolean;nativeEnabled?:boolean;nativeFileCount?:number;onNativeChange?:(files:PickedUpload[])=>void}) {
 const day=useExperienceTheme().name==='light';const id=useId();const [previews,setPreviews]=useState<string[]>([]); const [error,setError]=useState('');const [confirmIdx,setConfirmIdx]=useState<number|null>(null);
 useEffect(()=>{if(Platform.OS!=='web')return;const urls=files.map(f=>f.type.startsWith('image/')?URL.createObjectURL(f.blob):'');setPreviews(urls);return ()=>urls.forEach(u=>{if(u)URL.revokeObjectURL(u);});},[files]);
 if(Platform.OS!=='web')return nativeEnabled&&onNativeChange?<NativeFileUploader fileCount={nativeFileCount ?? files.length} onNativeChange={onNativeChange} accept={accept} multiple={multiple} maxFiles={maxFiles} label={label} compact={compact} iconOnly={iconOnly}/>:null;
 function select(list:ArrayLike<File>|null){const picked=Array.from(list??[]);const allowed=accept.split(',');if(picked.length>maxFiles){setError(`Add up to ${maxFiles} images.`);return;}if(picked.some(f=>!allowed.includes(f.type))){setError('Choose a supported file type.');return;}setError('');onChange(picked.map(f=>({blob:f,type:f.type})));}
 const input=createElement('input',{id,type:'file',accept,multiple,'aria-label':label,style:{position:'absolute',opacity:0,width:'100%',height:'100%',inset:0,cursor:'pointer'},onChange:(e:{target:{files:ArrayLike<File>|null}})=>select(e.target.files)});
 const trigger=createElement('label',{htmlFor:id,style:{display:'inline-block',position:'relative',cursor:'pointer',maxWidth:'100%'}},input,createElement('span',{style:{display:'inline-flex',alignItems:'center',gap:10,minHeight:48,width:iconOnly?48:undefined,justifyContent:'center',padding:iconOnly?0:'8px 15px',boxSizing:'border-box',border:day?'1px solid rgba(29,27,38,.18)':'1px solid rgba(255,255,255,.24)',borderRadius:24,background:day?'linear-gradient(145deg,rgba(255,255,255,.96),rgba(255,255,255,.68))':'linear-gradient(145deg,rgba(255,255,255,.12),rgba(255,255,255,.04))',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',boxShadow:day?'0 2px 8px rgba(16,16,20,.05), inset 0 1px 0 #fff':'inset 0 1px 0 rgba(255,255,255,.12)',color:day?'#24242C':'#F4F1EC',fontFamily:'Inter,system-ui,sans-serif',fontSize:14,fontWeight:600}},createElement('svg',{'aria-hidden':true,width:20,height:20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,style:{flexShrink:0}},createElement('rect',{x:3,y:3,width:18,height:18,rx:4}),createElement('circle',{cx:8,cy:8,r:1.5}),createElement('path',{d:'M4 17l5-5 4 4 3-3 5 5'})),iconOnly?null:createElement('span',null,label)));
 const hint=createElement('span',{style:{display:'block',fontSize:12,lineHeight:'18px',fontFamily:'Inter,system-ui,sans-serif',color:day?'#56525C':'#BBB7C2',marginTop:6}},multiple?`Up to ${maxFiles} images. First image is the cover.`:'Choose an image or scan.');
 const badge={position:'absolute' as const,top:8,width:44,height:44,borderRadius:22,border:'none',background:'rgba(16,16,20,0.78)',color:'#F6F4F1',fontSize:15,lineHeight:'44px',textAlign:'center' as const,cursor:'pointer',padding:0,display:'block'};
 const grid=files.length?createElement('div',{style:{display:'grid',gridTemplateColumns:multiple?'repeat(3,minmax(0,1fr))':'minmax(0,1fr)',gap:10,marginTop:14}},...files.map((f,i)=>createElement('div',{key:i,style:{minWidth:0}},previews[i]?createElement('div',{style:{position:'relative'}},createElement('img',{src:previews[i],alt:multiple?`Selected image ${i+1}`:'Selected image',style:{width:'100%',height:multiple?95:180,objectFit:'cover',borderRadius:12,display:'block'}}),createElement('button',{type:'button','aria-label':multiple?`Remove image ${i+1}`:'Remove image',onClick:()=>setConfirmIdx(i),style:{...badge,right:8}},'\u{1F5D1}\uFE0E'),multiple?null:createElement('label',{htmlFor:id,'aria-label':'Replace image',style:{...badge,right:56}},'\u270E')):null,createElement('span',{style:{display:'block',color:(day?'#4A4756':'#cbc7c1'),fontSize:12,overflowWrap:'anywhere',marginTop:6}},multiple&&i===0?'Cover':(f.blob as File).name??`Image ${i+1}`),confirmIdx===i?createElement('div',{role:'alertdialog','aria-label':'Remove this image?',style:{marginTop:8,padding:12,borderRadius:12,background:day?'rgba(29,27,38,0.06)':'rgba(255,255,255,0.08)',color:day?'#1D1B26':'#F6F4F1',fontSize:13}},createElement('div',{style:{marginBottom:8,fontWeight:600}},'Remove this image?'),createElement('button',{type:'button',onClick:()=>{setError('');setConfirmIdx(null);onChange(files.filter((_,j)=>j!==i));},style:{marginRight:8,padding:'6px 12px',borderRadius:9999,border:'none',cursor:'pointer',background:day?'#1D1B26':'#F6F4F1',color:day?'#F6F4F1':'#16181C'}},'Remove'),createElement('button',{type:'button',onClick:()=>setConfirmIdx(null),style:{padding:'6px 12px',borderRadius:9999,border:'none',cursor:'pointer',background:'transparent',color:'inherit',textDecoration:'underline'}},'Keep it')):null))):null;
 return createElement('div',{style:{width:iconOnly?48:'100%',flexShrink:0}},createElement('style',null,css),createElement('autodeck-uploader',null,trigger),iconOnly?null:hint,iconOnly?null:grid,error?createElement('p',{role:'alert',style:{color:'#FF8D8D',fontSize:13}},error):null);
}

/** Native photo-library pick: real bytes via expo-image-picker, type sniffed from the bytes themselves. */
function NativeFileUploader({fileCount,onNativeChange,accept,multiple,maxFiles,label,compact=false,iconOnly=false}:{fileCount:number;onNativeChange:(files:PickedUpload[])=>void;accept:string;multiple:boolean;maxFiles:number;label:string;compact?:boolean;iconOnly?:boolean}) {
 const day=useExperienceTheme().name==='light';
 const [picked,setPicked]=useState<PickedUpload[]>([]);
 const [error,setError]=useState('');
 useEffect(()=>{if(fileCount===0)setPicked([]);},[fileCount]);
 async function pick(){
  try{
   const res=await pickImagesFromLibrary({multiple,maxFiles,accept});
   if(!res)return;
   setPicked(res);setError('');onNativeChange(res);
  }catch(e){setError(e instanceof Error?e.message:'The photo could not be read. Try a different image.');}
 }
 return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={()=>void pick()} style={{width:iconOnly?48:undefined,borderWidth:1,borderColor:day?'rgba(29,27,38,.18)':'rgba(255,255,255,.24)',backgroundColor:day?'rgba(255,255,255,.86)':'rgba(255,255,255,.08)',borderRadius:24,paddingHorizontal:iconOnly?0:15,paddingVertical:8,minHeight:48,justifyContent:'center',alignItems:iconOnly?'center':undefined,alignSelf:'flex-start',gap:8}}>
  {iconOnly?<NavIcon name="edit" cut={day?'#FFFFFF':'#252C35'} color={day?'#1D1B26':'#F6F4F1'} size={20}/>:<T role="bodyStrong">＋  {label}{multiple?` (up to ${maxFiles})`:''}</T>}
  {!iconOnly&&picked.length>0?<View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{picked.map((p,i)=><Image key={i} source={{uri:p.previewUri}} style={{width:64,height:64,borderRadius:10}} accessibilityLabel={`Picked photo ${i+1}`}/>)}</View>:null}
  {error?<T role="caption" tone="danger">{error}</T>:null}
 </Pressable>;
}
