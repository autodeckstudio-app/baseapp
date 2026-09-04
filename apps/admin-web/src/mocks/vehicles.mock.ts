import type { Vehicle } from '@autodeck/domain';

/** Fixture data using the REAL `Vehicle` type from `@autodeck/domain` — no invented fields (no photo/year/color). */
export const MOCK_VEHICLES: Vehicle[] = [
  { vehicleId: 'veh-1', make: 'Hyundai', model: 'Creta', plate: 'GJ 01 AB 1234', ownerCustomerId: 'cust-1' },
  { vehicleId: 'veh-2', make: 'Maruti Suzuki', model: 'Baleno', plate: 'GJ 01 CD 5678', ownerCustomerId: 'cust-2' },
  { vehicleId: 'veh-3', make: 'Tata', model: 'Nexon', plate: 'GJ 01 EF 9012', ownerCustomerId: 'cust-3' },
];
