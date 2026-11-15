import {useEffect,useRef,useState} from 'react';
import {Image,View} from 'react-native';
import {isMissingPrivatePhoto,readPrivatePhoto} from '../lib/private-photo-service';
import {Button,Loading,T} from './kit';
export type SavedLicenseState={url:string|null;state:'loading'|'ready'|'missing'|'error';retry:()=>void};
/** Loads only existence + a signed URL; the photo itself renders solely when the owner opens it.
 *  Never publishes private files or retains a previous account's image. */
let savedLicensePreview:SavedLicenseState|null=null;
/** Dev-preview override for /preview-licence. Never set in production builds. */
export function __setSavedLicensePreview(s:SavedLicenseState|null){if((globalThis as {__DEV__?:boolean}).__DEV__!==true)return;savedLicensePreview=s}
export function useSavedLicensePhoto(customerId:string|null,scope:string,refresh:number):SavedLicenseState{
 const [result,setResult]=useState<{key:string;url:string|null;state:'loading'|'ready'|'missing'|'error'}|null>(null),[retry,setRetry]=useState(0);
 const key=JSON.stringify([scope,customerId,refresh,retry]);
 useEffect(()=>{
  if(savedLicensePreview)return;
  if(!customerId){setResult(null);return;}
  let alive=true;setResult(null);
  void readPrivatePhoto('license',customerId).then(url=>{if(alive)setResult({key,url,state:'ready'})}).catch(error=>{if(alive)setResult({key,url:null,state:isMissingPrivatePhoto(error)?'missing':'error'})});
  return()=>{alive=false};
 },[key,customerId]);
 useEffect(()=>{if(savedLicensePreview||result?.key!==key||result.state!=='ready')return;const timer=setTimeout(()=>setRetry(n=>n+1),9*60*1000);return()=>clearTimeout(timer)},[result,key]);
 if(savedLicensePreview)return savedLicensePreview;
 if(!customerId||result?.key!==key)return{url:null,state:'loading',retry:()=>setRetry(n=>n+1)};
 return{url:result.url,state:result.state,retry:()=>setRetry(n=>n+1)};
}
export function SavedLicensePhoto({customerId,scope,refresh}:{customerId:string;scope:string;refresh:number}){
 const r=useSavedLicensePhoto(customerId,scope,refresh);
 return <SavedLicensePhotoView r={r}/>;
}
/** Renders an already-loaded saved-licence state, so a parent that needs the state too (LicenceSection) subscribes once. */
export function SavedLicensePhotoView({r}:{r:SavedLicenseState}){
 const [imgErr,setImgErr]=useState(false);
 useEffect(()=>{setImgErr(false)},[r.url]);
 if(r.state==='loading')return <Loading label="Opening saved licence"/>;
 if(r.state==='missing')return <T role="caption" tone="secondary">No saved licence photo is available to open.</T>;
 if(r.state==='error'||imgErr)return <View style={{gap:8}}><T role="caption" tone="secondary">The saved licence photo could not be shown. This does not mean it was deleted.</T><Button icon="refresh" label="Retry saved photo" onPress={()=>{setImgErr(false);r.retry();}}/></View>;
 return <View style={{gap:8}}><Image accessibilityLabel="Saved driving licence" source={{uri:r.url!}} resizeMode="contain" onError={()=>setImgErr(true)} style={{width:'100%',height:200,borderRadius:16}}/><T role="caption" tone="secondary">Saved licence photo</T></View>;
}
