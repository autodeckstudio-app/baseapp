import { Controller, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { PaymentsService } from './payments.service';

/**
 * Both routes are nested under their booking (`/bookings/:bookingId/...`),
 * matching Visits/Approvals-under-Booking's existing convention, so the
 * booking identity always comes from a route parameter the server
 * controls. Neither route takes a request body: there is no legitimate
 * client-supplied field for either operation (order amount comes from the
 * booking's own frozen price snapshot; refund amount comes from the
 * booking's own already-computed refund decision) — this also means
 * neither endpoint interacts with the pre-existing global
 * ZodValidationPipe defect at all.
 *
 * Order creation is `@Roles('staff')`, matching BookingsController's own
 * tier — routine front-desk work. Refund processing is
 * `@Roles('studio_manager')` — per the approved product decisions,
 * "Studio Manager: handle/authorize refunds," and explicitly, "Staff
 * cannot: approve discretionary refunds."
 */
@Controller('bookings')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Roles('staff')
  @Post(':bookingId/payment-order')
  createPaymentOrder(@Param('bookingId') bookingId: string, @Req() req: Request) {
    return this.paymentsService.createPaymentOrder(req.authUser!, bookingId);
  }

  @Roles('studio_manager')
  @Post(':bookingId/refund')
  processRefund(@Param('bookingId') bookingId: string, @Req() req: Request) {
    return this.paymentsService.processRefund(req.authUser!, bookingId);
  }
}
