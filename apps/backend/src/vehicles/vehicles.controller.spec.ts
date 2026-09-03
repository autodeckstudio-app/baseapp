import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { VehiclesController } from './vehicles.controller';
import type { VehiclesService } from './vehicles.service';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';

function buildRequest(authUser: AuthenticatedUser) {
  return { authUser } as unknown as import('express').Request;
}

describe('VehiclesController', () => {
  it('requires at least the staff role to create a vehicle', () => {
    expect(Reflect.getMetadata(ROLES_KEY, VehiclesController.prototype.create)).toEqual(['staff']);
  });

  it('requires at least the staff role to update a vehicle', () => {
    expect(Reflect.getMetadata(ROLES_KEY, VehiclesController.prototype.update)).toEqual(['staff']);
  });

  it('delegates creation to VehiclesService using the customerId route param, not anything from the body', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const vehiclesService = { createVehicle: jest.fn().mockResolvedValue({ vehicleId: 'v1' }) } as unknown as VehiclesService;
    const controller = new VehiclesController(vehiclesService);
    const dto: CreateVehicleDto = { make: 'Honda', model: 'City', plate: 'MH12AB1234' };

    await controller.create('cust-1', dto, buildRequest(authUser));

    expect(vehiclesService.createVehicle).toHaveBeenCalledWith(authUser, 'cust-1', dto);
  });

  it('delegates update to VehiclesService with the id from the route and the authenticated actor', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const vehiclesService = { updateVehicle: jest.fn().mockResolvedValue(undefined) } as unknown as VehiclesService;
    const controller = new VehiclesController(vehiclesService);

    await controller.update('veh-1', { plate: 'NEW123' }, buildRequest(authUser));

    expect(vehiclesService.updateVehicle).toHaveBeenCalledWith(authUser, 'veh-1', { plate: 'NEW123' });
  });
});
