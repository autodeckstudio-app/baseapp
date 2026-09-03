import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { ServicesController } from './services.controller';
import type { ServicesService } from './services.service';
import type { CreateServiceDto } from './dto/create-service.dto';

function buildRequest(authUser: AuthenticatedUser) {
  return { authUser } as unknown as import('express').Request;
}

describe('ServicesController', () => {
  it('requires at least the studio_manager role to create a service', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ServicesController.prototype.create)).toEqual(['studio_manager']);
  });

  it('requires at least the studio_manager role to update a service', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ServicesController.prototype.update)).toEqual(['studio_manager']);
  });

  it('delegates creation to ServicesService with the authenticated actor from the request', async () => {
    const authUser: AuthenticatedUser = { uid: 'manager-1', role: 'studio_manager' };
    const servicesService = {
      createService: jest.fn().mockResolvedValue({ serviceId: 's1' }),
    } as unknown as ServicesService;
    const controller = new ServicesController(servicesService);
    const dto: CreateServiceDto = { name: 'Basic Wash', basePrice: 50000 };

    await controller.create(dto, buildRequest(authUser));

    expect(servicesService.createService).toHaveBeenCalledWith(authUser, dto);
  });

  it('delegates update to ServicesService with the id from the route and the authenticated actor', async () => {
    const authUser: AuthenticatedUser = { uid: 'manager-1', role: 'studio_manager' };
    const servicesService = { updateService: jest.fn().mockResolvedValue(undefined) } as unknown as ServicesService;
    const controller = new ServicesController(servicesService);

    await controller.update('svc-1', { basePrice: 60000 }, buildRequest(authUser));

    expect(servicesService.updateService).toHaveBeenCalledWith(authUser, 'svc-1', { basePrice: 60000 });
  });
});
