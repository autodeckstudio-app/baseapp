import React from 'react';
import {it,expect,vi} from 'vitest';
import {act,create} from 'react-test-renderer';
import {Pressable,View} from 'react-native';
import {readFileSync} from 'node:fs';
import {GarageBookingRow} from './GarageBookingRow';
import {Chip,T} from './kit';
it('compact Garage booking keeps a single target, centred status and no absent-detail lane',async()=>{let r:any;const open=vi.fn();await act(async()=>{r=create(<GarageBookingRow title='21 Oct at 14:30' status='ACTIVE' onPress={open} last/>)});const p=r.root.findByType(Pressable);expect(p.props.style({pressed:false})).toMatchObject({minHeight:56,paddingVertical:8,alignItems:'center',borderBottomWidth:0});expect(r.root.findAllByType(T)).toHaveLength(2);expect(r.root.findByType(Chip).props.label).toBe('ACTIVE');await act(async()=>p.props.onPress());expect(open).toHaveBeenCalledOnce();await act(async()=>r.update(<GarageBookingRow title='Visit' detail='Wash' status='PENDING' onPress={open} last={false}/>));expect(r.root.findAllByType(T)).toHaveLength(3);await act(async()=>r.unmount())});
it('invoice download/share use the same horizontal action container without changing handlers',()=>{const s=readFileSync(new URL('../app/(tabs)/bookings/invoice.tsx',import.meta.url),'utf8');expect(s).toContain('testID="invoice-actions" style={{flexDirection:"row",alignItems:"center",gap:12,flexWrap:"wrap"}}');expect(s).toContain('label="Download PDF"');expect(s).toContain('label="Share"');});
