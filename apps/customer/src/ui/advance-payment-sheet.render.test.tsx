import React from 'react';import {act,create,type ReactTestRenderer}from 'react-test-renderer';import {expect,it,vi}from 'vitest';import {Modal,Pressable}from 'react-native';import {AdvancePaymentSheet}from './AdvancePaymentSheet';import {Button}from './kit';
vi.mock('react-native',async()=>{const actual=await vi.importActual<any>('react-native');return{...actual,Modal:(p:any)=>React.createElement('Modal',p,p.visible?p.children:null)}});
const props={visible:true,serviceTotalPaise:250000,advancePaise:50000,balancePaise:200000,pickupFees:false,busy:false,onPayAdvance:vi.fn(),onGoBack:vi.fn()};
it('advance offer shows the service split, the actual-amount pay action and the adopted disclosures',async()=>{
  let r!:ReactTestRenderer;await act(async()=>{r=create(<AdvancePaymentSheet {...props}/>)});
  const text=JSON.stringify(r.toJSON());
  for(const s of ['Reserve your preferred slot','Service total','₹2,500','Booking advance (20%)','₹500','Balance at studio (80%)','₹2,000','Secure payment via Razorpay'])expect(text).toContain(s);
  // Owner-adopted disclosures stay before payment; no cancellation wording.
  expect(text).toContain('You pay 20% online now to confirm');
  expect(text).toContain('the studio keeps the 20% advance');
  expect(text).not.toContain('Pickup and drop charges are added');
  const buttons=r.root.findAllByType(Button);
  const pay=buttons.find((b:any)=>b.props.label==='Pay ₹500 advance');
  expect(pay).toBeTruthy();
  await act(async()=>pay!.props.onPress());expect(props.onPayAdvance).toHaveBeenCalledTimes(1);
  const back=buttons.find((b:any)=>b.props.label==='Go back');
  await act(async()=>back!.props.onPress());expect(props.onGoBack).toHaveBeenCalledTimes(1);
  // Backdrop dismiss routes to Go back as well.
  await act(async()=>r.root.findAllByType(Pressable).find((p:any)=>p.props.accessibilityLabel==='Go back')!.props.onPress());
  expect(props.onGoBack).toHaveBeenCalledTimes(2);
  await act(async()=>r.unmount());
});
it('pickup/drop choice adds the studio-charges note and keeps the service-total basis',async()=>{
  let r!:ReactTestRenderer;await act(async()=>{r=create(<AdvancePaymentSheet {...props} pickupFees/>)});
  const text=JSON.stringify(r.toJSON());
  expect(text).toContain('Pickup and drop charges are added to what you pay at the studio');
  expect(text).toContain('₹2,500');
  await act(async()=>r.unmount());
});
it('hidden sheet renders no content',async()=>{
  let r!:ReactTestRenderer;await act(async()=>{r=create(<AdvancePaymentSheet {...props} visible={false}/>)});
  expect(JSON.stringify(r.toJSON())).not.toContain('Reserve your preferred slot');
  await act(async()=>r.unmount());
});
