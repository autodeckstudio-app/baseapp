import { Controller, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { VisitsService } from './visits.service';

/**
 * Staff-minimum for every route here — per the approved product decisions
 * (Section F), "Staff can... advance job/service stages" as a normal
 * operational action; nothing distinguishes check-in/complete/seal as
 * needing a higher tier. No DTO/body on any route: nothing here has a
 * legitimate client-supplied field (booking/visit identity comes entirely
 * from route parameters; every other value is backend-derived), so unlike
 * Bookings/Customers/Vehicles/Services there is nothing to validate at the
 * request-body layer at all.
 *
 * Check-in is nested under its booking (`POST /bookings/:bookingId/visits`),
 * exactly like Vehicles-under-Customers and Bookings-under-Customers,
 * so `bookingId` comes only from a route parameter the server controls.
 * Complete/seal are flat `/visits/:id/...` routes, matching
 * StaffController's/BookingsController's `:id`-scoped action routes. There
 * is deliberately no read endpoint: a visit's own read access is already
 * granted directly against Firestore by the existing `visits/{id}` rule.
 */
@Controller()
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Roles('staff')
  @Post('bookings/:bookingId/visits')
  checkIn(@Param('bookingId') bookingId: string, @Req() req: Request) {
    return this.visitsService.checkIn(req.authUser!, bookingId);
  }

  @Roles('staff')
  @Patch('visits/:id/complete')
  complete(@Param('id') id: string, @Req() req: Request) {
    return this.visitsService.complete(req.authUser!, id);
  }

  @Roles('staff')
  @Patch('visits/:id/seal')
  seal(@Param('id') id: string, @Req() req: Request) {
    return this.visitsService.seal(req.authUser!, id);
  }
}
