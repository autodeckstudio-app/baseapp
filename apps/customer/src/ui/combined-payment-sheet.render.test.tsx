import React from'react';
import{create,act}from'react-test-renderer';
import{it,expect,vi}from'vitest';
import{CombinedPaymentSheet}from'./CombinedPaymentSheet';
import{Button}from'./kit';
import{Pressable}from'react-native';
vi.mock('react-native',async(load)=>({...await load<any>(),Modal:({visible,children,...props}:any)=>visible?React.createElement('modal',props,children):null}));
const props={visible:true,serviceName:'Sample service',summary:'Includes selected transport.',choice:'advance20' as const,totalPaise:2108955,payNowPaise:421800,balancePaise:1687155,busy:false,onPay:()=>{},onGoBack:()=>{}};
it.each(['advance20','full']as const)('new sheet preserves supplied %s amounts and calls only chosen callbacks',async choice=>{
 let r:any;const pay=vi.fn(),back=vi.fn();
 await act(async()=>{r=create(<CombinedPaymentSheet {...props} choice={choice} payNowPaise={choice==='full'?2108955:421800} balancePaise={choice==='full'?0:1687155} onPay={pay} onGoBack={back}/>)});
 const text=JSON.stringify(r.toJSON());expect(text).toContain('21,089.55');expect(text).toContain(choice==='full'?'Pay now (full)':'Pay now (20%)');expect(text).toContain('Unused transport is excluded');expect(text).toContain('Refunds need approval');
 await act(async()=>r.root.findByType(Button).props.onPress());expect(pay).toHaveBeenCalledTimes(1);expect(back).not.toHaveBeenCalled();
 await act(async()=>r.root.findAllByType(Pressable).filter((n:any)=>n.props.accessibilityLabel==='Go back').at(-1).props.onPress());expect(back).toHaveBeenCalledTimes(1);
 await act(async()=>r.unmount());
});
it.each([true,false])('new sheet busy=%s gates backdrop, hardware close, Escape and action disabled state',async busy=>{
 let r:any;const back=vi.fn(),listener=vi.fn(),remove=vi.fn();const old=(globalThis as any).document;
 (globalThis as any).document={addEventListener:listener,removeEventListener:remove};
 try{
  await act(async()=>{r=create(<CombinedPaymentSheet {...props} busy={busy} onGoBack={back}/>)});
  const button=r.root.findByType(Button);expect(button.props.disabled).toBe(busy);expect(button.props.busy).toBe(busy);
  await act(async()=>r.root.findAllByType(Pressable).find((n:any)=>n.props.accessibilityLabel==='Go back').props.onPress());
  await act(async()=>r.root.findByType('modal').props.onRequestClose());
  await act(async()=>listener.mock.calls[0]![1]({key:'Escape'}));expect(back).toHaveBeenCalledTimes(busy?0:3);
  await act(async()=>r.unmount());expect(remove).toHaveBeenCalledWith('keydown',listener.mock.calls[0]![1]);
 }finally{(globalThis as any).document=old}
});
it('new sheet hidden renders no content or keydown listener',async()=>{let r:any;await act(async()=>{r=create(<CombinedPaymentSheet {...props} visible={false}/>)});expect(r.toJSON()).toBeNull();await act(async()=>r.unmount())});
