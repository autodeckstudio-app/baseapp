import{describe,it,expect}from'vitest';
import{createBookingSchema,getAvailabilitySchema}from'../../schemas/booking.js';
const base={serviceId:'s',vehicleId:'v',vehicleCategory:'sedan',studioId:'st',scheduledDate:'2028-02-29',scheduledTime:'23:59',idempotencyKey:'k'};
describe('preserve deployed calendar and clock validation',()=>{
 it('accepts real leap day and bounded clock',()=>{expect(createBookingSchema.safeParse(base).success).toBe(true);expect(getAvailabilitySchema.safeParse({serviceId:'s',studioId:'st',startDate:'2028-02-29'}).success).toBe(true)});
 it.each(['2026-02-29','2026-02-30','2026-04-31','2026-00-10','2026-13-01','2026-12-00','2100-02-29'])('rejects impossible %s for booking and availability',date=>{expect(createBookingSchema.safeParse({...base,scheduledDate:date}).success).toBe(false);expect(getAvailabilitySchema.safeParse({serviceId:'s',studioId:'st',startDate:date}).success).toBe(false)});
 it.each(['24:00','25:30','12:60','99:99','9:00'])('rejects invalid time %s',scheduledTime=>{expect(createBookingSchema.safeParse({...base,scheduledTime}).success).toBe(false)});
});
