import {createElement,useState} from 'react';
/** Paused first frame only. No autoplay, audio, controls, or separate video request to a third party. */
export function StoryVideoThumbnail({uri,title}:{uri:string;title:string}){
 const[failed,setFailed]=useState(false);
 return failed?createElement('span',{'aria-label':'Story thumbnail unavailable'},'Story'):createElement('video',{'aria-label':`${title} video thumbnail`,src:uri,preload:'metadata',muted:true,playsInline:true,onLoadedMetadata:(e:{currentTarget:{duration:number;currentTime:number}})=>{const v=e.currentTarget;if(v.duration>0)v.currentTime=Math.min(.1,v.duration/2);},onError:()=>setFailed(true),style:{width:'100%',height:'100%',objectFit:'cover',pointerEvents:'none'}});
}
