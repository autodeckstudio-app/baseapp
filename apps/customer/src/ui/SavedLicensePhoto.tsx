import {useEffect,useRef,useState} from 'react';
import {Image,View} from 'react-native';
import {isMissingPrivatePhoto,readPrivatePhoto} from '../lib/private-photo-service';
import {Button,Loading,T} from './kit';
/** Never publishes private files or retains a previous account's image. */
export function SavedLicensePhoto({customerId,scope,refresh}:{customerId:string;scope:string;refresh:number}){
 const [result,setResult]=useState<{key:string;url:string|null;state:'ready'|'missing'|'error'}|null>(null),[retry,setRetry]=useState(0);
 const key=JSON.stringify([scope,customerId,refresh,retry]);const live=useRef(key);live.current=key;
 useEffect(()=>{let alive=true;void readPrivatePhoto('license',customerId).then(url=>{if(alive)setResult({key,url,state:'ready'})}).catch(error=>{if(alive)setResult({key,url:null,state:isMissingPrivatePhoto(error)?'missing':'error'})});return()=>{alive=false}},[key,customerId]);
 useEffect(()=>{if(result?.key!==key||result.state!=='ready')return;const timer=setTimeout(()=>setRetry(n=>n+1),9*60*1000);return()=>clearTimeout(timer)},[result,key]);
 if(result?.key!==key)return <Loading label="Opening saved licence"/>;
 if(result.state==='missing')return <T role="caption" tone="secondary">No saved licence photo is available to open.</T>;
 if(result.state==='error')return <View style={{gap:8}}><T role="caption" tone="secondary">The saved licence photo could not be shown. This does not mean it was deleted.</T><Button label="Retry saved photo" onPress={()=>setRetry(n=>n+1)}/></View>;
 return <View style={{gap:8}}><Image accessibilityLabel="Saved driving licence" source={{uri:result.url!}} resizeMode="contain" onError={()=>{if(live.current===key)setResult({key,url:null,state:'error'})}} style={{width:'100%',height:200,borderRadius:16}}/><T role="caption" tone="secondary">Saved licence photo</T></View>;
}
