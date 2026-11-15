import React from 'react';
import{it,expect,vi}from'vitest';
// @ts-expect-error workspace lacks react-dom server types
import{renderToStaticMarkup}from'react-dom/server';
import{writeFileSync}from'node:fs';
import{StyleSheet,View}from'react-native';
import{applyCustomerRaisedTheme}from'@autodeck/ui/theme';
import{applyCustomerSoftNight}from'../lib/customer-night';
import{setSurfaceMode}from'../lib/glass';
const h=vi.hoisted(()=>({name:'light' as 'light'|'night'}));
// Bounded SSR adapter preserves actual card inset. Decisive pixels use bundled
// actual LiquidGlass/ThemeProvider, not this adapter.
vi.mock('@autodeck/ui/native',async()=>{const t=await import('@autodeck/ui/theme');const rn=await import('react-native');return{useExperienceTheme:()=>({name:h.name,colors:h.name==='light'?t.lightColors:t.nightColors}),useReduceTransparency:()=>false,LiquidGlass:({children}:any)=>React.createElement(rn.View,{style:{padding:16}},children),Icon:()=>null};});
import{PickupOptions}from'./PickupOptions';
import{Kicker,Pane}from'./kit';
it('three compact labels share one row and preserve per-way road price and combined-total disclosure',()=>{applyCustomerRaisedTheme();applyCustomerSoftNight();for(const name of['light','night']as const){h.name=name;setSurfaceMode(name);for(const selected of[null,'pickup','drop','both']as const){const body=renderToStaticMarkup(<View style={{padding:16,gap:12,maxWidth:760,width:"100%",alignSelf:"center"}}><Kicker>Pickup and drop (optional)</Kicker><Pane pad="gap"><PickupOptions value={selected} onChange={()=>{}}/></Pane></View>);expect(body).toContain('Pickup');expect(body).toContain('Drop-off');expect(body).toContain('Both');expect(body).not.toContain('Pickup and drop</');if(selected){expect(body).not.toContain('final pickup/drop fee');expect(body).not.toContain('₹25');expect(body).not.toContain('included in the booking total');}const css=(StyleSheet as any).getSheet().textContent;writeFileSync(`/tmp/combined56-pickup-${name}-${selected??'none'}.html`,`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}html,body{margin:0;min-height:100vh;background:${name==='light'?'#efede8':'#101216'};font-family:Arial}</style>${body}`);}}});
