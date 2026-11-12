// Legacy contract: explicitly select the unchanged non-combined client path.
vi.mock('../../../lib/combined-checkout',async orig=>({...await orig<any>(),COMBINED_CHECKOUT_ENABLED:false}));
import React from 'react';
import { it, expect, vi, beforeEach } from 'vitest';
import { create, act } from 'react-test-renderer';
// Mounted proof that a server-quoted pickup/drop fee rides INSIDE the shown
// Total while the split stays honest: "Pay online now" never includes the fee
// (the fee is paid at the studio) and the fee line says exactly that.
const h = vi.hoisted(() => ({
  params: { serviceId: 'svc', vehicleId: 'car', vehicleCategory: 'suv', scheduledDate: '2099-01-01', scheduledTime: '10:00' } as Record<string, string>,
  create: vi.fn(), open: vi.fn(), pay: vi.fn(), replace: vi.fn(), job: vi.fn(), key: 0,
  quote: vi.fn(),
}));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => h.params, useRouter: () => ({ replace: h.replace, push: vi.fn(), back: vi.fn() }) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ status: 'ready', customerDocId: 'canonical', user: { uid: 'auth' }, claims: { tenantId: 't' } }) }));
vi.mock('../../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: (_: unknown, c: string, id: string) => ({ c, id }), getDoc: async (ref: { id: string }) => ({ exists: () => true, data: () => ref.id === 'car' ? { make: 'Demo', model: 'Car', registrationNumber: 'SAMPLE' } : { id: ref.id, name: ref.id, estimatedDurationMinutes: 60, priceOnRequest: false, onlinePaymentEnabled: true, payAtStudioEnabled: true } }) }));
vi.mock('../../../lib/booking-service', () => ({ createBooking: (x: unknown) => h.create(x), generateIdempotencyKey: () => `intent-${++h.key}`, getStudioInfo: async () => ({ operatingHours: [] }) }));
vi.mock('../../../lib/catalogue-service', () => ({ calculateServicePrice: async () => ({ breakdown: { basePrice: 10000, subtotal: 10000, total: 10000, tax: 0, scopeAdjustment: 0, membershipDiscount: null } }) }));
vi.mock('../../../lib/job-service', () => ({ getJobIdForBooking: (...a: unknown[]) => h.job(...a) }));
vi.mock('../../../lib/payment-service', () => ({ initiatePayment: (...a: unknown[]) => h.pay(...a), requestAdvancePayment: vi.fn() }));
vi.mock('../../../lib/razorpay-checkout', () => ({ payOnline: (...a: unknown[]) => h.open(...a), payWithPaymentLink: vi.fn() }));
vi.mock('../../../lib/gift', () => ({ GIFT_LIVE: false, takePendingGiftCode: () => null }));
vi.mock('../../../lib/advance-booking', () => ({ ADVANCE_SPLIT_ENABLED: false, advanceDisclosureLines: () => ({}), advancePreviewFromParts: () => null, needsBookingAdvance: () => false }));
vi.mock('../../../lib/referral', () => ({ REFERRAL_LIVE: false, normaliseReferralCode: () => null, referralCodeToSend: () => null }));
vi.mock('../../../lib/membership-wash', () => ({ MEMBERSHIP_WASH_LIVE: false, pickWash: () => null, todayInIndia: () => '' }));
vi.mock('../../../lib/membership-service', () => ({ getMyMemberships: async () => [], getMembershipPlans: async () => [] }));
vi.mock('../../../lib/pickup-service', () => ({ getDeviceLocation: async () => ({ lat: 23.03, lng: 72.58 }), getPickupQuote: (...a: unknown[]) => h.quote(...a), requestPickupDrop: vi.fn(), describePickupQuote: () => '' }));
vi.mock('../../../ui/ServicePhoto', () => ({ ServicePhoto: () => null }));
vi.mock('expo/fetch', () => ({ fetch: vi.fn() }));
vi.mock('@autodeck/core', async (importOriginal) => ({ ...await importOriginal<Record<string, unknown>>(), bookingPayment: () => ({ online: true, studioChoice: true }) }));
vi.mock('../../../ui/kit', () => ({ Button: 'Button', Field: 'Field', Kicker: 'Kicker', Loading: 'Loading', Notice: ({ title, body, action }: any) => React.createElement('notice', { title, body }, action), Pane: 'Pane', Row: ({ title, detail, trailing }: any) => React.createElement('row', null, title, detail, trailing), Screen: ({ header, children }: any) => React.createElement('screen', null, header, children), T: 'T', rupees: String }));
vi.mock('../../../ui/Sheet', () => ({ Sheet: 'Sheet', SheetTotal: 'SheetTotal', SheetLine: 'SheetLine', SheetDivider: 'SheetDivider' }));
vi.mock('../../../ui/inputs', () => ({ SelectField: 'SelectField' }));
import{pickupDraftScope,updatePickupDraft}from'../../../lib/pickup-draft';
import Page from './confirm';

const draftScope=pickupDraftScope({uid:'auth',customerId:'canonical',tenantId:'t'},'svc');
beforeEach(() => {
  updatePickupDraft(draftScope,{kind:null,address:'',where:null,quote:null});
  h.quote.mockReset();
  h.quote.mockResolvedValue({ quoteId: 'q1', kind: 'pickup', legs: [{ leg: 'pickup', km: 5.2, feePaise: 5500 }], feePaise: 5500, freeMeters: 3000, expiresAt: new Date(Date.now() + 1800000).toISOString() });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const button = (r: any, label: string) => r.root.findAll((x: { props: { label?: string; accessibilityLabel?: string; onPress?: unknown } }) => !!x.props.onPress && (x.props.label === label || x.props.accessibilityLabel === label))[0];

it('a quoted pickup fee rides inside the shown Total while Pay online now excludes it and the fee is marked paid at the studio', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r: any;
  await act(async () => { r = create(<Page />); });
  await act(async () => { button(r, 'Pickup').props.onPress(); });
  await act(async () => { button(r, 'Check distance using my current location').props.onPress(); await Promise.resolve(); await Promise.resolve(); });
  expect(h.quote).toHaveBeenCalledWith({ kind: 'pickup', lat: 23.03, lng: 72.58 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const total = r.root.findAllByType('SheetTotal').find((x: any) => x.props.label === 'Total');
  expect(total.props.value).toBe('15500'); // 10000 booking total + 5500 quoted pickup fee, one shown Total
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lines = r.root.findAllByType('SheetLine');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fee = lines.find((x: any) => x.props.label === 'Pickup/drop');
  expect(fee.props.value).toBe('5500 · paid at the studio'); // the fee line names where it is paid
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const online = lines.find((x: any) => x.props.label === 'Pay online now');
  expect(online.props.value).toBe('10000'); // the online charge never includes the fee
  await act(async () => r.unmount());
});

it('booking-review transport draft survives remount without clearing its exact directed quote',async()=>{updatePickupDraft(draftScope,{kind:'both',address:'Reviewed sample address',where:{lat:23,lng:72},quote:{quoteId:'asymmetric',kind:'both',legs:[{leg:'pickup',km:4,feePaise:2500},{leg:'drop',km:5,feePaise:5000}],feePaise:7500,freeMeters:3000,expiresAt:new Date(Date.now()+1800000).toISOString()}});let r:any;await act(async()=>{r=create(<Page/>)});const total=r.root.findAllByType('SheetTotal').find((x:any)=>x.props.label==='Total');expect(total.props.value).toBe('17500');expect(button(r,'Both').props.accessibilityState.selected).toBe(true);await act(async()=>r.unmount());});
