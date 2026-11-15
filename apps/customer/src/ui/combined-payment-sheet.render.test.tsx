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
 const text=JSON.stringify(r.toJSON());expect(text).toContain('21,089.55');expect(text).toContain(choice==='full'?'Pay now (full)':'Pay now (20%)');expect(text).not.toContain('Unused transport is excluded');expect(text).not.toContain('Refunds need approval');
 await act(async()=>r.root.findByType(Button).props.onPress());expect(pay).toHaveBeenCalledTimes(1);expect(back).not.toHaveBeenCalled();
 await act(async()=>r.root.findAllByType(Pressable).filter((n:any)=>n.props.accessibilityLabel==='Go back').at(-1).props.onPress());expect(back).toHaveBeenCalledTimes(1);
 await act(async()=>r.unmount());
});
it.each([true,false])('new sheet busy=%s gates backdrop, modal close and action disabled state',async busy=>{
 let r:any;const back=vi.fn();
 await act(async()=>{r=create(<CombinedPaymentSheet {...props} busy={busy} onGoBack={back}/>)});
 const button=r.root.findByType(Button);expect(button.props.disabled).toBe(busy);expect(button.props.busy).toBe(busy);
 await act(async()=>r.root.findAllByType(Pressable).find((n:any)=>n.props.accessibilityLabel==='Go back').props.onPress());
 await act(async()=>r.root.findByType('modal').props.onRequestClose());expect(back).toHaveBeenCalledTimes(busy?0:2);
 await act(async()=>r.unmount());
});
it('new sheet hidden renders no content or keydown listener',async()=>{let r:any;await act(async()=>{r=create(<CombinedPaymentSheet {...props} visible={false}/>)});expect(r.toJSON()).toBeNull();await act(async()=>r.unmount())});

it('booking terms remain reachable before payment and retain combined policy disclosures',async()=>{
 const{BookingTerms}=await import('./BookingTerms');let r:any;await act(async()=>{r=create(<BookingTerms combinedMode onHelp={()=>{}}/>)});
 const link=r.root.findAllByType(Pressable).find((n:any)=>n.props.accessibilityLabel==='Booking terms');expect(link).toBeTruthy();expect(link.props.style.minHeight).toBeGreaterThanOrEqual(44);
 expect(JSON.stringify(r.toJSON())).not.toContain('No-show retention');await act(async()=>link.props.onPress());const text=JSON.stringify(r.toJSON());for(const policy of ['No-show retention','20% of discounted service, including GST.','Unused transport','Excluded from no-show retention.','Refund remainder','Sent for approval. Not refunded until processed.','Free until 24 hours before.'])expect(text).toContain(policy);await act(async()=>r.unmount());
});

it('review sheet uses an explicit inset wrapper and full-width Pay without changing the supplied amount',async()=>{let r:any;await act(async()=>{r=create(<CombinedPaymentSheet {...props}/>)});const content=r.root.findByProps({testID:'payment-sheet-content'});expect(content.props.style.paddingHorizontal).toBe(16);expect(content.props.style.paddingTop).toBe(24);const panel=r.root.findByProps({testID:'payment-sheet-panel'});expect(panel.props.style.borderRadius).toBe(24);expect(panel.props.style.overflow).toBe('hidden');const pay=r.root.findByType(Button);expect(pay.props.style.alignSelf).toBe('stretch');expect(pay.props.label).toBe('Pay ₹4,218');expect(pay.props.onPress).toBe(props.onPay);await act(async()=>r.unmount())});
