import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { CustomersController } from './customers.controller';
import type { CustomersService } from './customers.service';
import type { CreateCustomerDto } from './dto/create-customer.dto';

function buildRequest(authUser: AuthenticatedUser) {
  return { authUser } as unknown as import('express').Request;
}

describe('CustomersController', () => {
  it('requires at least the staff role to create a customer', () => {
    expect(Reflect.getMetadata(ROLES_KEY, CustomersController.prototype.create)).toEqual(['staff']);
  });

  it('requires at least the staff role to update a customer', () => {
    expect(Reflect.getMetadata(ROLES_KEY, CustomersController.prototype.update)).toEqual(['staff']);
  });

  it('delegates creation to CustomersService with the authenticated actor from the request', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const customersService = {
      createCustomer: jest.fn().mockResolvedValue({ customerId: 'c1' }),
    } as unknown as CustomersService;
    const controller = new CustomersController(customersService);
    const dto: CreateCustomerDto = { name: 'Anita', phone: '+91-1', email: 'anita@example.com' };

    await controller.create(dto, buildRequest(authUser));

    expect(customersService.createCustomer).toHaveBeenCalledWith(authUser, dto);
  });

  it('delegates update to CustomersService with the id from the route and the authenticated actor', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const customersService = { updateCustomer: jest.fn().mockResolvedValue(undefined) } as unknown as CustomersService;
    const controller = new CustomersController(customersService);

    await controller.update('cust-1', { name: 'New Name' }, buildRequest(authUser));

    expect(customersService.updateCustomer).toHaveBeenCalledWith(authUser, 'cust-1', { name: 'New Name' });
  });
});
