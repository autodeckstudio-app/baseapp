import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useExperienceTheme } from '@autodeck/ui/native';
import { CarChips } from './CarChips';
import type { HomeViewProps } from './HomeView';
import { textStyle } from './kit';
/** Owned-car gesture changes the canonical selection. Sale listings use a separate carousel. */
export function HomeOwnedCars({p}:{p:HomeViewProps}) {
 const {width}=useWindowDimensions();const {colors}=useExperienceTheme();
 const [measure,setMeasure]=useState(width-(width<360?32:40));
 const ref=useRef<ScrollView>(null);const gestureIndex=useRef<number|null>(null);
 const active=Math.max(0,p.cars.findIndex(c=>c.id===(p.activeCarId??p.cars[0]?.id)));
 useEffect(()=>{if(gestureIndex.current===active){gestureIndex.current=null;return}ref.current?.scrollTo({x:active*measure,animated:false})},[active,measure]);
 if(p.cars.length<2||!p.onSelectCar)return <CarChips cars={p.cars.slice(0,1)} active={0} onActive={()=>{}} onOpen={p.onCar} onAdd={p.onAddCar}/>;
 const choose=(index:number)=>{const next=Math.max(0,Math.min(p.cars.length-1,index));gestureIndex.current=next;p.onSelectCar?.(p.cars[next]!.id)};
 return <View testID="home-owned-cars" onLayout={e=>{const w=e.nativeEvent.layout.width;if(w>0)setMeasure(w)}} style={{gap:8}}>
 <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16} style={Platform.OS==='web'?{scrollSnapType:'x mandatory'} as ViewStyle:undefined} accessibilityLabel={`Your cars, ${active+1} of ${p.cars.length}. Swipe to switch car`} accessibilityActions={[{name:'increment',label:'Next car'},{name:'decrement',label:'Previous car'}]} onAccessibilityAction={e=>{const next=Math.max(0,Math.min(p.cars.length-1,active+(e.nativeEvent.actionName==='increment'?1:-1)));choose(next);ref.current?.scrollTo({x:next*measure,animated:true})}} onScroll={e=>{const next=Math.max(0,Math.min(p.cars.length-1,Math.round(e.nativeEvent.contentOffset.x/measure)));if(next!==active&&next!==gestureIndex.current)choose(next)}}>
 {p.cars.map(c=><View key={c.id} style={{width:measure,...(Platform.OS==='web'?{scrollSnapAlign:'start'} as ViewStyle:{})}}><CarChips cars={[c]} active={0} onActive={()=>{}} onOpen={p.onCar} onAdd={p.onAddCar}/></View>)}
 </ScrollView><View accessible accessibilityLabel={`Selected car ${active+1} of ${p.cars.length}`} style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8}}><View style={{height:4,width:16,borderRadius:2,backgroundColor:colors.accentStrong}}/><Text style={{...textStyle('caption'),color:colors.textSecondary,fontSize:10}}>Swipe to switch · {active+1} / {p.cars.length}</Text></View>
 </View>;
}
