import { NotFoundException } from '@nestjs/common';
import type * as admin from 'firebase-admin';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { ServicesService } from './services.service';
import { CreateServiceSchema, type CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceSchema } from './dto/update-service.dto';

function buildHarness(existingServices: Record<string, { name: string; basePrice: number }> = {}) {
  const batch = {
    set: jest.fn(),
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  const collectionMock = jest.fn((name: string) => ({
    doc: jest.fn((id?: string) => {
      const docId = id ?? 'generated-service-id';
      return {
        id: docId,
        get: jest.fn().mockResolvedValue({
          exists: name === 'services' && docId in existingServices,
          data: () => existingServices[docId],
        }),
      };
    }),
  }));

  const firestoreMock = { collection: collectionMock, batch: jest.fn(() => batch) };
  const app = { firestore: () => firestoreMock } as unknown as admin.app.App;
  const auditLogService = { recordInBatch: jest.fn(), record: jest.fn() } as unknown as AuditLogService;
  const service = new ServicesService(app, auditLogService);

  return { service, batch, auditLogService, collectionMock };
}

function actor(role: AuthenticatedUser['role'] = 'studio_manager'): AuthenticatedUser {
  return { uid: 'manager-uid', role };
}

const createInput: CreateServiceDto = { name: 'Basic Wash', basePrice: 50000 };

describe('CreateServiceSchema', () => {
  it('accepts a valid payload', () => {
    expect(CreateServiceSchema.safeParse(createInput).success).toBe(true);
  });

  it('rejects invalid service data (empty name)', () => {
    expect(CreateServiceSchema.safeParse({ ...createInput, name: '' }).success).toBe(false);
  });

  it('rejects invalid service data (negative price)', () => {
    expect(CreateServiceSchema.safeParse({ ...createInput, basePrice: -1 }).success).toBe(false);
  });

  it('rejects invalid service data (non-integer / fractional price)', () => {
    expect(CreateServiceSchema.safeParse({ ...createInput, basePrice: 499.99 }).success).toBe(false);
  });

  it('has no serviceId field for a client to set', () => {
    const parsed = CreateServiceSchema.parse({ ...createInput, serviceId: 'client-supplied-id' });
    expect(parsed).not.toHaveProperty('serviceId');
  });
});

describe('UpdateServiceSchema', () => {
  it('rejects an empty update payload', () => {
    expect(UpdateServiceSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a partial price-only update', () => {
    expect(UpdateServiceSchema.safeParse({ basePrice: 60000 }).success).toBe(true);
  });

  it('rejects a negative price on update', () => {
    expect(UpdateServiceSchema.safeParse({ basePrice: -100 }).success).toBe(false);
  });
});

describe('ServicesService.createService', () => {
  it('creates a service with a server-generated ID and writes an audit entry in the same batch', async () => {
    const { service, batch, auditLogService } = buildHarness();
    const result = await service.createService(actor(), createInput);

    expect(result.serviceId).toBe('generated-service-id');
    expect(result.name).toBe('Basic Wash');
    expect(result.basePrice).toBe(50000);
    expect(batch.set).toHaveBeenCalled();
    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({ action: 'service.create', entityId: 'generated-service-id' }),
    );
    expect(batch.commit).toHaveBeenCalled();
  });

  it('records the creating staff member as createdByStaffId', async () => {
    const { service } = buildHarness();
    const result = await service.createService(actor(), createInput);
    expect(result.createdByStaffId).toBe('manager-uid');
  });

  it('never derives basePrice from anything other than the validated DTO value', async () => {
    const { service } = buildHarness();
    const result = await service.createService(actor(), { name: 'Premium Wash', basePrice: 120000 });
    expect(result.basePrice).toBe(120000);
  });
});

describe('ServicesService.updateService', () => {
  it('throws NotFoundException for a nonexistent service', async () => {
    const { service } = buildHarness();
    await expect(service.updateService(actor(), 'ghost', { basePrice: 1000 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates the given fields and writes an audit entry with accurate before/after values', async () => {
    const { service, batch, auditLogService } = buildHarness({
      'svc-1': { name: 'Old Wash', basePrice: 40000 },
    });
    await service.updateService(actor(), 'svc-1', { basePrice: 45000 });

    expect(batch.update).toHaveBeenCalledWith(expect.anything(), { basePrice: 45000 });
    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({
        action: 'service.update',
        entityId: 'svc-1',
        before: expect.objectContaining({ basePrice: 40000 }),
        after: { basePrice: 45000 },
      }),
    );
    expect(batch.commit).toHaveBeenCalled();
  });

  it('does not write an audit entry (or any Firestore write) when the target does not exist', async () => {
    const { service, auditLogService, batch } = buildHarness();
    await expect(service.updateService(actor(), 'ghost', { basePrice: 1000 })).rejects.toThrow();

    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });
});
