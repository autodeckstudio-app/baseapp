import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type * as admin from 'firebase-admin';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import type { CustomersService } from '../customers/customers.service';
import type { VehiclesService } from '../vehicles/vehicles.service';
import type { PackageDefinitionsService } from './package-definitions.service';
import { CustomerPackagesService } from './customer-packages.service';
import type { CreateCustomerPackageDto } from './dto/create-customer-package.dto';
import type { ConsumePackageUsageDto } from './dto/consume-package-usage.dto';

type FakeCustomerPackageRecord = {
  customerId: string;
  totalQty: number;
  usedQty: number;
  remainingQty: number;
  expiresAt: { toDate: () => Date };
};

function buildHarness(
  options: {
    existingCustomerPackages?: Record<string, FakeCustomerPackageRecord>;
    customerExists?: boolean;
    packageDefinitionExists?: boolean;
    vehicle?: { vehicleId: string; ownerCustomerId: string } | null;
  } = {},
) {
  const existingCustomerPackages = options.existingCustomerPackages ?? {};
  const customerExists = options.customerExists ?? true;
  const packageDefinitionExists = options.packageDefinitionExists ?? true;
  const vehicle = options.vehicle === undefined ? { vehicleId: 'veh-1', ownerCustomerId: 'cust-1' } : options.vehicle;

  const transactionMock = {
    get: jest.fn((ref: { id: string }) =>
      Promise.resolve({
        exists: ref.id in existingCustomerPackages,
        data: () => existingCustomerPackages[ref.id],
      }),
    ),
    set: jest.fn(),
    update: jest.fn(),
  };

  const batch = { set: jest.fn(), update: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };

  const collectionMock = jest.fn((name: string) => ({
    doc: jest.fn((id?: string) => ({ id: id ?? `generated-${name}-id` })),
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
  const customersService = {
    getCustomerRecord: jest.fn().mockResolvedValue(customerExists ? { customerId: 'cust-1' } : null),
  } as unknown as CustomersService;
  const vehiclesService = {
    getVehicleRecord: jest.fn().mockResolvedValue(vehicle),
  } as unknown as VehiclesService;
  const packageDefinitionsService = {
    getPackageDefinitionRecord: jest.fn().mockResolvedValue(
      packageDefinitionExists
        ? {
            packageDefinitionId: 'pkg-1',
            name: '10 Washes',
            includedServiceId: 'svc-1',
            quantity: 10,
            price: 450000,
            validityDuration: { unit: 'month', value: 12 },
          }
        : null,
    ),
  } as unknown as PackageDefinitionsService;

  const service = new CustomerPackagesService(
    app,
    auditLogService,
    customersService,
    vehiclesService,
    packageDefinitionsService,
  );
  return { service, batch, transactionMock, firestoreMock, auditLogService, customersService, vehiclesService, packageDefinitionsService };
}

function actor(): AuthenticatedUser {
  return { uid: 'staff-1', role: 'staff' };
}

const createInput: CreateCustomerPackageDto = { packageDefinitionId: 'pkg-1' };
const consumeInput: ConsumePackageUsageDto = { vehicleId: 'veh-1' };

function futureDate(hours: number): { toDate: () => Date } {
  return { toDate: () => new Date(Date.now() + hours * 60 * 60 * 1000) };
}

describe('CustomerPackagesService.createCustomerPackage', () => {
  it('creates a customer package snapshotting totalQty/remainingQty/pricePaid/expiresAt from the package definition', async () => {
    const { service, batch } = buildHarness();
    const result = await service.createCustomerPackage(actor(), 'cust-1', createInput);

    expect(result.customerPackageId).toBe('generated-customerPackages-id');
    expect(result.customerId).toBe('cust-1');
    expect(result.totalQty).toBe(10);
    expect(result.remainingQty).toBe(10);
    expect(result.usedQty).toBe(0);
    expect(result.pricePaid).toBe(450000);
    expect(batch.set).toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalled();
  });

  it('throws NotFoundException when the customer does not exist, and writes nothing', async () => {
    const { service, batch, auditLogService } = buildHarness({ customerExists: false });
    await expect(service.createCustomerPackage(actor(), 'ghost', createInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the package definition does not exist, and writes nothing', async () => {
    const { service, batch, auditLogService } = buildHarness({ packageDefinitionExists: false });
    await expect(service.createCustomerPackage(actor(), 'cust-1', createInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(batch.set).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });

  it('writes an audit entry sourced from the authenticated actor', async () => {
    const { service, batch, auditLogService } = buildHarness();
    await service.createCustomerPackage(actor(), 'cust-1', createInput);

    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({
        actorId: 'staff-1',
        actorRole: 'staff',
        action: 'customerPackage.create',
        entityId: 'generated-customerPackages-id',
      }),
    );
  });
});

describe('CustomerPackagesService.consumeUsage', () => {
  it('uses a real Firestore transaction, not a plain batch, to prevent a concurrent double-spend', async () => {
    const { service, firestoreMock } = buildHarness({
      existingCustomerPackages: {
        'cp-1': { customerId: 'cust-1', totalQty: 10, usedQty: 3, remainingQty: 7, expiresAt: futureDate(24) },
      },
    });
    await service.consumeUsage(actor(), 'cp-1', consumeInput);
    expect(firestoreMock.runTransaction).toHaveBeenCalled();
  });

  it('decrements remainingQty and increments usedQty by exactly one, via the existing consumePackageUsage domain function', async () => {
    const { service, transactionMock } = buildHarness({
      existingCustomerPackages: {
        'cp-1': { customerId: 'cust-1', totalQty: 10, usedQty: 3, remainingQty: 7, expiresAt: futureDate(24) },
      },
    });
    const result = await service.consumeUsage(actor(), 'cp-1', consumeInput);

    expect(result.customerPackageId).toBe('cp-1');
    expect(result.vehicleId).toBe('veh-1');
    expect(result.customerId).toBe('cust-1');
    expect(transactionMock.update).toHaveBeenCalledWith(expect.anything(), { usedQty: 4, remainingQty: 6 });
    expect(transactionMock.set).toHaveBeenCalled();
  });

  it('throws NotFoundException when the vehicle does not exist, before opening any transaction', async () => {
    const { service, firestoreMock } = buildHarness({ vehicle: null });
    await expect(service.consumeUsage(actor(), 'cp-1', consumeInput)).rejects.toBeInstanceOf(NotFoundException);
    expect(firestoreMock.runTransaction).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the customer package does not exist', async () => {
    const { service } = buildHarness();
    await expect(service.consumeUsage(actor(), 'ghost', consumeInput)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequestException when the vehicle belongs to a different customer than the package owner, and writes nothing', async () => {
    const { service, transactionMock, auditLogService } = buildHarness({
      existingCustomerPackages: {
        'cp-1': { customerId: 'cust-1', totalQty: 10, usedQty: 0, remainingQty: 10, expiresAt: futureDate(24) },
      },
      vehicle: { vehicleId: 'veh-1', ownerCustomerId: 'some-other-customer' },
    });
    await expect(service.consumeUsage(actor(), 'cp-1', consumeInput)).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionMock.update).not.toHaveBeenCalled();
    expect(transactionMock.set).not.toHaveBeenCalled();
    expect(auditLogService.recordInTransaction).not.toHaveBeenCalled();
  });

  it('throws ConflictException when there is no remaining quantity, and writes nothing', async () => {
    const { service, transactionMock, auditLogService } = buildHarness({
      existingCustomerPackages: {
        'cp-1': { customerId: 'cust-1', totalQty: 10, usedQty: 10, remainingQty: 0, expiresAt: futureDate(24) },
      },
    });
    await expect(service.consumeUsage(actor(), 'cp-1', consumeInput)).rejects.toBeInstanceOf(ConflictException);
    expect(transactionMock.update).not.toHaveBeenCalled();
    expect(transactionMock.set).not.toHaveBeenCalled();
    expect(auditLogService.recordInTransaction).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the package has expired, even with remaining quantity, and writes nothing', async () => {
    const { service, transactionMock, auditLogService } = buildHarness({
      existingCustomerPackages: {
        'cp-1': { customerId: 'cust-1', totalQty: 10, usedQty: 3, remainingQty: 7, expiresAt: futureDate(-24) },
      },
    });
    await expect(service.consumeUsage(actor(), 'cp-1', consumeInput)).rejects.toBeInstanceOf(ConflictException);
    expect(transactionMock.update).not.toHaveBeenCalled();
    expect(transactionMock.set).not.toHaveBeenCalled();
    expect(auditLogService.recordInTransaction).not.toHaveBeenCalled();
  });

  it('writes an audit entry (inside the transaction) sourced from the authenticated actor', async () => {
    const { service, transactionMock, auditLogService } = buildHarness({
      existingCustomerPackages: {
        'cp-1': { customerId: 'cust-1', totalQty: 10, usedQty: 3, remainingQty: 7, expiresAt: futureDate(24) },
      },
    });
    await service.consumeUsage(actor(), 'cp-1', consumeInput);

    expect(auditLogService.recordInTransaction).toHaveBeenCalledWith(
      transactionMock,
      expect.objectContaining({
        actorId: 'staff-1',
        actorRole: 'staff',
        action: 'packageUsage.consume',
        entityId: 'generated-packageUsage-id',
        after: expect.objectContaining({ customerPackageId: 'cp-1', vehicleId: 'veh-1', remainingQty: 6 }),
      }),
    );
  });
});
