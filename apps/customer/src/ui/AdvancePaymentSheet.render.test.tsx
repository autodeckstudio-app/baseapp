import React from 'react';
import { it, expect, vi } from 'vitest';
// @ts-expect-error workspace lacks react-dom server types
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { StyleSheet } from 'react-native';
import { applyCustomerRaisedTheme } from '@autodeck/ui/theme';
import { applyCustomerSoftNight } from '../lib/customer-night';
import { advancePreviewFromParts } from '../lib/advance-booking';
const h=vi.hoisted(()=>({name:'light' as 'light'|'night'}));
// Browser-only layout adapter: Modal portal becomes a full-height View. The
// actual sheet, money math, labels and kit render unchanged. Not device proof.
vi.mock('react-native',async(importOriginal)=>{const rn=await importOriginal<any>();return {...rn,Modal:({visible,children}:any)=>visible?React.createElement(rn.View,{style:{height:'100vh',display:'flex'}},children):null};});
vi.mock('@autodeck/ui/native',async()=>{const t=await import('@autodeck/ui/theme');return {useExperienceTheme:()=>({name:h.name,colors:h.name==='light'?t.lightColors:t.nightColors}),useReduceTransparency:()=>false,LiquidGlass:({children}:any)=>children,Icon:()=>null};});
import { AdvancePaymentSheet } from './AdvancePaymentSheet';
it('actual sheet keeps exact rounded amount/remainder, disclosures and Pay amount; renders controlled visual fixtures',()=>{
  applyCustomerRaisedTheme();applyCustomerSoftNight();
  const a=advancePreviewFromParts({subtotal:149901,pickupFee:0,dropFee:0,membershipDiscount:null,taxRatePercent:18})!;
  expect(a).toEqual({serviceTotalPaise:176883,advancePaise:35400,dueAtStudioPaise:141483});
  for(const name of ['light','night'] as const){h.name=name;const body=renderToStaticMarkup(<AdvancePaymentSheet visible serviceName="Sample ceramic service" visitLabel="Monday, 16 November · 10:00" serviceTotalPaise={a.serviceTotalPaise} advancePaise={a.advancePaise} balancePaise={a.dueAtStudioPaise} pickupFees busy={false} onPayAdvance={()=>{}} onGoBack={()=>{}}/>);expect(body).toContain('Sample ceramic service');expect(body).toContain('Monday, 16 November · 10:00');expect(body).toContain('Pay ₹354 advance');expect(body).toContain('₹1,414.83');expect(body).toContain('Nothing more is charged');expect(body).toContain('Pickup and drop');const css=(StyleSheet as any).getSheet().textContent;writeFileSync(`/tmp/payment55-sheet-${name}.html`,`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}html,body{margin:0;min-height:100vh;background:${name==='light'?'#efede8':'#101216'};font-family:Arial}</style>${body}`);}
});
