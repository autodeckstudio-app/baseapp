import {useState} from 'react';
import {Image,View} from 'react-native';
import type {StoryGroup} from '../lib/story-groups';
import {StoryVideoThumbnail} from './StoryVideoThumbnail';
import {T} from './kit';
/** Use the existing uploaded image, or a frame of the uploaded video. Never unrelated stock art or a letter avatar. */
export function StoryCover({group}:{group:StoryGroup}){
 const [imageFailed,setImageFailed]=useState(false);
 const video=[...group.items].reverse().find(s=>s.mediaType==='video');
 if(group.cover&&!imageFailed)return <Image accessibilityLabel={`${group.title} story thumbnail`} source={{uri:group.cover}} onError={()=>setImageFailed(true)} resizeMode="cover" style={{width:'100%',height:'100%'}}/>;
 if(video)return <StoryVideoThumbnail key={video.id+video.url} uri={video.url} title={group.title}/>;
 return <View accessibilityLabel="Story thumbnail unavailable"><T role="caption" tone="secondary">Story</T></View>;
}
