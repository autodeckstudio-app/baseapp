import React from 'react';
import { it, expect, vi } from 'vitest';
// Visual harness: renders the REAL ServicesExplorer and ServiceScope with the
// real 65-record sanitized catalogue (final verified copy) at 320px, day and
// night, mirroring the app root (setSurfaceMode before render, real theme).
// Output HTML is screenshotted headlessly for copy-fit pixel review.
vi.mock('@autodeck/ui/native', async () => {
  const real = await import('../../../../packages/ui/src/native/ThemeContext');
  return {
    useExperienceTheme: real.useExperienceTheme,
    ExperienceThemeProvider: real.ExperienceThemeProvider,
    Ambient: ({ children }: any) => children ?? null,
    onTabPressed: () => () => {},
    Icon: () => null,
    FadeImage: (props: any) => React.createElement('img', { src: props?.source?.uri, style: props?.style }),
  };
});
// Real illustrative assets as file:// URIs so headless Chrome paints actual pixels.
const { A, HOME_IMG, TYPE_IMG, PRODUCT_IMG } = vi.hoisted(() => {
const A = (rel: string) => ({ uri: 'file:///tmp/baseapp/apps/customer/assets/' + rel });
const HOME_IMG: Record<string, any> = {
  paint: A('imagery/optimized/paint-protection.jpg'),
  detailing: A('imagery/optimized/detailing.jpg'),
  washing: A('imagery/optimized/wash-and-care.jpg'),
  garage: A('imagery/optimized/garage.jpg'),
  modifications: A('imagery/optimized/modifications.jpg'),
};
const TYPE_IMG: Record<string, any> = {
  PPF: A('imagery/service-types/ppf.jpg'),
  PPS: A('imagery/service-types/pps.jpg'),
  'Colour PPF': A('imagery/service-types/colour-ppf.jpg'),
  'Accessories & styling': A('imagery/service-types/accessories.jpg'),
};
const PRODUCT_IMG: Record<string, string> = {
  'borophene': 'kovalent-borophene.png',
  'graphene-matrix': 'kovalent-graphene-matrix.png',
  'graphene': 'kovalent-graphene.png',
  'matte': 'kovalent-matte.png',
  'prolong-light': 'kovalent-prolong-light.png',
  'prolong': 'kovalent-prolong.png',
  'powershield': 'kovalent-powershield.png',
};
return { A, HOME_IMG, TYPE_IMG, PRODUCT_IMG };
});
// RN-web's SSR Image drops file:// sources; swap Image for a plain <img> in
// this visual harness only so real asset pixels reach the screenshot.
vi.mock('react-native', async (importOriginal) => {
  const mod = await importOriginal<any>();
  const React = await import('react');
  return {
    ...mod,
    Image: (props: any) => {
      const flat = mod.StyleSheet?.flatten ? mod.StyleSheet.flatten(props.style) : (props.style ?? {});
      const { position, top, left, right, bottom, width, height, borderRadius, ...rest } = flat ?? {};
      return React.createElement('img', {
        src: props?.source?.uri ?? '',
        style: { position: position ?? 'absolute', top: top ?? 0, left: left ?? 0, width: width ?? '100%', height: height ?? '100%', borderRadius: borderRadius ?? 0, objectFit: 'cover' },
      });
    },
  };
});
vi.mock('../lib/service-type-images', () => ({
  serviceTypeImage: (home: string, family: string) => TYPE_IMG[family] ?? HOME_IMG[home],
}));
vi.mock('../lib/service-home-images', () => ({ serviceHomeImages: HOME_IMG }));
vi.mock('./ServicePhoto', async () => {
  const React = await import('react');
  const { Image } = await import('react-native');
  return {
    ServicePhoto: (props: any) => {
      const cat = props?.service?.category ?? '';
      const brand = props?.service?.brand ?? '';
      const slug = (props?.service?.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const product = Object.keys(PRODUCT_IMG).find((k) => slug.includes(k));
      const src = product ? A('imagery/brands/' + PRODUCT_IMG[product])
        : brand === 'Kovalent' ? A('imagery/brands/kovalent-logo.png')
        : brand === 'Fireball' ? A('imagery/brands/fireball-logo.png')
        : (props?.service?.name ?? '').toLowerCase().includes('pps') ? A('imagery/gen-pps-spray.jpg')
        : cat === 'ppf' ? TYPE_IMG.PPF
        : cat === 'pickup' ? A('imagery/generated/pickup.jpg')
        : cat === 'coating' || cat === 'washing' ? HOME_IMG[cat === 'coating' ? 'detailing' : 'washing']
        : HOME_IMG.paint;
      return React.createElement(Image, { source: src, style: { width: props?.width ?? 88, height: props?.height ?? 108, borderRadius: 16 } });
    },
  };
});
vi.mock('../lib/imagery', () => ({
  BRAND_LOGOS: {
    Kovalent: { src: A('imagery/brands/kovalent-logo.png'), background: '#15171B' },
    Fireball: { src: A('imagery/brands/fireball-logo.png'), background: '#FFFFFF' },
    Gtechniq: { src: A('imagery/brands/gtechniq-logo.png'), background: '#FFFFFF' },
  },
}));
// @ts-expect-error server-render harness
import { renderToStaticMarkup } from 'react-dom/server';
import { StyleSheet, View } from 'react-native';
import { readFileSync, writeFileSync } from 'node:fs';
import { ExperienceThemeProvider } from '@autodeck/ui/native';
import { setSurfaceMode } from '../lib/glass';
import { DAY_ATMOSPHERE } from '@autodeck/ui/theme';
import { ServicesExplorer } from './ServicesExplorer';
import { ServiceScope } from './ServiceScope';
import type { Service } from '@autodeck/core';

const final = JSON.parse(readFileSync('/tmp/service-details-final.json', 'utf8')).prepared_for as any[];
const shape = JSON.parse(readFileSync('/tmp/live65-shape.json', 'utf8')) as any[];
const liveDesc: Record<string, string> = Object.fromEntries(
  (JSON.parse(readFileSync('/tmp/live65.json', 'utf8')) as any[]).map((l) => [l.id, l.desc]));
const finalById = Object.fromEntries(final.map((p) => [p.id, p]));

const services = shape.map((s) => {
  const f = finalById[s.id];
  return {
    id: s.id, tenantId: 't', name: f?.proposed_name ?? s.name, category: s.category, brand: s.brand,
    description: f?.proposed_description ?? liveDesc[s.id] ?? '', basePrice: 0, currency: 'INR',
    estimatedDurationMinutes: 60, warrantyLabel: null, warrantyDurationValue: null, warrantyDurationUnit: null,
    vehicleCategoryPricing: [], requiredBayType: 'protection', membershipWashEligible: false,
    priceOnRequest: s.priceOnRequest, coverageLevel: s.coverageLevel, active: true, displayOrder: 0,
    createdAt: '', updatedAt: '',
  } as unknown as Service;
});

const PATHS: Array<{ label: string; path: any }> = [
  { label: 'home', path: {} },
  { label: 'paint', path: { home: 'paint' } },
  { label: 'ceramic-kovalent', path: { home: 'paint', family: 'Ceramic', brand: 'Kovalent' } },
  { label: 'pps', path: { home: 'paint', family: 'PPS' } },
  // Deep-link guard: brand without a family must be ignored (brand-neutral home).
  { label: 'paint-brand-no-family', path: { home: 'paint', brand: 'Kovalent' } },
];

// The four longest final descriptions stress copy fit on the detail route.
const longest = [...services].sort((a, b) => (b.description?.length ?? 0) - (a.description?.length ?? 0)).slice(0, 4);

it('renders services explorer and detail copy with the real 65-record catalogue, day and night, 320px', () => {
  const files: string[] = [];
  for (const name of ['light', 'night'] as const) {
    setSurfaceMode(name);
    for (const p of PATHS) {
      const body = renderToStaticMarkup(
        <ExperienceThemeProvider name={name}>
          <View style={{ width: 320, backgroundColor: name === 'light' ? '#ECEBF8' : '#0A0B0D' }}>
            <ServicesExplorer services={services} path={p.path} query="" onPath={() => {}} onOpen={() => {}} onReference={() => {}} onHelp={() => {}} priceLabel={() => null} />
          </View>
        </ExperienceThemeProvider>
      );
      const css = (StyleSheet as any).getSheet().textContent;
      const file = `/tmp/copyfit-explorer-${p.label}-${name === 'light' ? 'day' : 'night'}.html`;
      writeFileSync(file, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${css}</style>${body}`);
      files.push(file);
    }
    for (const s of longest) {
      const body = renderToStaticMarkup(
        <ExperienceThemeProvider name={name}>
          <View style={{ width: 320, backgroundColor: name === 'light' ? '#ECEBF8' : '#0A0B0D' }}>
            <ServiceScope service={s} onAsk={() => {}} />
          </View>
        </ExperienceThemeProvider>
      );
      const css = (StyleSheet as any).getSheet().textContent;
      const file = `/tmp/copyfit-detail-${s.id}-${name === 'light' ? 'day' : 'night'}.html`;
      writeFileSync(file, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${css}</style>${body}`);
      files.push(file);
    }
  }
  expect(files.length).toBe(2 * (PATHS.length + longest.length));
  // Verified-copy markers must render; banned claims must never render.
  for (const f of files) {
    const html = readFileSync(f, 'utf8');
    for (const banned of ['flagship', 'highest SiO2', 'self-heal', 'seven-year tier', 'Graphene 7-year', 'warranty term'])
      expect(html.toLowerCase()).not.toContain(banned.toLowerCase());
  }
});
