import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useExperienceTheme } from '@autodeck/ui/native';
import { CarChips } from './CarChips';
import type { HomeViewProps } from './HomeView';
import { textStyle } from './kit';
/** Let the platform move and snap the rail. Commit canonical selection only once
 * it settles, so expensive dependent Home reads/renders never interrupt a drag. */
export function HomeOwnedCars({p}:{p:HomeViewProps}) {
 const {width}=useWindowDimensions();const {colors}=useExperienceTheme();
 const [measure,setMeasure]=useState(width-(width<360?32:40));
 const ref=useRef<ScrollView>(null),gestureIndex=useRef<number|null>(null);
 const active=Math.max(0,p.cars.findIndex(c=>c.id===(p.activeCarId??p.cars[0]?.id)));
 const live=useRef({p,active,measure});live.current={p,active,measure};
 const offset=useRef(active*measure),dragging=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const clear=()=>{if(timer.current!==null){clearTimeout(timer.current);timer.current=null}};
 const choose=(index:number)=>{const {p:currentProps,active:currentIndex}=live.current;const next=Math.max(0,Math.min(currentProps.cars.length-1,index));const car=currentProps.cars[next];if(next===currentIndex||!car)return;gestureIndex.current=next;currentProps.onSelectCar?.(car.id)};
 const settle=()=>{clear();timer.current=setTimeout(()=>{timer.current=null;if(!dragging.current)choose(Math.round(offset.current/live.current.measure))},140)};
 const begin=()=>{dragging.current=true;clear()};
 const end=()=>{dragging.current=false;settle()};
 const carIds=p.cars.map(c=>c.id).join('|');
 useEffect(()=>{clear();dragging.current=false;offset.current=active*measure;if(gestureIndex.current===active){gestureIndex.current=null;return}gestureIndex.current=null;ref.current?.scrollTo({x:active*measure,animated:false})},[active,measure,carIds]);
 useEffect(()=>()=>clear(),[]);
 if(p.cars.length<2||!p.onSelectCar)return <CarChips cars={p.cars.slice(0,1)} active={0} onActive={()=>{}} onOpen={p.onCar} onAdd={p.onAddCar}/>;
 return <View testID="home-owned-cars" onLayout={e=>{const w=e.nativeEvent.layout.width;if(w>0)setMeasure(w)}} style={{gap:8}}>
 <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16}
 style={{borderRadius:24,...(Platform.OS==='web'?{scrollSnapType:'x mandatory',overscrollBehaviorX:'contain',isolation:'isolate'} as ViewStyle:{})}}
 accessibilityLabel={`Your cars, ${active+1} of ${p.cars.length}. Swipe to switch car`} accessibilityActions={[{name:'increment',label:'Next car'},{name:'decrement',label:'Previous car'}]}
 onAccessibilityAction={e=>{const next=Math.max(0,Math.min(p.cars.length-1,active+(e.nativeEvent.actionName==='increment'?1:-1)));choose(next);ref.current?.scrollTo({x:next*measure,animated:true})}}
 onTouchStart={begin} onTouchEnd={end} onTouchCancel={end} onScrollBeginDrag={begin} onScrollEndDrag={end}
 onMomentumScrollEnd={e=>{offset.current=e.nativeEvent.contentOffset.x;dragging.current=false;settle()}}
 onScroll={e=>{offset.current=e.nativeEvent.contentOffset.x;settle()}}>
 {p.cars.map(c=><View key={c.id} style={{width:measure,...(Platform.OS==='web'?{scrollSnapAlign:'start'} as ViewStyle:{})}}><CarChips contained cars={[c]} active={0} onActive={()=>{}} onOpen={p.onCar} onAdd={p.onAddCar}/></View>)}
 </ScrollView><View accessible accessibilityLabel={`Selected car ${active+1} of ${p.cars.length}`} style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8}}><View style={{height:4,width:16,borderRadius:2,backgroundColor:colors.accentStrong}}/><Text style={{...textStyle('caption'),color:colors.textSecondary,fontSize:10}}>Swipe to switch · {active+1} / {p.cars.length}</Text></View>
 </View>;
}
