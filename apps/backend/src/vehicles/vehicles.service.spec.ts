import { NotFoundException } from '@nestjs/common';
import type * as admin from 'firebase-admin';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import type { CustomersService } from '../customers/customers.service';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleSchema, type CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleSchema } from './dto/update-vehicle.dto';

function buildHarness(options: {
  existingVehicles?: Record<string, { make: string; model: string; plate: string; ownerCustomerId: string }>;
  customerExists?: boolean;
} = {}) {
  const existingVehicles = options.existingVehicles ?? {};
  const customerExists = options.customerExists ?? true;

  const batch = {
    set: jest.fn(),
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  const collectionMock = jest.fn((name: string) => ({
    doc: jest.fn((id?: string) => {
      const docId = id ?? 'generated-vehicle-id';
      return {
        id: docId,
        get: jest.fn().mockResolvedValue({
          exists: name === 'vehicles' && docId in existingVehicles,
          data: () => existingVehicles[docId],
        }),
      };
    }),
  }));

  const firestoreMock = { collection: collectionMock, batch: jest.fn(() => batch) };
  const app = { firestore: () => firestoreMock } as unknown as admin.app.App;
  const auditLogService = { recordInBatch: jest.fn(), record: jest.fn() } as unknown as AuditLogService;
  const customersService = {
    getCustomerRecord: jest.fn().mockResolvedValue(
      customerExists ? { customerId: 'cust-1', name: 'Anita', phone: '+91-1', email: 'anita@example.com' } : null,
    ),
  } as unknown as CustomersService;

  const service = new VehiclesService(app, auditLogService, customersService);
  return { service, batch, auditLogService, customersService };
}

function actor(): AuthenticatedUser {
  return { uid: 'staff-1', role: 'staff' };
}

const createInput: CreateVehicleDto = { make: 'Honda', model: 'City', plate: 'MH12AB1234' };

describe('CreateVehicleSchema', () => {
  it('accepts a valid payload', () => {
    expect(CreateVehicleSchema.safeParse(createInput).success).toBe(true);
  });

  it('rejects invalid vehicle data (empty plate)', () => {
    expect(CreateVehicleSchema.safeParse({ ...createInput, plate: '' }).success).toBe(false);
  });

  it('strips a client-supplied ownerCustomerId — the schema has no such field', () => {
    const parsed = CreateVehicleSchema.parse({ ...createInput, ownerCustomerId: 'attacker-controlled-id' });
    expect(parsed).not.toHaveProperty('ownerCustomerId');
  });
});

describe('UpdateVehicleSchema', () => {
  it('rejects an empty update payload', () => {
    expect(UpdateVehicleSchema.safeParse({}).success).toBe(false);
  });

  it('strips a client-supplied ownerCustomerId on update too', () => {
    const parsed = UpdateVehicleSchema.parse({ plate: 'NEW123', ownerCustomerId: 'attacker-controlled-id' });
    expect(parsed).not.toHaveProperty('ownerCustomerId');
  });
});

describe('VehiclesService.createVehicle', () => {
  it('sets ownerCustomerId from the validated customerId parameter, never from the DTO', async () => {
    const { service } = buildHarness();
    const result = await service.createVehicle(actor(), 'cust-1', createInput);
    expect(result.ownerCustomerId).toBe('cust-1');
  });

  it('confirms the referenced customer exists before creating anything', async () => {
    const { service, customersService } = buildHarness();
    await service.createVehicle(actor(), 'cust-1', createInput);
    expect(customersService.getCustomerRecord).toHaveBeenCalledWith('cust-1');
  });

  it('throws NotFoundException when the referenced customer does not exist, and writes nothing', async () => {
    const { service, auditLogService, batch } = buildHarness({ customerExists: false });
    await expect(service.createVehicle(actor(), 'ghost-customer', createInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });

  it('writes an audit entry recording the server-derived ownerCustomerId', async () => {
    const { service, batch, auditLogService } = buildHarness();
    await service.createVehicle(actor(), 'cust-1', createInput);

    expect(batch.set).toHaveBeenCalled();
    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({
        action: 'vehicle.create',
        after: expect.objectContaining({ ownerCustomerId: 'cust-1' }),
      }),
    );
    expect(batch.commit).toHaveBeenCalled();
  });
});

describe('VehiclesService.updateVehicle', () => {
  it('throws NotFoundException for a nonexistent vehicle', async () => {
    const { service } = buildHarness();
    await expect(service.updateVehicle(actor(), 'ghost', { plate: 'NEW123' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates only the given fields, never ownerCustomerId', async () => {
    const { service, batch, auditLogService } = buildHarness({
      existingVehicles: { 'veh-1': { make: 'Honda', model: 'City', plate: 'OLD123', ownerCustomerId: 'cust-1' } },
    });
    await service.updateVehicle(actor(), 'veh-1', { plate: 'NEW123' });

    expect(batch.update).toHaveBeenCalledWith(expect.anything(), { plate: 'NEW123' });
    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({ action: 'vehicle.update', entityId: 'veh-1' }),
    );
    expect(batch.commit).toHaveBeenCalled();
  });

  it('does not write an audit entry (or any Firestore write) when the target does not exist', async () => {
    const { service, auditLogService, batch } = buildHarness();
    await expect(service.updateVehicle(actor(), 'ghost', { plate: 'X' })).rejects.toThrow();

    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });
});
