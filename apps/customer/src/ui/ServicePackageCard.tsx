import{SceneCard}from "./SceneCard";
import {Pressable,View} from 'react-native';
import type {Service} from '@autodeck/core';
import {ServicePhoto} from './ServicePhoto';
import {T} from './kit';
/** Published package facts only. The caller supplies its actual price and action. */
export function ServicePackageCard({service,price,onPress}:{service:Service;price:string|null|undefined;onPress:()=>void}){
 return <SceneCard label={`View ${service.name}`} onPress={onPress} style={{width:'100%',maxWidth:'100%',minWidth:0,flexShrink:1,borderRadius:24,borderWidth:1,borderColor:'rgba(128,128,128,0.22)',overflow:'hidden'}}><View style={{width:'100%',minWidth:0,flexDirection:'row',padding:16,gap:14}}><View style={{width:88,height:108,borderRadius:16,overflow:'hidden'}}><ServicePhoto service={service} height={108} width={88}/></View><View style={{flex:1,flexBasis:0,minWidth:0,gap:6}}>{service.brand?<T role="caption" tone="secondary">{service.brand}</T>:null}<T role="bodyStrong">{service.name}</T>{service.description?.trim()?<T role="caption" tone="secondary" numberOfLines={2}>{service.description.trim()}</T>:null}{price?<T role="bodyStrong" tone="accent">{price}</T>:null}<T role="caption">View service</T></View></View></SceneCard>
}
