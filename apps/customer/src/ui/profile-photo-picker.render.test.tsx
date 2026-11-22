import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { Pressable } from 'react-native';
const picker = vi.hoisted(() => ({ choose: vi.fn() }));
vi.mock('expo-image-picker', () => ({ launchImageLibraryAsync: picker.choose }));
vi.mock('react-native', async () => ({ ...await vi.importActual<any>('react-native'), Image: (p:any) => React.createElement('Image',p), Modal: (p:any) => React.createElement('Modal',p,p.visible?p.children:null) }));
import { ProfileHero } from './ProfileHero';
const base={name:'Sample User',email:'sample@example.invalid',photoScope:'account-A',onEdit:()=>{}};
const button=(r:any,label:string)=>r.root.findAllByType(Pressable).find((n:any)=>n.props.accessibilityLabel===label);
beforeEach(()=>{picker.choose.mockReset()});
it('corner edit opens the real picker port with photo-only private options; cancel does not change identity',async()=>{
 picker.choose.mockResolvedValue({canceled:true,assets:null});let r:any;await act(async()=>{r=create(<ProfileHero {...base}/>)});await act(async()=>button(r,'Choose photo preview').props.onPress());
 expect(picker.choose).toHaveBeenCalledOnce();expect(picker.choose).toHaveBeenCalledWith(expect.objectContaining({mediaTypes:['images'],exif:false,base64:false}));expect(JSON.stringify(r.toJSON())).not.toContain('Photo preview');expect(JSON.stringify(r.toJSON())).toContain('Sample User');await act(async()=>r.unmount());
});
it('chosen photo is an explicitly unsaved preview, not a profile or upload mutation, and closes',async()=>{
 picker.choose.mockResolvedValue({canceled:false,assets:[{uri:'data:image/png;base64,c2FtcGxl'}]});let r:any;await act(async()=>{r=create(<ProfileHero {...base}/>)});await act(async()=>button(r,'Choose photo preview').props.onPress());expect(JSON.stringify(r.toJSON())).toContain('This preview is not saved to your account.');expect(JSON.stringify(r.toJSON())).toContain('Selected photo preview, not saved');await act(async()=>button(r,'Close photo preview').props.onPress());expect(JSON.stringify(r.toJSON())).not.toContain('Selected photo preview');await act(async()=>r.unmount());
});
it('late picker result from the previous account is discarded',async()=>{
 let done:any;picker.choose.mockImplementation(()=>new Promise(resolve=>{done=resolve}));let r:any;await act(async()=>{r=create(<ProfileHero {...base}/>)});await act(async()=>button(r,'Choose photo preview').props.onPress());await act(async()=>r.update(<ProfileHero {...base} photoScope="account-B"/>));await act(async()=>done({canceled:false,assets:[{uri:'file:///previous-account.jpg'}]}));expect(JSON.stringify(r.toJSON())).not.toContain('previous-account.jpg');expect(JSON.stringify(r.toJSON())).not.toContain('Photo preview');await act(async()=>r.unmount());
});
it('double press opens one picker and a failed picker leaves the account photo unchanged',async()=>{
 let fail:any;picker.choose.mockImplementation(()=>new Promise((_,reject)=>{fail=reject}));let r:any;await act(async()=>{r=create(<ProfileHero {...base}/>)});await act(async()=>{button(r,'Choose photo preview').props.onPress();button(r,'Choose photo preview').props.onPress()});expect(picker.choose).toHaveBeenCalledOnce();await act(async()=>fail(new Error('cancelled platform operation')));expect(JSON.stringify(r.toJSON())).toContain('Could not open the photo picker. Your account photo is unchanged.');await act(async()=>r.unmount());
});
