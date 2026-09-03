import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { InventoryController } from './inventory.controller';
import type { InventoryService } from './inventory.service';
import type { CreateInventoryItemDto } from './dto/create-inventory-item.dto';

function buildRequest(authUser: AuthenticatedUser) {
  return { authUser } as unknown as import('express').Request;
}

describe('InventoryController', () => {
  it('requires at least the studio_manager role to create an inventory item', () => {
    expect(Reflect.getMetadata(ROLES_KEY, InventoryController.prototype.create)).toEqual(['studio_manager']);
  });

  it('requires at least the studio_manager role to update an inventory item', () => {
    expect(Reflect.getMetadata(ROLES_KEY, InventoryController.prototype.update)).toEqual(['studio_manager']);
  });

  it('requires at least the studio_manager role to restock an inventory item', () => {
    expect(Reflect.getMetadata(ROLES_KEY, InventoryController.prototype.restock)).toEqual(['studio_manager']);
  });

  it('requires at least the staff role to record inventory usage', () => {
    expect(Reflect.getMetadata(ROLES_KEY, InventoryController.prototype.recordUsage)).toEqual(['staff']);
  });

  it('delegates creation to InventoryService with the authenticated actor', async () => {
    const authUser: AuthenticatedUser = { uid: 'manager-1', role: 'studio_manager' };
    const inventoryService = {
      createInventoryItem: jest.fn().mockResolvedValue({ inventoryItemId: 'i1' }),
    } as unknown as InventoryService;
    const controller = new InventoryController(inventoryService);
    const dto: CreateInventoryItemDto = { name: 'Wax', currentStock: 10, lowStockThreshold: 5 };

    await controller.create(dto, buildRequest(authUser));

    expect(inventoryService.createInventoryItem).toHaveBeenCalledWith(authUser, dto);
  });

  it('delegates update to InventoryService with the id from the route', async () => {
    const authUser: AuthenticatedUser = { uid: 'manager-1', role: 'studio_manager' };
    const inventoryService = { updateInventoryItem: jest.fn().mockResolvedValue(undefined) } as unknown as InventoryService;
    const controller = new InventoryController(inventoryService);

    await controller.update('item-1', { name: 'New Name' }, buildRequest(authUser));

    expect(inventoryService.updateInventoryItem).toHaveBeenCalledWith(authUser, 'item-1', { name: 'New Name' });
  });

  it('delegates restock to InventoryService with the id from the route', async () => {
    const authUser: AuthenticatedUser = { uid: 'manager-1', role: 'studio_manager' };
    const inventoryService = {
      restock: jest.fn().mockResolvedValue({ currentStock: 15, isLowStock: false }),
    } as unknown as InventoryService;
    const controller = new InventoryController(inventoryService);

    await controller.restock('item-1', { quantityReceived: 10 }, buildRequest(authUser));

    expect(inventoryService.restock).toHaveBeenCalledWith(authUser, 'item-1', { quantityReceived: 10 });
  });

  it('delegates usage recording to InventoryService with the id from the route and the authenticated actor', async () => {
    const authUser: AuthenticatedUser = { uid: 'staff-1', role: 'staff' };
    const inventoryService = {
      recordUsage: jest.fn().mockResolvedValue({ inventoryUsageId: 'u1' }),
    } as unknown as InventoryService;
    const controller = new InventoryController(inventoryService);

    await controller.recordUsage('item-1', { quantityUsed: 3 }, buildRequest(authUser));

    expect(inventoryService.recordUsage).toHaveBeenCalledWith(authUser, 'item-1', { quantityUsed: 3 });
  });
});
