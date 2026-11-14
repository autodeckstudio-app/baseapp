import React,{useState}from'react';
import{View,Pressable}from'react-native';
import{Icon,useExperienceTheme}from'@autodeck/ui/native';
import{Pane,Row,T,Field,Button}from'./kit';
export function VisitFeedback({stars,note,rated,busy,error,onStars,onNote,onSend}:{stars:number;note:string;rated:boolean;busy:boolean;error:string|null;onStars:(n:number)=>void;onNote:(s:string)=>void;onSend:()=>void}){
 const[open,setOpen]=useState(false);const{colors}=useExperienceTheme();
 return <Pane pad="gap"><Row title={rated?'Your feedback':'Rate this visit'} detail={rated?`${stars} of 5 · Saved`:'Optional · Share how it went'} expanded={open} onPress={()=>setOpen(v=>!v)} last={!open}/>{open?<View style={{gap:12,paddingTop:12}}>
  <T role="caption" tone="secondary">{rated?'Thanks for rating':'How was your visit?'}</T><View style={{flexDirection:'row',gap:12}}>{[1,2,3,4,5].map(n=><Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} star${n>1?'s':''}`} disabled={busy} onPress={()=>onStars(n)}><Icon name="star" color={n<=stars?colors.accent:colors.textTertiary} size={28} filled={n<=stars}/></Pressable>)}</View>
  {stars>0&&!rated?<><Field label="Anything to add? (optional)" value={note} onChangeText={onNote} maxLength={500} placeholder="What went well, or what could be better"/>{error?<T role="caption" tone="accent">{error}</T>:null}<Button label="Send rating" busy={busy} onPress={onSend}/></>:null}
 </View>:null}</Pane>;
}
