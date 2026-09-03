import { ConflictException, NotFoundException } from '@nestjs/common';
import type * as admin from 'firebase-admin';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemSchema, type CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemSchema } from './dto/update-inventory-item.dto';
import { RestockInventoryItemSchema, type RestockInventoryItemDto } from './dto/restock-inventory-item.dto';
import { RecordInventoryUsageSchema, type RecordInventoryUsageDto } from './dto/record-inventory-usage.dto';

type FakeInventoryItem = { name: string; currentStock: number; lowStockThreshold: number };

function buildHarness(options: { existingItems?: Record<string, FakeInventoryItem> } = {}) {
  const existingItems = options.existingItems ?? {};

  const transactionMock = {
    get: jest.fn((ref: { id: string }) =>
      Promise.resolve({
        exists: ref.id in existingItems,
        data: () => existingItems[ref.id],
      }),
    ),
    set: jest.fn(),
    update: jest.fn(),
  };

  const batch = { set: jest.fn(), update: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };

  const collectionMock = jest.fn((name: string) => ({
    doc: jest.fn((id?: string) => {
      const docId = id ?? `generated-${name}-id`;
      return {
        id: docId,
        get: jest.fn().mockResolvedValue({
          exists: name === 'inventory' && docId in existingItems,
          data: () => existingItems[docId],
        }),
      };
    }),
  }));

  const firestoreMock = {
    collection: collectionMock,
    batch: jest.fn(() => batch),
    runTransaction: jest.fn((callback: (tx: typeof transactionMock) => Promise<unknown>) => callback(transactionMock)),
  };
  const app = { firestore: () => firestoreMock } as unknown as admin.app.App;
  const auditLogService = {
    recordInBatch: jest.fn(),
    recordInTransaction: jest.fn(),
    record: jest.fn(),
  } as unknown as AuditLogService;

  const service = new InventoryService(app, auditLogService);
  return { service, batch, transactionMock, firestoreMock, auditLogService };
}

function actor(role: AuthenticatedUser['role'] = 'studio_manager'): AuthenticatedUser {
  return { uid: role === 'staff' ? 'staff-1' : 'manager-1', role };
}

const createInput: CreateInventoryItemDto = { name: 'Wax', currentStock: 20, lowStockThreshold: 5 };

describe('CreateInventoryItemSchema', () => {
  it('accepts a valid payload', () => {
    expect(CreateInventoryItemSchema.safeParse(createInput).success).toBe(true);
  });

  it('rejects invalid data (negative currentStock)', () => {
    expect(CreateInventoryItemSchema.safeParse({ ...createInput, currentStock: -1 }).success).toBe(false);
  });

  it('has no inventoryItemId field for a client to set', () => {
    const parsed = CreateInventoryItemSchema.parse({ ...createInput, inventoryItemId: 'client-supplied' });
    expect(parsed).not.toHaveProperty('inventoryItemId');
  });
});

describe('UpdateInventoryItemSchema', () => {
  it('rejects an empty update payload', () => {
    expect(UpdateInventoryItemSchema.safeParse({}).success).toBe(false);
  });

  it('has no currentStock field — stock only changes via restock/usage', () => {
    const parsed = UpdateInventoryItemSchema.parse({ name: 'New Name', currentStock: 999 });
    expect(parsed).not.toHaveProperty('currentStock');
  });
});

describe('RestockInventoryItemSchema', () => {
  it('accepts a valid payload', () => {
    const input: RestockInventoryItemDto = { quantityReceived: 10 };
    expect(RestockInventoryItemSchema.safeParse(input).success).toBe(true);
  });

  it('rejects a zero or negative quantityReceived', () => {
    expect(RestockInventoryItemSchema.safeParse({ quantityReceived: 0 }).success).toBe(false);
  });
});

describe('RecordInventoryUsageSchema', () => {
  it('accepts a valid payload', () => {
    const input: RecordInventoryUsageDto = { quantityUsed: 3 };
    expect(RecordInventoryUsageSchema.safeParse(input).success).toBe(true);
  });

  it('rejects a zero or negative quantityUsed', () => {
    expect(RecordInventoryUsageSchema.safeParse({ quantityUsed: 0 }).success).toBe(false);
  });
});

describe('InventoryService.createInventoryItem', () => {
  it('creates an item with a server-generated ID and writes an audit entry in the same batch', async () => {
    const { service, batch, auditLogService } = buildHarness();
    const result = await service.createInventoryItem(actor(), createInput);

    expect(result.inventoryItemId).toBe('generated-inventory-id');
    expect(result.currentStock).toBe(20);
    expect(batch.set).toHaveBeenCalled();
    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({ action: 'inventoryItem.create', entityId: 'generated-inventory-id' }),
    );
    expect(batch.commit).toHaveBeenCalled();
  });
});

describe('InventoryService.updateInventoryItem', () => {
  it('throws NotFoundException for a nonexistent item', async () => {
    const { service } = buildHarness();
    await expect(service.updateInventoryItem(actor(), 'ghost', { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates the given fields without touching currentStock', async () => {
    const { service, batch, auditLogService } = buildHarness({
      existingItems: { 'item-1': { name: 'Old Name', currentStock: 20, lowStockThreshold: 5 } },
    });
    await service.updateInventoryItem(actor(), 'item-1', { name: 'New Name' });

    expect(batch.update).toHaveBeenCalledWith(expect.anything(), { name: 'New Name' });
    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({ action: 'inventoryItem.update', entityId: 'item-1' }),
    );
  });

  it('does not write an audit entry (or any Firestore write) when the target does not exist', async () => {
    const { service, auditLogService, batch } = buildHarness();
    await expect(service.updateInventoryItem(actor(), 'ghost', { name: 'X' })).rejects.toThrow();

    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });
});

describe('InventoryService.restock', () => {
  const restockInput: RestockInventoryItemDto = { quantityReceived: 10 };

  it('uses a real Firestore transaction, not a plain batch, to prevent a concurrent lost update', async () => {
    const { service, firestoreMock } = buildHarness({
      existingItems: { 'item-1': { name: 'Wax', currentStock: 5, lowStockThreshold: 5 } },
    });
    await service.restock(actor(), 'item-1', restockInput);
    expect(firestoreMock.runTransaction).toHaveBeenCalled();
  });

  it('adds the received quantity to currentStock', async () => {
    const { service, transactionMock } = buildHarness({
      existingItems: { 'item-1': { name: 'Wax', currentStock: 5, lowStockThreshold: 5 } },
    });
    const result = await service.restock(actor(), 'item-1', restockInput);

    expect(result.currentStock).toBe(15);
    expect(transactionMock.update).toHaveBeenCalledWith(expect.anything(), { currentStock: 15 });
  });

  it('reports isLowStock accurately after restocking above the threshold', async () => {
    const { service } = buildHarness({
      existingItems: { 'item-1': { name: 'Wax', currentStock: 5, lowStockThreshold: 5 } },
    });
    const result = await service.restock(actor(), 'item-1', restockInput);
    expect(result.isLowStock).toBe(false);
  });

  it('throws NotFoundException for a nonexistent item, and writes nothing', async () => {
    const { service, transactionMock, auditLogService } = buildHarness();
    await expect(service.restock(actor(), 'ghost', restockInput)).rejects.toBeInstanceOf(NotFoundException);
    expect(transactionMock.update).not.toHaveBeenCalled();
    expect(auditLogService.recordInTransaction).not.toHaveBeenCalled();
  });

  it('writes an audit entry (inside the transaction) with accurate before/after stock', async () => {
    const { service, transactionMock, auditLogService } = buildHarness({
      existingItems: { 'item-1': { name: 'Wax', currentStock: 5, lowStockThreshold: 5 } },
    });
    await service.restock(actor(), 'item-1', restockInput);

    expect(auditLogService.recordInTransaction).toHaveBeenCalledWith(
      transactionMock,
      expect.objectContaining({
        actorId: 'manager-1',
        actorRole: 'studio_manager',
        action: 'inventoryItem.restock',
        entityId: 'item-1',
        before: { currentStock: 5 },
        after: { currentStock: 15 },
      }),
    );
  });
});

describe('InventoryService.recordUsage', () => {
  const usageInput: RecordInventoryUsageDto = { quantityUsed: 3 };

  it('uses a real Firestore transaction, not a plain batch, to prevent a concurrent double-consume', async () => {
    const { service, firestoreMock } = buildHarness({
      existingItems: { 'item-1': { name: 'Wax', currentStock: 10, lowStockThreshold: 5 } },
    });
    await service.recordUsage(actor('staff'), 'item-1', usageInput);
    expect(firestoreMock.runTransaction).toHaveBeenCalled();
  });

  it('deducts usage via the existing computeStockAfterUsage domain function', async () => {
    const { service, transactionMock } = buildHarness({
      existingItems: { 'item-1': { name: 'Wax', currentStock: 10, lowStockThreshold: 5 } },
    });
    const result = await service.recordUsage(actor('staff'), 'item-1', usageInput);

    expect(result.inventoryItemId).toBe('item-1');
    expect(result.quantityUsed).toBe(3);
    expect(transactionMock.update).toHaveBeenCalledWith(expect.anything(), { currentStock: 7 });
    expect(transactionMock.set).toHaveBeenCalled();
  });

  it('throws NotFoundException for a nonexistent item', async () => {
    const { service } = buildHarness();
    await expect(service.recordUsage(actor('staff'), 'ghost', usageInput)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ConflictException when usage exceeds current stock — never goes negative, and writes nothing', async () => {
    const { service, transactionMock, auditLogService } = buildHarness({
      existingItems: { 'item-1': { name: 'Wax', currentStock: 2, lowStockThreshold: 5 } },
    });
    await expect(service.recordUsage(actor('staff'), 'item-1', { quantityUsed: 3 })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transactionMock.update).not.toHaveBeenCalled();
    expect(transactionMock.set).not.toHaveBeenCalled();
    expect(auditLogService.recordInTransaction).not.toHaveBeenCalled();
  });

  it('allows deducting down to exactly zero', async () => {
    const { service, transactionMock } = buildHarness({
      existingItems: { 'item-1': { name: 'Wax', currentStock: 3, lowStockThreshold: 5 } },
    });
    await service.recordUsage(actor('staff'), 'item-1', { quantityUsed: 3 });
    expect(transactionMock.update).toHaveBeenCalledWith(expect.anything(), { currentStock: 0 });
  });

  it('reports isLowStock accurately after usage drops below the threshold', async () => {
    const { service, auditLogService, transactionMock } = buildHarness({
      existingItems: { 'item-1': { name: 'Wax', currentStock: 10, lowStockThreshold: 5 } },
    });
    await service.recordUsage(actor('staff'), 'item-1', { quantityUsed: 6 });

    expect(auditLogService.recordInTransaction).toHaveBeenCalledWith(
      transactionMock,
      expect.objectContaining({ after: expect.objectContaining({ remainingStock: 4, isLowStock: true }) }),
    );
  });

  it('writes an audit entry (inside the transaction) sourced from the authenticated actor', async () => {
    const { service, transactionMock, auditLogService } = buildHarness({
      existingItems: { 'item-1': { name: 'Wax', currentStock: 10, lowStockThreshold: 5 } },
    });
    await service.recordUsage(actor('staff'), 'item-1', usageInput);

    expect(auditLogService.recordInTransaction).toHaveBeenCalledWith(
      transactionMock,
      expect.objectContaining({
        actorId: 'staff-1',
        actorRole: 'staff',
        action: 'inventoryUsage.record',
        entityId: 'generated-inventoryUsage-id',
      }),
    );
  });
});
