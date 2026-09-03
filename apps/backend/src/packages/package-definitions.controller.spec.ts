import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { PackageDefinitionsController } from './package-definitions.controller';
import type { PackageDefinitionsService } from './package-definitions.service';
import type { CreatePackageDefinitionDto } from './dto/create-package-definition.dto';

function buildRequest(authUser: AuthenticatedUser) {
  return { authUser } as unknown as import('express').Request;
}

describe('PackageDefinitionsController', () => {
  it('requires at least the studio_manager role to create a package definition', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PackageDefinitionsController.prototype.create)).toEqual([
      'studio_manager',
    ]);
  });

  it('requires at least the studio_manager role to update a package definition', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PackageDefinitionsController.prototype.update)).toEqual([
      'studio_manager',
    ]);
  });

  it('delegates creation to PackageDefinitionsService with the authenticated actor', async () => {
    const authUser: AuthenticatedUser = { uid: 'manager-1', role: 'studio_manager' };
    const packageDefinitionsService = {
      createPackageDefinition: jest.fn().mockResolvedValue({ packageDefinitionId: 'p1' }),
    } as unknown as PackageDefinitionsService;
    const controller = new PackageDefinitionsController(packageDefinitionsService);
    const dto: CreatePackageDefinitionDto = {
      name: '10 Washes',
      includedServiceId: 'svc-1',
      quantity: 10,
      price: 450000,
      validityDuration: { unit: 'month', value: 12 },
    };

    await controller.create(dto, buildRequest(authUser));

    expect(packageDefinitionsService.createPackageDefinition).toHaveBeenCalledWith(authUser, dto);
  });

  it('delegates update to PackageDefinitionsService with the id from the route and the authenticated actor', async () => {
    const authUser: AuthenticatedUser = { uid: 'manager-1', role: 'studio_manager' };
    const packageDefinitionsService = {
      updatePackageDefinition: jest.fn().mockResolvedValue(undefined),
    } as unknown as PackageDefinitionsService;
    const controller = new PackageDefinitionsController(packageDefinitionsService);

    await controller.update('pkg-1', { price: 500000 }, buildRequest(authUser));

    expect(packageDefinitionsService.updatePackageDefinition).toHaveBeenCalledWith(authUser, 'pkg-1', {
      price: 500000,
    });
  });
});
