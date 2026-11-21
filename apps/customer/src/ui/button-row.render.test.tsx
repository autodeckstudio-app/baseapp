import React from 'react';
import {act,create} from 'react-test-renderer';
import {it,expect,vi} from 'vitest';
import {Pressable,StyleSheet,View} from 'react-native';
import {Button,ButtonRow} from './kit';
it('paired slim actions wrap in order and keep aligned 44px hit targets and callbacks',async()=>{
 const first=vi.fn(),second=vi.fn();let r:any;
 await act(async()=>{r=create(<ButtonRow><Button label="Approve" onPress={first}/><Button kind="quiet" label="Back" onPress={second}/></ButtonRow>)});
 const row=r.root.findAllByType(View).find((n:any)=>n.props.style?.flexWrap==='wrap');
 expect(row.props.style).toMatchObject({flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center'});
 const actions=r.root.findAllByType(Pressable);
 for(const a of actions){const style=StyleSheet.flatten(a.props.style({pressed:false}));expect(style).toMatchObject({minHeight:44,marginTop:0,marginBottom:0,alignSelf:'flex-start'});}
 expect(actions.map((a:any)=>a.props.accessibilityLabel)).toEqual(['Approve','Back']);
 await act(async()=>{actions[0].props.onPress();actions[1].props.onPress()});expect(first).toHaveBeenCalledOnce();expect(second).toHaveBeenCalledOnce();await act(async()=>r.unmount());
});
