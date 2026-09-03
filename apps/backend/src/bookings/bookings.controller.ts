import { Body, Controller, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { BookingsService } from './bookings.service';

/**
 * Staff-minimum for every route here — booking creation/cancellation is
 * routine front-desk work, same tier as Customers/Vehicles, not the
 * elevated tier ServicesController uses for pricing-catalogue control.
 * Nothing here can set a price or jump straight to a later booking state:
 * pricing is always computed server-side from Service records, and the
 * only transition exposed is cancellation, itself gated by the existing
 * domain state machine.
 *
 * Creation is nested under its owning customer
 * (`POST /customers/:customerId/bookings`), exactly like
 * VehiclesController's vehicle-creation route, so `customerId` comes only
 * from a route parameter the server controls — never from the request
 * body. There is deliberately no read endpoint: a booking's own read
 * access is already granted directly against Firestore by the existing
 * `bookings/{id}` rule, matching every other Phase 2 module.
 */
@Controller()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Roles('staff')
  @Post('customers/:customerId/bookings')
  create(@Param('customerId') customerId: string, @Body() dto: CreateBookingDto, @Req() req: Request) {
    return this.bookingsService.createBooking(req.authUser!, customerId, dto);
  }

  @Roles('staff')
  @Patch('bookings/:id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelBookingDto, @Req() req: Request) {
    return this.bookingsService.cancelBooking(req.authUser!, id, dto);
  }
}
