import React from'react';import{act,create}from'react-test-renderer';import{it,expect,vi,afterEach}from'vitest';
const h=vi.hoisted(()=>({owner:'u1',reads:[]as any[]}));
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({status:'ready',claims:{tenantId:'t'},user:{uid:h.owner}})}));
vi.mock('../hooks/useForegroundRefresh',()=>({useForegroundRefresh:()=>{},useForegroundNow:()=>Date.parse('2026-11-14T05:00:00Z')}));
vi.mock('expo-router',()=>({useLocalSearchParams:()=>({})}));vi.mock('react-native',()=>({View:'View',Linking:{openURL:()=>{}}}));vi.mock('@autodeck/ui/theme',()=>({space:{line:10}}));vi.mock('@autodeck/ui/native',()=>({useExperienceTheme:()=>({colors:{},name:'dark'})}));vi.mock('../ui/NavIcon',()=>({NavIcon:'NavIcon'}));vi.mock('./i18n',()=>({useLang:()=>({t:(s:string)=>s})}));vi.mock('./booking-service',()=>({getStudioInfo:()=>new Promise(resolve=>h.reads.push(resolve))}));vi.mock('../ui/kit',()=>({Field:'Field',Kicker:'Kicker',Notice:'Notice',Pane:'Pane',Row:'Row',Screen:'Screen',T:'T'}));vi.mock('../ui/StudioContactDetails',()=>({StudioContactDetails:'StudioContactDetails'}));
import Help from'../app/(tabs)/help';let r:any;
afterEach(async()=>{await act(async()=>r?.unmount());h.owner='u1';h.reads=[]});
it('actual Help uses config timezone and holidays; account switch cannot show prior owner hours',async()=>{
 await act(async()=>{r=create(<Help/>)});expect(r.root.findByType('StudioContactDetails').props.hours).toBe('Opening hours unavailable');
 const hours=Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,open:'10:00',close:'21:00',closed:false}));
 await act(async()=>h.reads[0]({timezone:'Asia/Kolkata',holidays:['2026-11-14'],operatingHours:hours}));expect(r.root.findByType('StudioContactDetails').props.openNow).toBe(false);expect(r.root.findByType('StudioContactDetails').props.hours).toContain('10 am');
 h.owner='u2';await act(async()=>r.update(<Help/>));expect(r.root.findByType('StudioContactDetails').props.openNow).toBeNull();expect(r.root.findByType('StudioContactDetails').props.hours).toBe('Opening hours unavailable');
 await act(async()=>h.reads[0]({timezone:'Asia/Kolkata',holidays:[],operatingHours:hours}));expect(r.root.findByType('StudioContactDetails').props.openNow).toBeNull();
 await act(async()=>h.reads[1]({holidays:[],operatingHours:hours}));expect(r.root.findByType('StudioContactDetails').props.openNow).toBeNull();
});
