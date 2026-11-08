import { useReduceMotion } from "../lib/reduce-motion";
// One full-screen viewer for Today and highlights. Never nests the catalogue player.
import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,AppState,Image,Modal,Pressable,View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {getStories,groupStories,type StoryGroup} from "../lib/story-service";
import {createStoryRefreshGate} from "../lib/story-refresh";
import {storyAge} from "../lib/story-groups";
import {StoryMedia} from "./StoryMedia";
import {T} from "./kit";
const PHOTO_MS=5000;

export function StoryViewer({group,identityKey,onClose,onNextGroup,onPrevGroup}:{group:StoryGroup|null;identityKey?:string|null;onClose:()=>void;onNextGroup?:()=>void;onPrevGroup?:()=>void}){
 const insets=useSafeAreaInsets();
  const reduce = useReduceMotion();
 const [i,setI]=useState(0),[progress,setProgress]=useState(0),[held,setHeld]=useState(false),[background,setBackground]=useState(false),[muted,setMuted]=useState(true),[ready,setReady]=useState(false),[failed,setFailed]=useState(false),[blocked,setBlocked]=useState(false),[resume,setResume]=useState(0);
 const gesture=useRef<{x:number;y:number;at:number;swiped:boolean}|null>(null),skipTap=useRef(false),advanced=useRef(false);
  const gate = useRef(createStoryRefreshGate());
  const [freshGroup, setFreshGroup] = useState<StoryGroup | null>(null);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [_refreshFailed, setRefreshFailed] = useState(false);
  const scope = identityKey && group ? `${identityKey}:${group.key}` : null;
  const refresh = () => {
    if (!scope || !group || refreshing) return;
    const request = gate.current.begin(scope);
    setRefreshing(true); setRefreshFailed(false); setFreshGroup(null);
    void getStories().then((items) => {
      if (!request.current()) return;
      const nextGroup = groupStories(items).find((g) => g.key === group.key) ?? null;
      setLoadedScope(scope); setFreshGroup(nextGroup); setI(0); setProgress(0);
      setRefreshFailed(!nextGroup); setRefreshing(false);
    }).catch(() => {
      if (!request.current()) return;
      setLoadedScope(scope); setRefreshFailed(true); setRefreshing(false);
    });
  };
  useEffect(() => {
    gate.current.invalidate(); setFreshGroup(null); setRefreshFailed(false); setRefreshing(false);
    // A new group/account always obtains fresh URLs before mounting any media.
    if (scope && group) {
      const request = gate.current.begin(scope);
      setRefreshing(true);
      void getStories().then((items) => {
        if (!request.current()) return;
        const nextGroup = groupStories(items).find((g) => g.key === group.key) ?? null;
        setLoadedScope(scope); setFreshGroup(nextGroup); setRefreshFailed(!nextGroup); setRefreshing(false);
      }).catch(() => { if (request.current()) { setLoadedScope(scope); setRefreshFailed(true); setRefreshing(false); } });
    }
    return () => gate.current.invalidate();
  }, [scope]);
  const activeGroup=identityKey===undefined?group:scope&&loadedScope===scope?freshGroup:null;
  const item=activeGroup?.items[i],isVideo=item?.mediaType==="video";
  const loadingStory=refreshing||!!(scope&&loadedScope!==scope);
  const paused=held||background||failed||blocked;
  const next=useCallback(()=>{if(!activeGroup||advanced.current)return;advanced.current=true;setProgress(0);setReady(false);if(i<activeGroup.items.length-1)setI(x=>x+1);else if(onNextGroup)onNextGroup();else onClose();},[activeGroup,i,onNextGroup,onClose]);
  const prev=()=>{setProgress(0);if(i>0){setReady(false);setI(x=>x-1);}else if(onPrevGroup)onPrevGroup();else {setProgress(0);setResume(x=>x+1);}};
  useEffect(()=>{setI(0);setProgress(0);setHeld(false);setMuted(true);},[scope,group?.key]);
  useEffect(()=>{setProgress(0);setReady(false);setFailed(false);setBlocked(false);setHeld(false);advanced.current=false;},[item?.id,item?.url]);
  useEffect(()=>{const sub=AppState.addEventListener('change',s=>setBackground(s!=='active'));return()=>sub.remove();},[]);
  useEffect(()=>{if(!item||isVideo||!ready||paused)return;const id=setInterval(()=>setProgress(p=>Math.min(1,p+100/PHOTO_MS)),100);return()=>clearInterval(id);},[item?.id,isVideo,ready,paused]);
  useEffect(()=>{if(!isVideo&&progress>=1)next();},[progress,isVideo,next]);
  useEffect(()=>{if(!item||ready||failed||blocked)return;const timer=setTimeout(()=>setFailed(true),15000);return()=>clearTimeout(timer);},[item?.id,item?.url,ready,failed,blocked,resume]);
  const mediaReady=useCallback(()=>{setReady(true);setBlocked(false);},[]),mediaError=useCallback(()=>setFailed(true),[]),mediaBlocked=useCallback(()=>setBlocked(true),[]),mediaProgress=useCallback((p:number)=>setProgress(p),[]);
  const retry=()=>{setFailed(false);setBlocked(false);setReady(false);if(scope)refresh();else setResume(n=>n+1);};
  const point=(e:any)=>e.nativeEvent.changedTouches?.[0]??e.nativeEvent.touches?.[0]??e.nativeEvent;
  const down=(e:any)=>{const p=point(e);gesture.current={x:p.pageX,y:p.pageY,at:Date.now(),swiped:false};skipTap.current=false;setHeld(true);};
  const move=(e:any)=>{const g=gesture.current;if(g&&Math.abs(point(e).pageY-g.y)>35)g.swiped=true;};
  const up=(e:any)=>{const g=gesture.current;setHeld(false);if(!g)return;const p=point(e),dy=p.pageY-g.y,dx=p.pageX-g.x;skipTap.current=g.swiped||Date.now()-g.at>220;if(dy>90&&Math.abs(dy)>Math.abs(dx)){skipTap.current=true;onClose();}else if(Math.abs(dx)>75&&Math.abs(dx)>Math.abs(dy)){skipTap.current=true;if(dx<0)onNextGroup?.();else onPrevGroup?.();}gesture.current=null;};
  const tap=(action:()=>void)=>{if(!skipTap.current)action();skipTap.current=false;gesture.current=null;};
  if(!group)return null;
  return <Modal visible transparent={false} animationType={reduce ? "none" : "fade"} statusBarTranslucent onRequestClose={onClose}>
   <View style={{flex:1,backgroundColor:'#000',alignItems:'center'}}>
    <View style={{flex:1,width:'100%',maxWidth:480,backgroundColor:'#000'}}>
     {item&&!failed?(isVideo?<StoryMedia key={item.id+item.url+resume} uri={item.url} paused={paused} muted={muted} onProgress={mediaProgress} onEnded={next} onError={mediaError} onReady={mediaReady} onBlocked={mediaBlocked}/>:<Image key={item.id+item.url} source={{uri:item.url}} resizeMode="cover" onLoad={mediaReady} onError={mediaError} style={{position:'absolute',width:'100%',height:'100%'}}/>):null}
     {item&&!failed?<View style={{position:'absolute',top:Math.max(insets.top,20)+74,bottom:Math.max(insets.bottom,16)+70,left:0,right:0,flexDirection:'row'}}>
      <Pressable accessibilityRole="button" accessibilityActions={[{name:"pause",label:"Pause story"},{name:"resume",label:"Resume story"}]} onAccessibilityAction={e=>{if(e.nativeEvent.actionName==="pause")setHeld(true);if(e.nativeEvent.actionName==="resume")setHeld(false);}} accessibilityLabel="Previous story. Hold to pause" onTouchStart={down} onTouchMove={move} onTouchEnd={up} onTouchCancel={()=>{skipTap.current=true;gesture.current=null;setHeld(false);}} onPressIn={()=>{if(!gesture.current)gesture.current={x:0,y:0,at:Date.now(),swiped:false};setHeld(true);}} onPressOut={()=>{if(gesture.current&&Date.now()-gesture.current.at>220)skipTap.current=true;setHeld(false);}} onPress={()=>tap(prev)} style={{flex:1}}/>
      <Pressable accessibilityRole="button" accessibilityActions={[{name:"pause",label:"Pause story"},{name:"resume",label:"Resume story"}]} onAccessibilityAction={e=>{if(e.nativeEvent.actionName==="pause")setHeld(true);if(e.nativeEvent.actionName==="resume")setHeld(false);}} accessibilityLabel="Next story. Hold to pause" onTouchStart={down} onTouchMove={move} onTouchEnd={up} onTouchCancel={()=>{skipTap.current=true;gesture.current=null;setHeld(false);}} onPressIn={()=>{if(!gesture.current)gesture.current={x:0,y:0,at:Date.now(),swiped:false};setHeld(true);}} onPressOut={()=>{if(gesture.current&&Date.now()-gesture.current.at>220)skipTap.current=true;setHeld(false);}} onPress={()=>tap(next)} style={{flex:2}}/>
     </View>:null}
     {(!item||!ready||failed||blocked)?<View pointerEvents="box-none" style={{position:'absolute',top:'43%',left:30,right:30,alignItems:'center',gap:16}}>
       {loadingStory||(item&&!ready&&!failed&&!blocked)?<ActivityIndicator color="#fff" accessibilityLabel="Loading story"/>:null}
       {failed||(!item&&!loadingStory)?<><T style={{color:'#fff',textAlign:'center'}}>Story unavailable</T><Pressable accessibilityRole="button" accessibilityLabel="Retry story" onPress={retry} style={{padding:12,borderRadius:24,borderWidth:1,borderColor:'rgba(255,255,255,.6)'}}><T style={{color:'#fff'}}>Try again</T></Pressable></>:null}
       {blocked?<Pressable accessibilityRole="button" accessibilityLabel="Play story" onPress={()=>{setBlocked(false);setResume(x=>x+1);}} style={{padding:20}}><T style={{color:'#fff'}}>Tap to play</T></Pressable>:null}
     </View>:null}
     <View style={{position:'absolute',top:Math.max(insets.top,20)+8,left:12,right:12,gap:12}}>
      <View style={{flexDirection:'row',gap:4,backgroundColor:'rgba(0,0,0,.85)',padding:4,borderRadius:4}}>{(activeGroup?.items??group.items).map((s,n)=><View key={s.id} style={{flex:1,height:4,borderRadius:2,backgroundColor:'#555',overflow:'hidden'}}><View style={{height:4,backgroundColor:'#fff',width:n<i?'100%':n===i?`${Math.round(progress*100)}%`:'0%'}}/></View>)}</View>
      <View style={{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'rgba(0,0,0,.24)',borderRadius:22,paddingHorizontal:4}}>
       <View style={{width:32,height:32,borderRadius:16,backgroundColor:'#212125',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>{activeGroup?.cover?<Image source={{uri:activeGroup.cover}} style={{width:32,height:32}}/>:<T style={{color:'#fff',fontSize:11,fontWeight:'700'}}>AD</T>}</View>
       <T role="bodyStrong" style={{color:'#fff',textShadowColor:'#000',textShadowRadius:5}}>{group.title}</T>
       {item?<T role="caption" style={{color:'#ddd',flex:1,textShadowColor:'#000',textShadowRadius:5}}>{storyAge(item.createdAt)}</T>:<View style={{flex:1}}/>}
       {isVideo?<Pressable accessibilityRole="button" accessibilityLabel={muted?'Unmute story':'Mute story'} onPress={()=>setMuted(m=>!m)} hitSlop={8} style={{minWidth:58,height:40,alignItems:'center',justifyContent:'center'}}><T style={{color:'#fff',fontSize:11,fontWeight:'700',textShadowColor:'#000',textShadowRadius:4}}>{muted?'Sound off':'Sound on'}</T></Pressable>:null}
       <Pressable accessibilityRole="button" accessibilityLabel="Close story" onPress={onClose} hitSlop={10} style={{width:40,height:40,alignItems:'center',justifyContent:'center'}}><T style={{color:'#fff',fontSize:32,lineHeight:36}}>×</T></Pressable>
      </View>
     </View>
     {item?.caption?<View pointerEvents="none" style={{position:'absolute',bottom:Math.max(insets.bottom,24)+20,left:20,right:20}}><T style={{color:'#fff',textShadowColor:'#000',textShadowRadius:6,fontSize:16}}>{item.caption}</T></View>:null}
    </View>
   </View>
  </Modal>;
}
