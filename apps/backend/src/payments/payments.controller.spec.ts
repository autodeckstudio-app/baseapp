import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { PaymentsController } from './payments.controller';
import type { PaymentsService } from './payments.service';

function buildRequest(authUser: AuthenticatedUser) {
  return { authUser } as unknown as import('express').Request;
}

describe('PaymentsController', () => {
  it('requires at least the staff role to create a payment order', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PaymentsController.prototype.createPaymentOrder)).toEqual(['staff']);
  });

  it('requires at least the studio_manager role to process a refund', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PaymentsController.prototype.processRefund)).toEqual(['studio_manager']);
  });

  it('delegates order creation to PaymentsService using the bookingId route param', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const paymentsService = {
      createPaymentOrder: jest.fn().mockResolvedValue({ paymentId: 'bk-1' }),
    } as unknown as PaymentsService;
    const controller = new PaymentsController(paymentsService);

    await controller.createPaymentOrder('bk-1', buildRequest(authUser));

    expect(paymentsService.createPaymentOrder).toHaveBeenCalledWith(authUser, 'bk-1');
  });

  it('delegates refund processing to PaymentsService using the bookingId route param', async () => {
    const authUser: AuthenticatedUser = { uid: 'manager-1', role: 'studio_manager' };
    const paymentsService = {
      processRefund: jest.fn().mockResolvedValue({ refundId: 'bk-1' }),
    } as unknown as PaymentsService;
    const controller = new PaymentsController(paymentsService);

    await controller.processRefund('bk-1', buildRequest(authUser));

    expect(paymentsService.processRefund).toHaveBeenCalledWith(authUser, 'bk-1');
  });
});
