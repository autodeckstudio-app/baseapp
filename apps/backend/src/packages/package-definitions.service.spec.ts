import { NotFoundException } from '@nestjs/common';
import type * as admin from 'firebase-admin';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import type { ServicesService } from '../services/services.service';
import { PackageDefinitionsService } from './package-definitions.service';
import { CreatePackageDefinitionSchema, type CreatePackageDefinitionDto } from './dto/create-package-definition.dto';
import { UpdatePackageDefinitionSchema } from './dto/update-package-definition.dto';

type FakePackageDefinition = {
  name: string;
  includedServiceId: string;
  quantity: number;
  price: number;
  validityDuration: { unit: 'day' | 'month' | 'year'; value: number };
};

function buildHarness(
  options: {
    existingDefinitions?: Record<string, FakePackageDefinition>;
    serviceExists?: boolean;
  } = {},
) {
  const existingDefinitions = options.existingDefinitions ?? {};
  const serviceExists = options.serviceExists ?? true;

  const batch = {
    set: jest.fn(),
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  const collectionMock = jest.fn((name: string) => ({
    doc: jest.fn((id?: string) => {
      const docId = id ?? 'generated-package-definition-id';
      return {
        id: docId,
        get: jest.fn().mockResolvedValue({
          exists: name === 'packageDefinitions' && docId in existingDefinitions,
          data: () => existingDefinitions[docId],
        }),
      };
    }),
  }));

  const firestoreMock = { collection: collectionMock, batch: jest.fn(() => batch) };
  const app = { firestore: () => firestoreMock } as unknown as admin.app.App;
  const auditLogService = { recordInBatch: jest.fn(), record: jest.fn() } as unknown as AuditLogService;
  const servicesService = {
    getServiceRecord: jest.fn().mockResolvedValue(serviceExists ? { serviceId: 'svc-1', name: 'Wash', basePrice: 50000 } : null),
  } as unknown as ServicesService;

  const service = new PackageDefinitionsService(app, auditLogService, servicesService);
  return { service, batch, auditLogService, servicesService };
}

function actor(): AuthenticatedUser {
  return { uid: 'manager-1', role: 'studio_manager' };
}

const createInput: CreatePackageDefinitionDto = {
  name: '10 Washes',
  includedServiceId: 'svc-1',
  quantity: 10,
  price: 450000,
  validityDuration: { unit: 'month', value: 12 },
};

describe('CreatePackageDefinitionSchema', () => {
  it('accepts a valid payload (reused directly from the domain PackageDefinitionSchema)', () => {
    expect(CreatePackageDefinitionSchema.safeParse(createInput).success).toBe(true);
  });

  it('rejects invalid data (zero quantity)', () => {
    expect(CreatePackageDefinitionSchema.safeParse({ ...createInput, quantity: 0 }).success).toBe(false);
  });

  it('rejects invalid data (unrecognized validity unit)', () => {
    expect(
      CreatePackageDefinitionSchema.safeParse({ ...createInput, validityDuration: { unit: 'week', value: 4 } })
        .success,
    ).toBe(false);
  });

  it('has no packageDefinitionId field for a client to set', () => {
    const parsed = CreatePackageDefinitionSchema.parse({ ...createInput, packageDefinitionId: 'client-supplied' });
    expect(parsed).not.toHaveProperty('packageDefinitionId');
  });
});

describe('UpdatePackageDefinitionSchema', () => {
  it('rejects an empty update payload', () => {
    expect(UpdatePackageDefinitionSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a partial price-only update', () => {
    expect(UpdatePackageDefinitionSchema.safeParse({ price: 500000 }).success).toBe(true);
  });
});

describe('PackageDefinitionsService.createPackageDefinition', () => {
  it('creates a package definition with a server-generated ID after validating the referenced service exists', async () => {
    const { service, batch, servicesService } = buildHarness();
    const result = await service.createPackageDefinition(actor(), createInput);

    expect(result.packageDefinitionId).toBe('generated-package-definition-id');
    expect(result.quantity).toBe(10);
    expect(servicesService.getServiceRecord).toHaveBeenCalledWith('svc-1');
    expect(batch.set).toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalled();
  });

  it('throws NotFoundException when the referenced service does not exist, and writes nothing', async () => {
    const { service, batch, auditLogService } = buildHarness({ serviceExists: false });
    await expect(service.createPackageDefinition(actor(), createInput)).rejects.toBeInstanceOf(NotFoundException);
    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });

  it('writes an audit entry sourced from the authenticated actor', async () => {
    const { service, batch, auditLogService } = buildHarness();
    await service.createPackageDefinition(actor(), createInput);

    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({
        actorId: 'manager-1',
        actorRole: 'studio_manager',
        action: 'packageDefinition.create',
        entityId: 'generated-package-definition-id',
      }),
    );
  });
});

describe('PackageDefinitionsService.updatePackageDefinition', () => {
  it('throws NotFoundException for a nonexistent package definition', async () => {
    const { service } = buildHarness();
    await expect(service.updatePackageDefinition(actor(), 'ghost', { price: 1000 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates the given fields and writes an audit entry with accurate before/after values', async () => {
    const { service, batch, auditLogService } = buildHarness({
      existingDefinitions: {
        'pkg-1': {
          name: 'Old Name',
          includedServiceId: 'svc-1',
          quantity: 10,
          price: 400000,
          validityDuration: { unit: 'month', value: 6 },
        },
      },
    });
    await service.updatePackageDefinition(actor(), 'pkg-1', { price: 450000 });

    expect(batch.update).toHaveBeenCalledWith(expect.anything(), { price: 450000 });
    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({
        action: 'packageDefinition.update',
        entityId: 'pkg-1',
        before: expect.objectContaining({ price: 400000 }),
        after: { price: 450000 },
      }),
    );
  });

  it('validates a newly-referenced includedServiceId on update too', async () => {
    const { service, batch, auditLogService, servicesService } = buildHarness({
      existingDefinitions: {
        'pkg-1': {
          name: 'Old Name',
          includedServiceId: 'svc-1',
          quantity: 10,
          price: 400000,
          validityDuration: { unit: 'month', value: 6 },
        },
      },
      serviceExists: false,
    });

    await expect(
      service.updatePackageDefinition(actor(), 'pkg-1', { includedServiceId: 'ghost-service' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(servicesService.getServiceRecord).toHaveBeenCalledWith('ghost-service');
    expect(batch.update).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });

  it('does not write an audit entry (or any Firestore write) when the target does not exist', async () => {
    const { service, auditLogService, batch } = buildHarness();
    await expect(service.updatePackageDefinition(actor(), 'ghost', { price: 1000 })).rejects.toThrow();

    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });
});
