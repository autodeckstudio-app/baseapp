import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {describe,it,expect,vi} from 'vitest';
const h=vi.hoisted(()=>({pick:vi.fn()}));
vi.mock('react-native',()=>({Platform:{OS:'android'},View:(p:any)=>React.createElement('View',p),Pressable:(p:any)=>React.createElement('Pressable',p),Image:(p:any)=>React.createElement('Image',p)}));
vi.mock('./kit',()=>({T:(p:any)=>React.createElement('Text',p)}));
vi.mock('@autodeck/ui/native',()=>({useExperienceTheme:()=>({name:'light'})}));
vi.mock('../lib/native-image-pick',()=>({pickImagesFromLibrary:(p:unknown)=>h.pick(p)}));
import {FileUploader} from './inputs';
describe('actual native uploader',()=>{
 it('shows a real native button and forwards bytes without a web Blob',async()=>{const bytes=new Uint8Array([255,216,255]);const picked=[{bytes,type:'image/jpeg',previewUri:'file:///photo.jpg'}];h.pick.mockResolvedValue(picked);const onNativeChange=vi.fn(),onChange=vi.fn();let r!:ReactTestRenderer;await act(async()=>{r=create(<FileUploader files={[]} onChange={onChange} nativeEnabled onNativeChange={onNativeChange} label="Car photo"/>);});const button=r.root.findByType('Pressable' as any);await act(async()=>{await button.props.onPress();});expect(h.pick).toHaveBeenCalledWith({multiple:false,maxFiles:1,accept:'image/jpeg,image/png,image/webp'});expect(onNativeChange).toHaveBeenCalledWith(picked);expect(onChange).not.toHaveBeenCalled();expect(r.root.findByType('Image' as any).props.source.uri).toBe('file:///photo.jpg');});
 it('cancellation produces no callback',async()=>{h.pick.mockResolvedValue(null);const changed=vi.fn();let r!:ReactTestRenderer;await act(async()=>{r=create(<FileUploader files={[]} onChange={vi.fn()} nativeEnabled onNativeChange={changed}/>);});await act(async()=>{await r.root.findByType('Pressable' as any).props.onPress();});expect(changed).not.toHaveBeenCalled();});
 it('keeps selection across parent rerender and clears after parent save reset',async()=>{const picked=[{bytes:new Uint8Array([1]),type:'image/jpeg',previewUri:'file:///one.jpg'}];h.pick.mockResolvedValue(picked);const changed=vi.fn();let r!:ReactTestRenderer;await act(async()=>{r=create(<FileUploader files={[]} nativeFileCount={0} onChange={vi.fn()} nativeEnabled onNativeChange={changed}/>);});await act(async()=>{await r.root.findByType('Pressable' as any).props.onPress();});await act(async()=>{r.update(<FileUploader files={[]} nativeFileCount={1} onChange={vi.fn()} nativeEnabled onNativeChange={changed}/>);});expect(r.root.findAllByType('Image' as any)).toHaveLength(1);await act(async()=>{r.update(<FileUploader files={[]} nativeFileCount={0} onChange={vi.fn()} nativeEnabled onNativeChange={changed}/>);});expect(r.root.findAllByType('Image' as any)).toHaveLength(0);});

});
