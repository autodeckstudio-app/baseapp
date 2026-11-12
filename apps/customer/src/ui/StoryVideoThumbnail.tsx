import {useVideoPlayer,VideoView} from 'expo-video';
export function StoryVideoThumbnail({uri,title}:{uri:string;title:string}){
 const player=useVideoPlayer(uri,p=>{p.muted=true;p.loop=false;p.currentTime=.1;p.pause();});
 return <VideoView accessibilityLabel={`${title} video thumbnail`} player={player} nativeControls={false} contentFit="cover" allowsPictureInPicture={false} style={{width:'100%',height:'100%'}}/>;
}
