import {useCallback,useEffect,useRef,useState}from'react';
import{Modal,View,Text}from'react-native';
import{Button,colors,spacing,typography}from'@autodeck/ui';
/** Shared explicit decision, never a silent attendance transition. Unmount/cancel means no. */
export function useBreakCheckoutConfirmation(scopeKey?:string|null){
 const[open,setOpen]=useState(false),pending=useRef<((answer:boolean)=>void)|null>(null);
 useEffect(()=>{setOpen(false);pending.current?.(false);pending.current=null;return()=>{pending.current?.(false);pending.current=null}},[scopeKey]);
 const confirm=useCallback(()=>{if(pending.current)return Promise.resolve(false);setOpen(true);return new Promise<boolean>(resolve=>{pending.current=resolve})},[]);
 const answer=(yes:boolean)=>{const resolve=pending.current;pending.current=null;setOpen(false);resolve?.(yes)};
 const dialog=<Modal visible={open} transparent animationType="fade" onRequestClose={()=>answer(false)}><View style={{flex:1,backgroundColor:'rgba(0,0,0,0.52)',justifyContent:'center',alignItems:'center',padding:spacing.lg}}><View accessibilityViewIsModal style={{width:'100%',maxWidth:420,borderRadius:28,padding:spacing.lg,backgroundColor:colors.surfaceElevated,gap:spacing.md}}><Text accessibilityRole="header" style={{...typography.title,color:colors.textPrimary}}>End break & check out?</Text><Text style={{...typography.body,color:colors.textMuted}}>Break ends: now</Text><Text style={{...typography.body,color:colors.textMuted}}>Hours: exclude this break</Text><Button label="End break & check out" size="md" onPress={()=>answer(true)}/><Button label="Stay checked in" size="md" variant="secondary" onPress={()=>answer(false)}/></View></View></Modal>;
 return{confirm,dialog};
}
