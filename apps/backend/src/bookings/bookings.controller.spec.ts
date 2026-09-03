import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { BookingsController } from './bookings.controller';
import type { BookingsService } from './bookings.service';
import type { CreateBookingDto } from './dto/create-booking.dto';

function buildRequest(authUser: AuthenticatedUser) {
  return { authUser } as unknown as import('express').Request;
}

describe('BookingsController', () => {
  it('requires at least the staff role to create a booking', () => {
    expect(Reflect.getMetadata(ROLES_KEY, BookingsController.prototype.create)).toEqual(['staff']);
  });

  it('requires at least the staff role to cancel a booking', () => {
    expect(Reflect.getMetadata(ROLES_KEY, BookingsController.prototype.cancel)).toEqual(['staff']);
  });

  it('delegates creation to BookingsService using the customerId route param, not anything from the body', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const bookingsService = {
      createBooking: jest.fn().mockResolvedValue({ bookingId: 'bk-1' }),
    } as unknown as BookingsService;
    const controller = new BookingsController(bookingsService);
    const dto: CreateBookingDto = { vehicleId: 'veh-1', serviceIds: ['svc-1'], scheduledAt: new Date('2026-12-01') };

    await controller.create('cust-1', dto, buildRequest(authUser));

    expect(bookingsService.createBooking).toHaveBeenCalledWith(authUser, 'cust-1', dto);
  });

  it('delegates cancellation to BookingsService with the id from the route and the authenticated actor', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const bookingsService = { cancelBooking: jest.fn().mockResolvedValue(undefined) } as unknown as BookingsService;
    const controller = new BookingsController(bookingsService);

    await controller.cancel('bk-1', { initiatedBy: 'customer' }, buildRequest(authUser));

    expect(bookingsService.cancelBooking).toHaveBeenCalledWith(authUser, 'bk-1', { initiatedBy: 'customer' });
  });
});
