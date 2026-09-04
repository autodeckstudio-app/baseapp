import type { Service } from '@autodeck/domain';

/**
 * Fixture data. `serviceId`, `name`, `basePrice` are the REAL `Service`
 * fields from `@autodeck/domain`. `category`/`durationMinutes` are UI-only
 * proposed fields — the real schema does not have them yet (see the
 * customer-mobile design-gate review, Gate 6) — kept here only to show
 * what the catalogue UI will look like once that schema decision is made,
 * clearly marked, never presented as already real.
 */
export interface MockServiceRow extends Service {
  category: string;
  durationMinutes: number;
  active: boolean;
}

export const MOCK_SERVICES: MockServiceRow[] = [
  { serviceId: 'svc-ceramic-prolong', name: 'Ceramic Coating — Prolong', basePrice: 1_000_000, category: 'Ceramic Coating', durationMinutes: 480, active: true },
  { serviceId: 'svc-wash-premium', name: 'Premium Wash', basePrice: 100_000, category: 'Washing', durationMinutes: 60, active: true },
  { serviceId: 'svc-wash-detail-spa', name: 'Detail Spa', basePrice: 250_000, category: 'Washing', durationMinutes: 90, active: true },
  { serviceId: 'svc-glass-coating', name: 'Glass Coating', basePrice: 120_000, category: 'Other Coatings', durationMinutes: 60, active: false },
];
