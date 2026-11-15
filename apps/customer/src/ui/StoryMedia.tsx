import {safeVideoUrl} from '../lib/service-video-policy';
import {useEffect} from 'react';import {useVideoPlayer,VideoView} from 'expo-video';
export type StoryMediaProps={uri:string;paused:boolean;muted:boolean;onProgress:(fraction:number)=>void;onEnded:()=>void;onError:()=>void;onReady:()=>void;onBlocked:()=>void};
function NativeStoryMedia({uri,paused,muted,onProgress,onEnded,onError,onReady}:StoryMediaProps){
 const player=useVideoPlayer(uri,p=>{p.muted=true;p.loop=false;p.timeUpdateEventInterval=.1;});
 useEffect(()=>{player.muted=muted;if(paused)player.pause();else player.play();return()=>player.pause();},[player,paused,muted]);
 useEffect(()=>{if(player.status==='readyToPlay')onReady();const a=player.addListener('timeUpdate',e=>{if(player.duration>0)onProgress(Math.min(1,e.currentTime/player.duration));});const b=player.addListener('playToEnd',onEnded);const c=player.addListener('statusChange',e=>{if(e.status==='error')onError();if(e.status==='readyToPlay')onReady();});return()=>{a.remove();b.remove();c.remove();};},[player,onProgress,onEnded,onError,onReady]);
 return <VideoView accessibilityLabel="Story video" player={player} nativeControls={false} contentFit="cover" allowsPictureInPicture={false} style={{position:'absolute',width:'100%',height:'100%',backgroundColor:'#000'}}/>;
}

export function StoryMedia(props:StoryMediaProps){useEffect(()=>{if(!safeVideoUrl(props.uri))props.onError();},[props.uri,props.onError]);return safeVideoUrl(props.uri)?<NativeStoryMedia {...props}/>:null;}
