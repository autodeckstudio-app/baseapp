/**
 * Fixture data only — no backend/service catalogue endpoint exists yet.
 *
 * Fields `serviceId`, `name`, `basePrice` mirror the real
 * `packages/domain/src/types.ts` `Service` schema exactly (basePrice in
 * paise). `category`, `durationMinutes`, and `warrantyLabel` are UI-only
 * placeholders — FUTURE SCHEMA DEPENDENCY: `Service` has no such fields
 * today; ServiceCard/Service Detail need this domain schema extended
 * before real data can replace this file (see the approved design-gate
 * review, Gate 6).
 */
export interface MockService {
  serviceId: string;
  name: string;
  basePrice: number; // paise
  category: string;
  durationMinutes: number;
  warrantyLabel?: string;
  description: string;
}

export const MOCK_SERVICES: MockService[] = [
  {
    serviceId: 'svc-ceramic-prolong',
    name: 'Ceramic Coating — Prolong',
    basePrice: 1_000_000,
    category: 'Ceramic Coating',
    durationMinutes: 480,
    warrantyLabel: '2-year warranty',
    description: 'A durable ceramic layer that protects paint and holds a deep, glass-like gloss.',
  },
  {
    serviceId: 'svc-wash-premium',
    name: 'Premium Wash',
    basePrice: 100_000,
    category: 'Washing',
    durationMinutes: 60,
    description: 'A thorough hand wash with interior vacuuming and dashboard detailing.',
  },
  {
    serviceId: 'svc-wash-detail-spa',
    name: 'Detail Spa',
    basePrice: 250_000,
    category: 'Washing',
    durationMinutes: 90,
    description: 'Deep interior and exterior detailing for a complete refresh.',
  },
  {
    serviceId: 'svc-glass-coating',
    name: 'Glass Coating',
    basePrice: 120_000,
    category: 'Other Coatings',
    durationMinutes: 60,
    warrantyLabel: '3-month warranty',
    description: 'Hydrophobic glass treatment for clearer visibility in rain.',
  },
];

export function findMockServiceById(serviceId: string): MockService | undefined {
  return MOCK_SERVICES.find((service) => service.serviceId === serviceId);
}
