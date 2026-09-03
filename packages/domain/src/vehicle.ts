import { z } from 'zod';

/**
 * `ownerCustomerId` is always derived server-side from the customer the
 * vehicle was created under (see VehiclesService.createVehicle) — never
 * accepted as client input. This schema describes the persisted shape only;
 * it is deliberately never used as a request-body DTO schema itself (the
 * create DTO has no `ownerCustomerId` field at all).
 */
export const VehicleSchema = z.object({
  vehicleId: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  plate: z.string().min(1),
  ownerCustomerId: z.string().min(1),
});
export type Vehicle = z.infer<typeof VehicleSchema>;
