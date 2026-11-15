import React from 'react';
import { it, expect, vi } from 'vitest';
// @ts-expect-error workspace lacks react-dom server declarations
import {renderToStaticMarkup} from 'react-dom/server';
import {writeFileSync} from 'node:fs';
import {StyleSheet,View} from 'react-native';
import {applyCustomerRaisedTheme} from '@autodeck/ui/theme';
import {applyCustomerSoftNight} from '../lib/customer-night';
const h=vi.hoisted(()=>({name:'light' as 'light'|'night'}));
vi.mock('@autodeck/ui/native',async()=>{const t=await import('@autodeck/ui/theme');return {useExperienceTheme:()=>({name:h.name,colors:h.name==='light'?t.lightColors:t.nightColors}),useReduceTransparency:()=>false,LiquidGlass:({children}:any)=>children,Icon:()=>null};});
import {Button,T,Pane} from './kit';
it('important words stay on compact48px controls and retain8px spacing even with adjacent siblings',()=>{
applyCustomerRaisedTheme();applyCustomerSoftNight();
for(const name of ['light','night'] as const){h.name=name;
const body=renderToStaticMarkup(<View style={{padding:20,gap:20}}><T role="caption">CONTROLLED PREVIEW · not deployed</T><Pane style={{gap:4}}><T role="heading">Keep important words</T><Button label="Review booking terms"/><Button label="Confirm service booking"/><Button label="Yes, remove" kind="danger"/></Pane></View>);
for(const word of ['Review booking terms','Confirm service booking','Yes, remove'])expect(body).toContain(`>${word}<`);
expect(body).toContain('margin-bottom:8px');expect(body).toContain('min-height:48px');
const css=(StyleSheet as any).getSheet().textContent;
writeFileSync(`/tmp/combined56-words-${name}.html`,`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}html,body{margin:0;background:${name==='light'?'#F8F6F2':'#24262A'}}</style>${body}`);
}});
