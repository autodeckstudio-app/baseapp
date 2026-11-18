import React from 'react';
import {it,expect,vi} from 'vitest';
import {act,create} from 'react-test-renderer';
import {ActivityIndicator,Pressable,StyleSheet} from 'react-native';
const h=vi.hoisted(()=>({name:'light'}));
vi.mock('@autodeck/ui/native',()=>({useExperienceTheme:()=>({name:h.name,colors:{textPrimary:h.name==='light'?'#252c32':'#ecf1f7'}}),useReduceTransparency:()=>false}));
import {Button} from './kit';
for(const mode of ['light','night'])it(`${mode} busy primary action keeps a contrasting spinner and remains disabled`,async()=>{
 h.name=mode;const onPress=vi.fn();let tree:any;
 await act(async()=>{tree=create(<Button label="Pay sample total" busy onPress={onPress}/>)});
 expect(tree.root.findByType(ActivityIndicator).props.color).toBe(mode==='light'?'#ffffff':'#202831');
 const button=tree.root.findByType(Pressable);expect(button.props.disabled).toBe(true);
 const style=StyleSheet.flatten(button.props.style({pressed:false}));expect(style.backgroundColor).toBe(mode==='light'?'#252c32':'#ecf1f7');
 await act(async()=>tree.unmount());
});
