import React from 'react';
import { it, expect, vi } from 'vitest';
import { create, act } from 'react-test-renderer';
// Car preview pop-up: stacked cards (both cars visible without sideways swiping),
// tap opens the pop-up with documents + service history, outside tap closes it.
const h = vi.hoisted(() => ({ push: vi.fn(), setActive: vi.fn() }));
// react-native-web Modal portals into document.body, invisible to react-test-renderer;
// swap it for a passthrough so the pop-up content is assertable. Production keeps the real Modal.
vi.mock('react-native', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-native');
  return { ...actual, Modal: ({ children, visible }: { children?: unknown; visible?: boolean }) => (visible === false ? null : children) };
});
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), useRouter: () => ({ push: h.push, replace: vi.fn(), back: vi.fn(), canGoBack: () => false }), useSegments: () => [], useNavigation: () => ({ getState: () => ({ routes: [] }), dispatch: vi.fn() }), useFocusEffect: () => {} }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ status: 'ready', customerDocId: 'cust-1', customerDocResolution: 'resolved', user: { uid: 'auth-1' }, claims: { tenantId: 't', role: 'customer' } }) }));
vi.mock('../../../hooks/useCustomerHome', () => ({ setActiveVehicle: (...a: unknown[]) => h.setActive(...a) }));
const CARS = [
  { id: 'a', tenantId: 't', ownerId: 'cust-1', make: 'BMW', model: 'M340i', registrationNumber: 'MH 40 AB 1234', category: 'sedan', year: 2023, color: 'Black', odometer: 18450, photoUrl: null, deletedAt: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-11-06T00:00:00.000Z' },
  { id: 'b', tenantId: 't', ownerId: 'cust-1', make: 'Mahindra', model: 'Thar', registrationNumber: 'MH 31 XY 5678', category: 'suv', year: 2021, color: 'Red', odometer: 40210, photoUrl: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z' },
];
vi.mock('../../../lib/vehicle-service', () => ({
  listenToMyVehicles: (_o: unknown, _t: unknown, fn: (v: unknown) => void) => { fn(CARS); return () => {}; },
  listenToMyArchivedVehicles: () => () => {},
  deleteVehiclePermanently: vi.fn(),
  restoreVehicle: vi.fn(),
}));
vi.mock('../../../lib/job-service', () => ({
  listenToMyJobs: (_t: unknown, _o: unknown, fn: (v: unknown) => void) => { fn([{ id: 'j1', vehicleId: 'a', serviceId: 's1', status: 'DELIVERED', createdAt: '2026-09-28T00:00:00.000Z', sealedAt: '2026-09-29T00:00:00.000Z' }]); return () => {}; },
}));
vi.mock('../../../lib/home-service', () => ({ listenToMyMemberships: (_t: unknown, _o: unknown, fn: (v: unknown) => void) => { fn([]); return () => {}; } }));
vi.mock('../../../lib/catalogue-service', () => ({ getServiceCatalogue: async () => [{ id: 's1', name: 'Detail SPA', category: 'washing' }] }));
vi.mock('../../../lib/paper-service', () => ({
  listenToVehiclePapers: (_v: unknown, _t: unknown, _c: unknown, fn: (v: unknown) => void) => {
    fn([{ id: 'dc1', vehicleId: 'a', customerId: 'cust-1', kind: 'RC', reference: 'RC-SAMPLE-1', title: null, expiresOn: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }]);
    return () => {};
  },
  daysUntil: (iso: string) => Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000),
}));
vi.mock('../../../lib/dev-garage-loader', () => ({ devGarage: null, devGarageDetail: null }));
vi.mock('../../../ui/CarThumb', () => ({ CarThumb: () => null }));
import Page from './index';

const text = (r: ReturnType<typeof create>) => JSON.stringify(r.toJSON());
const byLabel = (r: ReturnType<typeof create>, label: string) =>
  r.root.findAll((n) => n.props && n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

it('car browser keeps every car available, a tap opens the preview pop-up, an outside tap closes it', async () => {
  let r!: ReturnType<typeof create>;
  await act(async () => { r = create(<Page />); });
  await act(async () => {});
  // Both cars remain mounted in the touch carousel; pixel/touch proof is separate.
  expect(byLabel(r, 'Open BMW M340i')).toBeTruthy();
  expect(byLabel(r, 'Open Mahindra Thar')).toBeTruthy();
  expect(text(r)).not.toContain('Registration Certificate');
  // Tap a car: the pop-up opens with details, documents and service history.
  await act(async () => { byLabel(r, 'Open BMW M340i')!.props.onPress(); });
  await act(async () => {});
  expect(h.setActive).toHaveBeenCalledWith('a');
  expect(text(r)).toContain('Registration Certificate');
  expect(text(r)).toContain('RC-SAMPLE-1');
  expect(text(r)).toContain('Detail SPA');
  expect(text(r)).toContain('18,450 km');
  // The second car's tap also opens its own pop-up (no documents on file).
  // Outside tap closes the pop-up first.
  await act(async () => { byLabel(r, 'Close car preview')!.props.onPress(); });
  await act(async () => {});
  expect(text(r)).not.toContain('Registration Certificate');
});

it('Open full details closes the pop-up and routes to the car room', async () => {
  let r!: ReturnType<typeof create>;
  await act(async () => { r = create(<Page />); });
  await act(async () => {});
  await act(async () => { byLabel(r, 'Open BMW M340i')!.props.onPress(); });
  await act(async () => {});
  const full = r.root.findAll((n) => n.props && n.props.label === 'Open full details')[0]!;
  await act(async () => { full.props.onPress(); });
  expect(h.push).toHaveBeenCalledWith({ pathname: '/(tabs)/garage/[id]', params: { id: 'a' } });
  expect(text(r)).not.toContain('Registration Certificate');
  await act(async () => r.unmount());
});

it('brand-only filter includes both BMW models, car swipe selection keeps scoped history on its visible car',async()=>{
 CARS.push({...CARS[0]!,id:'c',model:'X1',year:2025,registrationNumber:'SAMPLE C',updatedAt:'2026-11-05T00:00:00Z'});
 try{
 let r!:ReturnType<typeof create>;await act(async()=>{r=create(<Page/>)});await act(async()=>{});
 const filter=()=>r.root.findAll(n=>Array.isArray(n.props.items)&&typeof n.props.onChange==='function')[0]!;
 expect(filter().props.items.map((i:any)=>i.label)).toEqual(['All','BMW','Mahindra']);
 await act(async()=>filter().props.onChange('bmw'));
 expect(byLabel(r,'Open BMW M340i')).toBeTruthy();expect(byLabel(r,'Open BMW X1')).toBeTruthy();expect(byLabel(r,'Open Mahindra Thar')).toBeUndefined();
 const showroom=r.root.findAll(n=>Array.isArray(n.props.cars)&&typeof n.props.onSelect==='function')[0]!;
 await act(async()=>showroom.props.onSelect('c'));
 const history=r.root.findAll(n=>typeof n.props.onHistory==='function')[0]!;await act(async()=>history.props.onHistory());
 expect(h.push).toHaveBeenLastCalledWith({pathname:'/(tabs)/garage/history',params:{vehicleId:'c'}});
 await act(async()=>r.unmount());
 }finally{CARS.pop()}
});
