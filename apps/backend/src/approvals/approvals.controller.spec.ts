import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { ApprovalsController } from './approvals.controller';
import type { ApprovalsService } from './approvals.service';
import type { RequestApprovalDto } from './dto/request-approval.dto';

function buildRequest(authUser: AuthenticatedUser) {
  return { authUser } as unknown as import('express').Request;
}

describe('ApprovalsController', () => {
  it('requires at least the staff role to request an approval', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ApprovalsController.prototype.request)).toEqual(['staff']);
  });

  it('requires at least the staff role to resolve an approval', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ApprovalsController.prototype.resolve)).toEqual(['staff']);
  });

  it('delegates request to ApprovalsService using the visitId route param, not anything from the body', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const approvalsService = {
      requestApproval: jest.fn().mockResolvedValue({ approvalId: 'a1' }),
    } as unknown as ApprovalsService;
    const controller = new ApprovalsController(approvalsService);
    const dto: RequestApprovalDto = { description: 'Extra work needed', additionalAmount: 10000 };

    await controller.request('visit-1', dto, buildRequest(authUser));

    expect(approvalsService.requestApproval).toHaveBeenCalledWith(authUser, 'visit-1', dto);
  });

  it('delegates resolve to ApprovalsService with the id from the route and the authenticated actor', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const approvalsService = { resolveApproval: jest.fn().mockResolvedValue(undefined) } as unknown as ApprovalsService;
    const controller = new ApprovalsController(approvalsService);

    await controller.resolve('appr-1', { approved: true }, buildRequest(authUser));

    expect(approvalsService.resolveApproval).toHaveBeenCalledWith(authUser, 'appr-1', { approved: true });
  });
});
