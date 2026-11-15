import React from 'react';
import { it, expect, vi } from 'vitest';
import { create, act } from 'react-test-renderer';
import { Pressable, ScrollView, View } from 'react-native';
vi.mock('react-native',async()=>({...await vi.importActual<any>('react-native'),Image:'Image',useWindowDimensions:()=>({width:390,height:844,scale:1,fontScale:1})}));
import { HomeShowroom } from './HomeShowroom';
const cars=Array.from({length:7},(_,i)=>({id:String(i),year:2023,make:'Sample',model:String(i),kmDriven:2000,askingPrice:0,priceHidden:true,photoUrls:['https://example.invalid/car.jpg']})) as any;
it('tracks actual scroll position, keeps exact inventory callbacks and resets when inventory changes',async()=>{
 const open=vi.fn(),buy=vi.fn(),sell=vi.fn();let r:any;
 const render=(list:any)=><HomeShowroom cars={list} onOpen={open} onBuy={buy} onSell={sell}/>;
 await act(async()=>{r=create(render(cars))});
 const rail=()=>r.root.findByType(ScrollView);const label=()=>r.root.findAllByType(View).find((n:any)=>n.props.testID==='home-car-pagination').props.accessibilityLabel;
 expect(label()).toBe('Car 1 of 7. Swipe to see more cars');
 await act(async()=>rail().props.onScroll({nativeEvent:{contentOffset:{x:100000}}}));expect(label()).toBe('Car 7 of 7. Swipe to see more cars');
 expect(r.root.findAllByType(View).filter((n:any)=>n.props.testID==='current-car-indicator')).toHaveLength(1);
 await act(async()=>rail().props.onAccessibilityAction({nativeEvent:{actionName:'decrement'}}));expect(label()).toBe('Car 6 of 7. Swipe to see more cars');
 for(const[name,fn]of [['Sell your car',sell],['See all cars for sale',buy]] as const){await act(async()=>r.root.findAllByType(Pressable).find((n:any)=>n.props.accessibilityLabel===name).props.onPress());expect(fn).toHaveBeenCalledOnce()}
 await act(async()=>r.root.findAllByType(Pressable).find((n:any)=>n.props.accessibilityLabel==='Open 2023 Sample 3').props.onPress());expect(open).toHaveBeenCalledWith('3');
 await act(async()=>r.update(render(cars.slice(0,2))));expect(label()).toBe('Car 1 of 2. Swipe to see more cars');
 await act(async()=>r.update(render(cars.slice(0,1))));expect(r.root.findAllByType(View).some((n:any)=>n.props.testID==='home-car-pagination')).toBe(false);
 await act(async()=>r.update(render([])));expect(r.toJSON()).toBeNull();await act(async()=>r.unmount());
});
