import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useExperienceTheme } from '@autodeck/ui/native';
import type { CarListingView } from '@autodeck/core';
import { hasCarPrice } from '../lib/cars-home';
const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const kmLabel = (km: number) => `${km.toLocaleString('en-IN')} km`;
import { textStyle } from './kit';
/** Compact editorial listings. Every image and fact belongs to its real listing. */
export function HomeShowroom({ cars, onOpen, onBuy, onSell }: { cars: CarListingView[]; onOpen: (id: string) => void; onBuy: () => void; onSell: () => void }) {
 const { width } = useWindowDimensions();
 const listingWidth = Math.min(width - (width < 360 ? 32 : 40), 550);
 const day=useExperienceTheme().name==='light', ink=day?'#22282d':'#f3f0eb', muted=day?'#626e78':'#acb7be';
 if (!cars.length) return null;
 const action=(title:string,press:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={title} onPress={press} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:muted,fontSize:11}}>{title}</Text></Pressable>;
 return <View testID="home-showroom" style={{paddingTop:26,gap:10}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text accessibilityRole="header" style={{...textStyle('display'),fontSize:23,fontWeight:'500',color:ink}}>Cars for sale</Text>{action('See all cars for sale',onBuy)}</View><ScrollView horizontal showsHorizontalScrollIndicator={cars.length>1} contentContainerStyle={{gap:18}}>{cars.map(car=><Pressable key={car.id} accessibilityRole="button" accessibilityLabel={`Open ${car.year} ${car.make} ${car.model}`} onPress={()=>onOpen(car.id)} style={{width:listingWidth,flexDirection:'row',gap:14,alignItems:'center'}}><View style={{flex:1,gap:8}}><Text style={{...textStyle('display'),fontSize:18,lineHeight:24,fontWeight:'500',color:ink}}>{car.year} {car.make} {car.model}</Text><Text style={{color:muted,fontSize:11}}>{kmLabel(car.kmDriven)}</Text><Text style={{color:muted,fontSize:11}}>{hasCarPrice(car)?inr(car.askingPrice):'Price on request'}</Text></View><Image source={{uri:car.photoUrls[0]}} resizeMode="cover" style={{width:132,height:119,borderBottomLeftRadius:32}}/></Pressable>)}</ScrollView><View style={{flexDirection:'row',justifyContent:'space-between'}}>{action('Browse cars',onBuy)}{action('Sell your car',onSell)}</View></View>;
}
