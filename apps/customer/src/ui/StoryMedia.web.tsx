import {createElement,useEffect,useRef} from 'react';
import {safeVideoUrl} from '../lib/service-video-policy';
type VideoHandle={pause:()=>void;play:()=>Promise<void>;duration:number;currentTime:number};
export type StoryMediaProps={uri:string;paused:boolean;muted:boolean;onProgress:(fraction:number)=>void;onEnded:()=>void;onError:()=>void;onReady:()=>void;onBlocked:()=>void};
/** Mounted only inside a deliberately opened story. No external handoff or native controls. */
export function StoryMedia({uri,paused,muted,onProgress,onEnded,onError,onReady,onBlocked}:StoryMediaProps){
 useEffect(()=>{if(!safeVideoUrl(uri))onError();},[uri,onError]);
 const ref=useRef<VideoHandle|null>(null);
 useEffect(()=>{const v=ref.current;if(!v)return;if(paused){v.pause();return;}let active=true;void v.play().catch(()=>{if(active)onBlocked();});return()=>{active=false;v.pause();};},[uri,paused]);
 if(!safeVideoUrl(uri))return null;
 return createElement('video',{ref,src:uri,muted,playsInline:true,controls:false,preload:'auto',loop:false,'aria-label':'Story video',onLoadedData:onReady,onPlaying:onReady,onEnded,onError,onTimeUpdate:(e:{currentTarget:VideoHandle})=>{const v=e.currentTarget;if(v.duration>0)onProgress(Math.min(1,v.currentTime/v.duration));},style:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',background:'#000'}});
}
