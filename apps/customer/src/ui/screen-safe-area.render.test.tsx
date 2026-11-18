import React from 'react';
import {it,expect,vi} from 'vitest';
import {create,act} from 'react-test-renderer';
import {Platform,View,ScrollView} from 'react-native';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';
vi.mock('expo-router',()=>({useRouter:()=>({canGoBack:()=>false,replace:vi.fn()}),useSegments:()=>['(tabs)','catalogue'],useFocusEffect:()=>{}}));
vi.mock('./SceneMotion',()=>({SceneMotion:({children}:any)=>children}));
import {Screen,T} from './kit';
for(const os of ['web','ios','android'])for(const pinned of [false,true])for(const inset of [0,59])it(`${os} ${pinned?'pinned':'scrolling'} header reserves top ${inset} once outside scrolling`,async()=>{
 const original=Platform.OS;Object.defineProperty(Platform,'OS',{value:os,configurable:true});let r:any;
 try{await act(async()=>{r=create(<SafeAreaInsetsContext.Provider value={{top:inset,left:0,right:0,bottom:34}}><Screen appBar="Services" top={pinned?<T>Search</T>:undefined}><T>Content</T></Screen></SafeAreaInsetsContext.Provider>)});
 const safe=r.root.findAll((n:any)=>n.props.testID==='screen-safe-area'&&n.type===View);expect(safe).toHaveLength(1);expect(safe[0].props.style.paddingTop).toBe(os==='web'?'env(safe-area-inset-top, 0px)':inset);
 expect(safe[0].findAll((n:any)=>n.props.testID==='screen-scroll'&&n.type===ScrollView)).toHaveLength(1);
 }finally{if(r)await act(async()=>r.unmount());Object.defineProperty(Platform,'OS',{value:original,configurable:true})}
});
