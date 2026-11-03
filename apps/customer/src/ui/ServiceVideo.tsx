import {useEffect,useState} from 'react';
import {AppState,View,useWindowDimensions} from 'react-native';
import {useVideoPlayer,VideoView} from 'expo-video';
import {safeVideoUrl} from '../lib/service-video-policy';
import {Button,Notice,T} from './kit';
export type ServiceVideoProps={uri:string;title:string;aspectRatio?:number};
/** Mounted only after a deliberate tap. The hook releases the native player on unmount. */
function NativePlayer({uri,title,aspectRatio=16/9,onClose}:ServiceVideoProps&{onClose:()=>void}){
 const [failed,setFailed]=useState(false);const [sourceAspect,setSourceAspect]=useState(aspectRatio);const {height,width}=useWindowDimensions();
 const player=useVideoPlayer(uri,p=>{p.muted=true;p.loop=false;});
 useEffect(()=>{const app=AppState.addEventListener('change',state=>{if(state!=='active')player.pause();});const source=player.addListener('sourceLoad',e=>{const size=e.availableVideoTracks[0]?.size;if(size?.width&&size.height)setSourceAspect(size.width/size.height);});const status=player.addListener('statusChange',e=>setFailed(e.status==='error'));return()=>{app.remove();status.remove();source.remove();player.pause();};},[player]);
 return <View style={{gap:12}}><T role="bodyStrong">{title}</T>{failed?<Notice title="Video couldn't load" body="Close the video and try again."/>:<VideoView accessibilityLabel={title} player={player} nativeControls contentFit="contain" allowsFullscreen allowsPictureInPicture={false} style={{width:'100%',height:Math.min((width-72)/sourceAspect,height*.6),backgroundColor:'#000'}}/>}<Button kind="quiet" label="Close video" onPress={onClose}/></View>;
}
export function ServiceVideo({uri,title,aspectRatio=16/9}:ServiceVideoProps){const [opened,setOpened]=useState(false);if(!safeVideoUrl(uri))return null;return opened?<NativePlayer uri={uri} title={title} aspectRatio={aspectRatio} onClose={()=>setOpened(false)}/>:<Button kind="quiet" label={`Watch: ${title}`} onPress={()=>setOpened(true)}/>;}
