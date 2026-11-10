import {lightColors} from '@autodeck/ui/theme';
import {createElement,useState} from 'react';
import {View} from 'react-native';
import {safeVideoUrl} from '../lib/service-video-policy';
import {Button,Notice,T} from './kit';
export type ServiceVideoProps={uri:string;title:string;aspectRatio?:number};
/** No video element/source request until a deliberate tap. No autoplay and no audio by default. */
export function ServiceVideo({uri,title,aspectRatio=16/9}:ServiceVideoProps){const [opened,setOpened]=useState(false);const [sourceAspect,setSourceAspect]=useState(aspectRatio);const [failed,setFailed]=useState(false);if(!safeVideoUrl(uri))return null;if(!opened)return <Button kind="quiet" label={`Watch: ${title}`} onPress={()=>setOpened(true)}/>;return <View style={{gap:12}}><T role="bodyStrong" style={{color:lightColors.textPrimary}}>{title}</T>{failed?<Notice title="Video couldn't load" body="Close the video and try again."/>:createElement('video',{src:uri,controls:true,muted:true,autoPlay:false,playsInline:true,preload:'none','aria-label':title,onLoadedMetadata:(event:{currentTarget:{videoWidth:number;videoHeight:number}})=>{const v=event.currentTarget;if(v.videoWidth&&v.videoHeight)setSourceAspect(v.videoWidth/v.videoHeight);},onError:()=>setFailed(true),style:{width:'100%',aspectRatio:String(sourceAspect),maxHeight:'60vh',objectFit:'contain',background:'#000'}})}<Button kind="quiet" icon="close" label="Close video" onPress={()=>{setOpened(false);setFailed(false);}}/></View>;}
