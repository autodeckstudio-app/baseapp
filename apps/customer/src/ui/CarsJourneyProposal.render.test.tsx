import React from 'react';
import {it,expect,vi} from 'vitest';
// @ts-expect-error workspace lacks react-dom server types
import {renderToStaticMarkup} from 'react-dom/server';
import {writeFileSync} from 'node:fs';
import {StyleSheet} from 'react-native';
import {applyCustomerRaisedTheme} from '@autodeck/ui/theme';
vi.mock('@autodeck/ui/native',async()=>{const t=await import('@autodeck/ui/theme');return {useExperienceTheme:()=>({name:'light',colors:t.lightColors}),useReduceTransparency:()=>false,LiquidGlass:({children}:any)=>children,Icon:()=>null};});
import{CarsJourneyProposal}from'./CarsJourneyProposal';
it('private journey preview makes no completed sale or activated consent claim',()=>{applyCustomerRaisedTheme();for(const stage of ['seller','buyer','admin'] as const){const body=renderToStaticMarkup(<CarsJourneyProposal stage={stage}/>);expect(body).toContain('Private proposal');expect(body).toContain('Preview only');expect(body).toContain('disabled');const css=(StyleSheet as any).getSheet().textContent;writeFileSync(`/tmp/combined56-cars-${stage}.html`,`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}html,body{margin:0;min-height:100vh;background:#efede8;font-family:Arial}</style>${body}`);}});
