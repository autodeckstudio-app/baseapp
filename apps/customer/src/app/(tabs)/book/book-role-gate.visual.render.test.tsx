import React from 'react';
import { it, expect, vi } from 'vitest';
// Visual harness: renders the REAL BookingRoleGate (same component the booking
// screen gates on) with real kit components and the REAL experience theme,
// via react-native-web SSR markup. Mirrors the app root: setSurfaceMode(name)
// is called before each render exactly as app/_layout.tsx does. Output HTML is
// screenshotted headlessly at 320px for pixel review - one file per case.
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
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), useNavigation: () => ({ getState: () => ({ routes: [] }), dispatch: vi.fn() }), useSegments: () => [], useFocusEffect: () => {} }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ status: 'ready', customerDocId: null, user: { uid: 'auth' }, claims: { tenantId: 't', role: 'admin' } }) }));
vi.mock('../../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: (_: any, c: any, id: any) => ({ c, id }), getDoc: async () => ({ exists: () => false, data: () => ({}) }) }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null } }));
vi.mock('../../../lib/imagery', () => ({ sceneImagery: {}, serviceImagery: {} }));
vi.mock('../../../ui/CarThumb', () => ({ CarThumb: () => null }));
vi.mock('../../../lib/vehicle-service', () => ({ listenToMyVehicles: () => () => {}, updateVehicle: vi.fn() }));
vi.mock('../../../lib/booking-service', () => ({ getAvailability: async () => [], peekAvailability: () => null, todayIST: () => '2099-01-01', createBooking: vi.fn(), generateIdempotencyKey: () => 'k', getStudioInfo: async () => ({ operatingHours: [] }) }));
vi.mock('../../../lib/catalogue-service', () => ({ getServiceCatalogue: async () => [], calculateServicePrice: async () => ({ breakdown: {} }) }));
vi.mock('../../../lib/job-service', () => ({ getJobIdForBooking: vi.fn() }));
vi.mock('../../../lib/payment-service', () => ({ initiatePayment: vi.fn(), requestAdvancePayment: vi.fn() }));
vi.mock('../../../lib/razorpay-checkout', () => ({ payOnline: vi.fn(), payWithPaymentLink: vi.fn() }));
vi.mock('../../../lib/gift', () => ({ GIFT_LIVE: false, takePendingGiftCode: () => null }));
vi.mock('../../../lib/advance-booking', () => ({ ADVANCE_SPLIT_ENABLED: false, advanceDisclosureLines: () => ({}), advancePreviewFromParts: () => null, needsBookingAdvance: () => false }));
vi.mock('../../../lib/referral', () => ({ REFERRAL_LIVE: false, normaliseReferralCode: () => null, referralCodeToSend: () => null }));
vi.mock('../../../lib/membership-wash', () => ({ MEMBERSHIP_WASH_LIVE: false, pickWash: () => null, todayInIndia: () => '' }));
vi.mock('../../../lib/membership-service', () => ({ getMyMemberships: async () => [], getMembershipPlans: async () => [] }));
vi.mock('../../../lib/pickup-service', () => ({ getDeviceLocation: async () => null, getPickupQuote: vi.fn(), requestPickupDrop: vi.fn(), describePickupQuote: () => '' }));
vi.mock('../../../ui/ServicePhoto', () => ({ ServicePhoto: () => null }));
vi.mock('@autodeck/core', async (importOriginal) => ({ ...await importOriginal<any>(), bookingPayment: () => ({ online: false, studioChoice: true }) }));

// @ts-expect-error server-render harness
import { renderToStaticMarkup } from 'react-dom/server';
import { StyleSheet, View } from 'react-native';
import { writeFileSync } from 'node:fs';
import { ExperienceThemeProvider } from '@autodeck/ui/native';
import { setSurfaceMode } from '../../../lib/glass';
import { BookingRoleGate } from './[serviceId]';

it('renders both booking role-gate variants in day and night themes for pixel inspection', () => {
  const cases: Array<{ name: 'light' | 'night'; staff: boolean; file: string }> = [
    { name: 'light', staff: true, file: '/tmp/book-gate-staff-day.html' },
    { name: 'night', staff: true, file: '/tmp/book-gate-staff-night.html' },
    { name: 'light', staff: false, file: '/tmp/book-gate-unverified-day.html' },
    { name: 'night', staff: false, file: '/tmp/book-gate-unverified-night.html' },
  ];
  const bodies: string[] = [];
  for (const c of cases) {
    setSurfaceMode(c.name); // same call the app root makes before rendering children
    bodies.push(renderToStaticMarkup(
      <ExperienceThemeProvider name={c.name}>
        <View style={{ width: 320, padding: 16, backgroundColor: c.name === 'light' ? '#ECEBF8' : '#0A0B0D' }}>
          <BookingRoleGate staff={c.staff} onAccount={() => {}} onBrowse={() => {}} />
        </View>
      </ExperienceThemeProvider>
    ));
  }
  const css = (StyleSheet as any).getSheet().textContent;
  cases.forEach((c, i) => writeFileSync(c.file, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${css}</style>${bodies[i]}`));
  expect(bodies[0]).toContain('Booking uses a customer account');
  expect(bodies[2]).toContain('Customer profile could not be verified');
});
