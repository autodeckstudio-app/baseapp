import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { VisitsController } from './visits.controller';
import type { VisitsService } from './visits.service';

function buildRequest(authUser: AuthenticatedUser) {
  return { authUser } as unknown as import('express').Request;
}

describe('VisitsController', () => {
  it('requires at least the staff role to check in a visit', () => {
    expect(Reflect.getMetadata(ROLES_KEY, VisitsController.prototype.checkIn)).toEqual(['staff']);
  });

  it('requires at least the staff role to complete a visit', () => {
    expect(Reflect.getMetadata(ROLES_KEY, VisitsController.prototype.complete)).toEqual(['staff']);
  });

  it('requires at least the staff role to seal a visit', () => {
    expect(Reflect.getMetadata(ROLES_KEY, VisitsController.prototype.seal)).toEqual(['staff']);
  });

  it('delegates check-in to VisitsService using the bookingId route param', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const visitsService = { checkIn: jest.fn().mockResolvedValue({ visitId: 'v1' }) } as unknown as VisitsService;
    const controller = new VisitsController(visitsService);

    await controller.checkIn('bk-1', buildRequest(authUser));

    expect(visitsService.checkIn).toHaveBeenCalledWith(authUser, 'bk-1');
  });

  it('delegates complete to VisitsService using the id route param', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const visitsService = { complete: jest.fn().mockResolvedValue(undefined) } as unknown as VisitsService;
    const controller = new VisitsController(visitsService);

    await controller.complete('visit-1', buildRequest(authUser));

    expect(visitsService.complete).toHaveBeenCalledWith(authUser, 'visit-1');
  });

  it('delegates seal to VisitsService using the id route param', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const visitsService = { seal: jest.fn().mockResolvedValue(undefined) } as unknown as VisitsService;
    const controller = new VisitsController(visitsService);

    await controller.seal('visit-1', buildRequest(authUser));

    expect(visitsService.seal).toHaveBeenCalledWith(authUser, 'visit-1');
  });
});
