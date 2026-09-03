import { NotFoundException } from '@nestjs/common';
import type * as admin from 'firebase-admin';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerSchema, type CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerSchema } from './dto/update-customer.dto';

function buildHarness(
  existingCustomers: Record<string, { name: string; phone: string; email: string }> = {},
) {
  const batch = {
    set: jest.fn(),
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  const collectionMock = jest.fn((name: string) => ({
    doc: jest.fn((id?: string) => {
      const docId = id ?? 'generated-customer-id';
      return {
        id: docId,
        get: jest.fn().mockResolvedValue({
          exists: name === 'customers' && docId in existingCustomers,
          data: () => existingCustomers[docId],
        }),
      };
    }),
  }));

  const firestoreMock = { collection: collectionMock, batch: jest.fn(() => batch) };
  const app = { firestore: () => firestoreMock } as unknown as admin.app.App;
  const auditLogService = { recordInBatch: jest.fn(), record: jest.fn() } as unknown as AuditLogService;
  const service = new CustomersService(app, auditLogService);

  return { service, batch, auditLogService, collectionMock };
}

function actor(role: AuthenticatedUser['role'] = 'staff'): AuthenticatedUser {
  return { uid: 'staff-uid', role };
}

const createInput: CreateCustomerDto = { name: 'Anita', phone: '+91-9000000010', email: 'anita@example.com' };

describe('CreateCustomerSchema', () => {
  it('accepts a valid payload', () => {
    expect(CreateCustomerSchema.safeParse(createInput).success).toBe(true);
  });

  it('rejects invalid customer data (malformed email)', () => {
    const result = CreateCustomerSchema.safeParse({ ...createInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid customer data (empty name)', () => {
    const result = CreateCustomerSchema.safeParse({ ...createInput, name: '' });
    expect(result.success).toBe(false);
  });

  it('has no customerId field for a client to set', () => {
    const parsed = CreateCustomerSchema.parse({ ...createInput, customerId: 'client-supplied-id' });
    expect(parsed).not.toHaveProperty('customerId');
  });
});

describe('UpdateCustomerSchema', () => {
  it('rejects an empty update payload', () => {
    expect(UpdateCustomerSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a partial update', () => {
    expect(UpdateCustomerSchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });
});

describe('CustomersService.createCustomer', () => {
  it('creates a customer with a server-generated ID and writes an audit entry in the same batch', async () => {
    const { service, batch, auditLogService } = buildHarness();
    const result = await service.createCustomer(actor(), createInput);

    expect(result.customerId).toBe('generated-customer-id');
    expect(result.name).toBe('Anita');
    expect(batch.set).toHaveBeenCalled();
    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({ action: 'customer.create', entityId: 'generated-customer-id' }),
    );
    expect(batch.commit).toHaveBeenCalled();
  });

  it('records the creating staff member as createdByStaffId', async () => {
    const { service } = buildHarness();
    const result = await service.createCustomer(actor(), createInput);
    expect(result.createdByStaffId).toBe('staff-uid');
  });
});

describe('CustomersService.updateCustomer', () => {
  it('throws NotFoundException for a nonexistent customer', async () => {
    const { service } = buildHarness();
    await expect(service.updateCustomer(actor(), 'ghost', { name: 'New Name' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates the given fields and writes an audit entry with accurate before/after values', async () => {
    const { service, batch, auditLogService } = buildHarness({
      'cust-1': { name: 'Old Name', phone: '+91-1', email: 'old@example.com' },
    });
    await service.updateCustomer(actor(), 'cust-1', { name: 'New Name' });

    expect(batch.update).toHaveBeenCalledWith(expect.anything(), { name: 'New Name' });
    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({
        action: 'customer.update',
        entityId: 'cust-1',
        before: expect.objectContaining({ name: 'Old Name' }),
        after: { name: 'New Name' },
      }),
    );
    expect(batch.commit).toHaveBeenCalled();
  });

  it('does not write an audit entry (or any Firestore write) when the target does not exist', async () => {
    const { service, auditLogService, batch } = buildHarness();
    await expect(service.updateCustomer(actor(), 'ghost', { name: 'X' })).rejects.toThrow();

    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
  });
});
