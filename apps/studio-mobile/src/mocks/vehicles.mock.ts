import type { Vehicle } from '@autodeck/domain';

/**
 * Fixture data. Uses the REAL `Vehicle` type from `@autodeck/domain`
 * ({vehicleId, make, model, plate, ownerCustomerId}) — no invented fields
 * (no photo/year/color, same limitation identified in the customer-mobile
 * design-gate review). Production reads are direct-Firestore per
 * `firestore.rules`'s `vehicles/{id}` rule.
 */
export const MOCK_VEHICLES: Vehicle[] = [
  { vehicleId: 'veh-1', make: 'Hyundai', model: 'Creta', plate: 'GJ 01 AB 1234', ownerCustomerId: 'cust-1' },
  { vehicleId: 'veh-2', make: 'Maruti Suzuki', model: 'Baleno', plate: 'GJ 01 CD 5678', ownerCustomerId: 'cust-2' },
];

export function findMockVehicleById(vehicleId: string): Vehicle | undefined {
  return MOCK_VEHICLES.find((v) => v.vehicleId === vehicleId);
}

export function findMockVehiclesByCustomerId(customerId: string): Vehicle[] {
  return MOCK_VEHICLES.filter((v) => v.ownerCustomerId === customerId);
}
