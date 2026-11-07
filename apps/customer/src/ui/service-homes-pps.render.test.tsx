import React from 'react';
import { it, expect, vi } from 'vitest';
vi.mock('react-native', async () => { const actual = await vi.importActual<any>('react-native'); return { ...actual, Image: 'Image' }; });
vi.mock('./ServicePhoto', () => ({ ServicePhoto: () => null }));
vi.mock('./AppBar', () => ({ AppBar: () => null }));
import { create, act } from 'react-test-renderer';
import { Pressable } from 'react-native';
import { ServiceHomes } from './ServiceHomes';
import { Button } from './kit';

it('Paint Protection serves the PPS service concept as an honest brand-less enquiry, never a product', async () => {
  let enquired = '';
  let r: any;
  await act(async () => { r = create(<ServiceHomes services={[]} priceLabel={() => null} onOpen={() => {}} onReference={(k) => { enquired = k; }} />); });
  await act(async () => r.root.findAllByType(Pressable)[0].props.onPress()); // first home = Paint Protection
  let text = JSON.stringify(r.toJSON());
  expect(text).toContain('PPS'); // family concept present even with zero stock
  await act(async () => r.root.findAllByType(Button).find((b: any) => b.props.label === 'PPS').props.onPress());
  await act(async () => r.root.findAllByType(Button).find((b: any) => b.props.label === 'Range to confirm').props.onPress());
  text = JSON.stringify(r.toJSON());
  expect(text).toContain('PPS - spray-on paint protection');
  expect(text).toContain('Ask the studio about the product and coverage');
  expect(text).toContain('Request a quote');
  expect(text).not.toMatch(/₹|price/i);
  await act(async () => r.root.findAllByType(Pressable).find((p: any) => p.findAll((n: any) => n.props.children === 'PPS - spray-on paint protection').length > 0).props.onPress());
  expect(enquired).toBe('pps-spray');
  await act(async () => r.unmount());
});
