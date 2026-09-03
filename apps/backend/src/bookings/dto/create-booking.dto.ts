import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Deliberately has no `customerId`, `bookingId`, `basePrice`, `price`,
 * `priceSnapshot`, or `status` field. `customerId` always comes from the
 * validated `:customerId` route parameter of
 * `POST /customers/:customerId/bookings` (mirroring
 * CreateVehicleDto/VehiclesController); every other backend-controlled
 * value is computed in BookingsService, never accepted from the client.
 *
 * `serviceIds` matches the existing `computePriceSnapshot` domain contract,
 * which takes an array of selected services, not a single one.
 * `scheduledAt` is legitimate client input — the customer's chosen
 * appointment time is not something the backend can infer — and is later
 * read back by `calculateCancellationRefund` if the booking is cancelled.
 */
export const CreateBookingSchema = z.object({
  vehicleId: z.string().min(1),
  serviceIds: z.array(z.string().min(1)).min(1),
  scheduledAt: z.coerce.date(),
});

export class CreateBookingDto extends createZodDto(CreateBookingSchema) {}
