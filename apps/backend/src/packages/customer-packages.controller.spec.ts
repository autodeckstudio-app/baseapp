import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { CustomerPackagesController } from './customer-packages.controller';
import type { CustomerPackagesService } from './customer-packages.service';
import type { CreateCustomerPackageDto } from './dto/create-customer-package.dto';

function buildRequest(authUser: AuthenticatedUser) {
  return { authUser } as unknown as import('express').Request;
}

describe('CustomerPackagesController', () => {
  it('requires at least the staff role to purchase a customer package', () => {
    expect(Reflect.getMetadata(ROLES_KEY, CustomerPackagesController.prototype.create)).toEqual(['staff']);
  });

  it('requires at least the staff role to consume package usage', () => {
    expect(Reflect.getMetadata(ROLES_KEY, CustomerPackagesController.prototype.consume)).toEqual(['staff']);
  });

  it('delegates creation to CustomerPackagesService using the customerId route param, not anything from the body', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const customerPackagesService = {
      createCustomerPackage: jest.fn().mockResolvedValue({ customerPackageId: 'cp1' }),
    } as unknown as CustomerPackagesService;
    const controller = new CustomerPackagesController(customerPackagesService);
    const dto: CreateCustomerPackageDto = { packageDefinitionId: 'pkg-1' };

    await controller.create('cust-1', dto, buildRequest(authUser));

    expect(customerPackagesService.createCustomerPackage).toHaveBeenCalledWith(authUser, 'cust-1', dto);
  });

  it('delegates consumption to CustomerPackagesService with the id from the route and the authenticated actor', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const customerPackagesService = {
      consumeUsage: jest.fn().mockResolvedValue({ packageUsageId: 'u1' }),
    } as unknown as CustomerPackagesService;
    const controller = new CustomerPackagesController(customerPackagesService);

    await controller.consume('cp-1', { vehicleId: 'veh-1' }, buildRequest(authUser));

    expect(customerPackagesService.consumeUsage).toHaveBeenCalledWith(authUser, 'cp-1', { vehicleId: 'veh-1' });
  });
});
