import React from 'react';
import {act,create} from 'react-test-renderer';
import {describe,it,expect,vi,beforeEach} from 'vitest';
const h=vi.hoisted(()=>({focus:null as null|(()=>void),state:undefined as any,params:{} as any,dispatch:vi.fn(),navigate:vi.fn()}));
vi.mock('expo-router',()=>({useNavigation:()=>({getState:()=>h.state,dispatch:h.dispatch}),useLocalSearchParams:()=>h.params,useRouter:()=>({navigate:h.navigate}),useFocusEffect:(cb:any)=>{h.focus=cb;}}));
import {useCarsEntry} from './useCarsEntry';
function Harness({page}:{page:'index'|'[id]'|'sell'}){const back=useCarsEntry(page);return <button onClick={back}/>;}
beforeEach(()=>{h.state=undefined;h.params={};h.dispatch.mockReset();h.navigate.mockReset();h.focus=null;});
describe('mounted Cars focus wiring',()=>{
 it('cleans the hub on every focus, including a mounted tab re-entry',async()=>{
  let r:any;await act(async()=>{r=create(<Harness page="index"/>)});
  h.focus!();expect(h.dispatch).not.toHaveBeenCalled();
  const top={name:'index',key:'hub',params:{tab:'buy'}};
  h.state={index:1,routes:[{name:'[id]',key:'old'},top]};
  h.focus!();expect(h.dispatch).toHaveBeenCalledWith({type:'RESET',payload:{index:0,routes:[top]}});
  await act(async()=>r.unmount());
 });
 it.each(['[id]','sell'] as const)('direct Home %s has fixed Back even after a refresh',async page=>{
  h.params={returnTo:'home'};let r:any;await act(async()=>{r=create(<Harness page={page}/>)});
  r.root.findByType('button').props.onClick();expect(h.navigate).toHaveBeenCalledWith('/(tabs)');
  await act(async()=>r.unmount());
 });
 it('does not override ordinary internal detail Back or allow arbitrary origins',async()=>{
  for(const returnTo of [undefined,'https://example.invalid']){
   h.params={returnTo};let r:any;await act(async()=>{r=create(<Harness page="[id]"/>)});
   expect(r.root.findByType('button').props.onClick).toBeUndefined();await act(async()=>r.unmount());
  }
 });
});
