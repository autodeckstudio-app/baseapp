/**
 * Fixture data only. `vehicleId`, `make`, `model`, `plate`,
 * `ownerCustomerId` mirror the real `packages/domain/src/vehicle.ts`
 * `Vehicle` schema exactly.
 *
 * FUTURE SCHEMA DEPENDENCY: `photo`, `year`, `color`, and `protections` are
 * UI-only placeholders — the real `Vehicle` schema has no such fields yet
 * (see the approved design-gate review, Gates 7 and 9). `protections` here
 * is deliberately minimal (kind/status/since/expiry) matching only the
 * approved V1 scope item "vehicle detail with protection cards" — this is
 * NOT the Warranty Certificate feature, which remains out of scope for
 * this pass entirely.
 */
export interface MockProtection {
  kind: 'ppf' | 'ceramic' | 'insurance';
  status: 'active' | 'expiring' | 'expired';
  since: string;
  expiry: string;
}

export interface MockVehicle {
  vehicleId: string;
  make: string;
  model: string;
  year?: number;
  plate: string;
  ownerCustomerId: string;
  protections: MockProtection[];
}

export const MOCK_VEHICLES: MockVehicle[] = [
  {
    vehicleId: 'veh-1',
    make: 'Hyundai',
    model: 'Creta',
    year: 2023,
    plate: 'GJ 01 AB 1234',
    ownerCustomerId: 'mock-customer',
    protections: [{ kind: 'ceramic', status: 'active', since: '2024-11-02', expiry: '2026-11-02' }],
  },
  {
    vehicleId: 'veh-2',
    make: 'Maruti Suzuki',
    model: 'Baleno',
    year: 2021,
    plate: 'GJ 01 CD 5678',
    ownerCustomerId: 'mock-customer',
    protections: [],
  },
];

export function findMockVehicleById(vehicleId: string): MockVehicle | undefined {
  return MOCK_VEHICLES.find((vehicle) => vehicle.vehicleId === vehicleId);
}
