import React from 'react';
import { it, expect, vi } from 'vitest';
// Visual harness: renders the REAL garage screen (index.tsx) in every owner
// state the identity fix can produce, with real kit components and the REAL
// experience theme via react-native-web SSR. Mirrors the app root:
// setSurfaceMode(name) is called before each render exactly as
// app/_layout.tsx does. Output HTML is screenshotted headlessly at 320px
// for pixel review - one file per state per theme.
const h = vi.hoisted(() => ({
  auth: { status: 'ready', customerDocId: null as string | null, customerDocResolution: 'absent', user: { uid: 'auth-1' }, claims: { tenantId: 't', role: 'customer' } } as any,
  vehicleSubs: [] as any[],
  params: {} as Record<string, string>,
}));
vi.mock('@autodeck/ui/native', async () => {
  const real = await import('../../../../../../packages/ui/src/native/ThemeContext');
  return {
    useExperienceTheme: real.useExperienceTheme,
    ExperienceThemeProvider: real.ExperienceThemeProvider,
    Ambient: ({ children }: any) => children ?? null,
    onTabPressed: () => () => {},
    Icon: () => null,
    FadeImage: (props: any) => React.createElement('img', { src: props?.source?.uri, style: props?.style }),
  };
});
vi.mock('expo-router', () => ({ useLocalSearchParams: () => h.params, useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), useNavigation: () => ({ getState: () => ({ routes: [] }), dispatch: vi.fn() }), useSegments: () => [], useFocusEffect: () => {} }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => h.auth }));
vi.mock('../../../hooks/useCustomerHome', () => ({ setActiveVehicle: vi.fn() }));
vi.mock('../../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: (_: any, c: any, id: any) => ({ c, id }), getDoc: async () => ({ exists: () => false, data: () => ({}) }) }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null } }));
vi.mock('../../../lib/imagery', () => ({ sceneImagery: {}, serviceImagery: {} }));
vi.mock('../../../lib/vehicle-service', () => ({ listenToMyVehicles: (o: any, t: any, fn: any) => { h.vehicleSubs.push([o, t]); fn([]); return () => {}; }, listenToMyArchivedVehicles: () => () => {}, deleteVehiclePermanently: vi.fn(), restoreVehicle: vi.fn() }));
vi.mock('../../../lib/job-service', () => ({ listenToMyJobs: (_t: any, _o: any, fn: any) => { fn([]); return () => {}; } }));
vi.mock('../../../lib/home-service', () => ({ listenToMyMemberships: (_t: any, _o: any, fn: any) => { fn([]); return () => {}; } }));
vi.mock('../../../lib/catalogue-service', () => ({ getServiceCatalogue: async () => [] }));
vi.mock('../../../lib/paper-service', () => ({ listenToVehiclePapers: (_v: any, _t: any, _c: any, fn: any) => { fn([]); return () => {}; }, daysUntil: () => null }));
vi.mock('../../../lib/dev-garage-loader', async () => {
  const real = await vi.importActual<any>('../../../lib/garage-dev-sample');
  return { devGarage: real.devGarage, devGarageDetail: real.devGarageDetail ?? null };
});

// @ts-expect-error server-render harness
import { renderToStaticMarkup } from 'react-dom/server';
import { StyleSheet, View } from 'react-native';
import { writeFileSync } from 'node:fs';
import { ExperienceThemeProvider } from '@autodeck/ui/native';
import { setSurfaceMode } from '../../../lib/glass';
import Garage from './index';

const STATES: Array<{ label: string; auth: any; expectText: string; params?: Record<string, string> }> = [
  { label: 'owner-error', auth: { status: 'ready', customerDocId: null, customerDocResolution: 'error', user: { uid: 'auth-1' }, claims: { tenantId: 't', role: 'customer' } }, expectText: 'confirm your profile' },
  { label: 'claim-pending', auth: { status: 'ready', customerDocId: null, customerDocResolution: 'claim-required', user: { uid: 'auth-1' }, claims: { tenantId: 't', role: 'customer' } }, expectText: 'waiting to be claimed' },
  { label: 'customer-absent', auth: { status: 'ready', customerDocId: null, customerDocResolution: 'absent', user: { uid: 'auth-1' }, claims: { tenantId: 't', role: 'customer' } }, expectText: 'find your profile' },
  // Staff layout proof: the dev sample seeds the screen synchronously, so SSR
  // shows the real populated/empty layout (header, cards, nav) for a
  // legacy-self staff account - the states an effect-driven render cannot reach.
  { label: 'staff-empty', auth: { status: 'ready', customerDocId: null, customerDocResolution: 'absent', user: { uid: 'auth-1' }, claims: { tenantId: 't', role: 'admin' } }, expectText: 'No cars yet', params: { mock: '1', empty: '1' } },
  { label: 'staff-populated', auth: { status: 'ready', customerDocId: null, customerDocResolution: 'absent', user: { uid: 'auth-1' }, claims: { tenantId: 't', role: 'admin' } }, expectText: 'Mahindra', params: { mock: '1' } },
];

// SSR does not run effects, so the data-driven empty state cannot render
// here; what proves the two staff paths is the SUBSCRIPTION key each uses.
it('staff legacy-self subscribes with the own-uid key; resolved staff with the canonical id', async () => {
  const { create, act } = await import('react-test-renderer');
  h.vehicleSubs.length = 0;
  h.auth = { status: 'ready', customerDocId: null, customerDocResolution: 'absent', user: { uid: 'auth-1' }, claims: { tenantId: 't', role: 'admin' } };
  setSurfaceMode('night');
  let r: any;
  await act(async () => { r = create(<Garage />); });
  expect(h.vehicleSubs[0]).toEqual(['auth-1', 't']);
  await act(async () => { r.unmount(); });
  h.vehicleSubs.length = 0;
  h.auth = { status: 'ready', customerDocId: 'staged-9', customerDocResolution: 'resolved', user: { uid: 'auth-1' }, claims: { tenantId: 't', role: 'admin' } };
  await act(async () => { r = create(<Garage />); });
  expect(h.vehicleSubs[0]).toEqual(['staged-9', 't']);
  await act(async () => { r.unmount(); });
  h.vehicleSubs.length = 0;
  // customer role with ANY unresolved state never subscribes
  for (const resolution of ['absent', 'error', 'claim-required']) {
    h.auth = { status: 'ready', customerDocId: null, customerDocResolution: resolution, user: { uid: 'auth-1' }, claims: { tenantId: 't', role: 'customer' } };
    await act(async () => { r = create(<Garage />); });
    await act(async () => { r.unmount(); });
  }
  expect(h.vehicleSubs).toHaveLength(0);
});

it('renders every garage owner state in day and night for pixel inspection', () => {
  const files: string[] = [];
  for (const name of ['light', 'night'] as const) {
    for (const st of STATES) {
      h.auth = st.auth;
      h.params = st.params ?? {};
      setSurfaceMode(name); // same call the app root makes before rendering children
      const body = renderToStaticMarkup(
        <ExperienceThemeProvider name={name}>
          <View style={{ width: 320, backgroundColor: name === 'light' ? '#ECEBF8' : '#0A0B0D' }}>
            <Garage />
          </View>
        </ExperienceThemeProvider>
      );
      expect(body).toContain(st.expectText);
      // The mislabeled connection error must never appear in owner states.
      expect(body).not.toContain('Check your connection');
      // Owner states never trap on the spinner.
      expect(body).not.toContain('Opening your garage');
      const css = (StyleSheet as any).getSheet().textContent;
      const file = `/tmp/garage-state-${st.label}-${name === 'light' ? 'day' : 'night'}.html`;
      writeFileSync(file, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${css}</style>${body}`);
      files.push(file);
    }
  }
  expect(files).toHaveLength(10);
});
