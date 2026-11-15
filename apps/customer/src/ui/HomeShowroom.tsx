import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useExperienceTheme } from '@autodeck/ui/native';
import type { CarListingView } from '@autodeck/core';
import { hasCarPrice } from '../lib/cars-home';
const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const kmLabel = (km: number) => `${km.toLocaleString('en-IN')} km`;
import { textStyle } from './kit';
/** Compact editorial listings. Every image and fact belongs to its real listing. */
export function HomeShowroom({ cars, onOpen, onBuy, onSell }: { cars: CarListingView[]; onOpen: (id: string) => void; onBuy: () => void; onSell: () => void }) {
 const [page,setPage]=useState(0);
 const scrollRef=useRef<ScrollView>(null);
 const { width } = useWindowDimensions();
 const listingWidth = Math.min(width - (width < 360 ? 32 : 40), 550);
 const {colors}=useExperienceTheme(), ink=colors.textPrimary, muted=colors.textSecondary;
 const current=Math.min(page,Math.max(0,cars.length-1));
 useEffect(()=>{setPage(0);scrollRef.current?.scrollTo({x:0,animated:false})},[cars.map(c=>c.id).join('|'),listingWidth]);
 const go=(index:number)=>{const next=Math.max(0,Math.min(cars.length-1,index));setPage(next);scrollRef.current?.scrollTo({x:next*(listingWidth+18),animated:true})};
 if (!cars.length) return null;
 const action=(title:string,press:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={title} onPress={press} style={{minHeight:44,justifyContent:'center'}}><Text style={{...textStyle('caption'),color:muted,fontSize:12}}>{title}</Text></Pressable>;
 return <View testID="home-showroom" style={{paddingTop:26,gap:10}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text accessibilityRole="header" style={{...textStyle('title'),color:ink}}>Cars for sale</Text>{action('See all cars for sale',onBuy)}</View><ScrollView style={Platform.OS==='web'?{scrollSnapType:'x mandatory'} as ViewStyle:undefined} ref={scrollRef} horizontal snapToInterval={listingWidth+18} decelerationRate="fast" showsHorizontalScrollIndicator={false} scrollEventThrottle={16} accessibilityLabel={cars.length>1?`Cars for sale, ${current+1} of ${cars.length}. Swipe to explore`:"Car for sale"} accessibilityActions={cars.length>1?[{name:"increment",label:"Next car"},{name:"decrement",label:"Previous car"}]:[]} onAccessibilityAction={e=>go(current+(e.nativeEvent.actionName==='increment'?1:-1))} onScroll={e=>setPage(Math.max(0,Math.min(cars.length-1,Math.round(e.nativeEvent.contentOffset.x/(listingWidth+18)))))} contentContainerStyle={{gap:18}}>{cars.map(car=><Pressable key={car.id} accessibilityRole="button" accessibilityLabel={`Open ${car.year} ${car.make} ${car.model}`} onPress={()=>onOpen(car.id)} style={{...(Platform.OS==='web'?{scrollSnapAlign:'start'} as ViewStyle:{}),width:listingWidth,flexDirection:'row',gap:14,alignItems:'center'}}><View style={{flex:1,gap:8}}><Text style={{...textStyle('heading'),color:ink}}>{car.year} {car.make} {car.model}</Text><Text style={{...textStyle('caption'),color:muted,fontSize:12}}>{kmLabel(car.kmDriven)}</Text><Text style={{...textStyle('caption'),color:muted,fontSize:12}}>{hasCarPrice(car)?inr(car.askingPrice):'Price on request'}</Text></View><Image source={{uri:car.photoUrls[0]}} resizeMode="cover" style={{width:132,height:119,borderRadius:24}}/></Pressable>)}</ScrollView><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12}}>{action('Sell your car',onSell)}{cars.length>1?<View testID="home-car-pagination" accessible accessibilityLabel={`Car ${current+1} of ${cars.length}. Swipe to see more cars`} style={{flexDirection:'row',alignItems:'center',gap:10}}><View style={{flexDirection:'row',gap:4}}>{Array.from({length:Math.min(cars.length,5)},(_,i)=>{const start=Math.max(0,Math.min(current-2,cars.length-5));return <View key={i} testID={i+start===current?'current-car-indicator':undefined} style={{height:4,width:i+start===current?16:4,borderRadius:2,backgroundColor:i+start===current?colors.accentStrong:colors.borderStrong}}/>})}</View><Text style={{...textStyle('caption'),color:muted,fontSize:11}}>Swipe · {current+1} / {cars.length}</Text></View>:null}</View></View>;
}
