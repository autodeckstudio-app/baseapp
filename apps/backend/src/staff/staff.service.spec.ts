import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type * as admin from 'firebase-admin';
import type { AuditLogService } from '../audit/audit-log.service';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { StaffService } from './staff.service';
import type { CreateStaffDto } from './dto/create-staff.dto';

function buildHarness(
  existingStaff: Record<string, { permissionRole: string; active?: boolean }> = {},
) {
  const callOrder: string[] = [];

  const authMock = {
    createUser: jest.fn().mockImplementation(async () => {
      callOrder.push('createUser');
      return { uid: 'new-uid' };
    }),
    deleteUser: jest.fn().mockImplementation(async () => {
      callOrder.push('deleteUser');
    }),
    setCustomUserClaims: jest.fn().mockImplementation(async () => {
      callOrder.push('setCustomUserClaims');
    }),
    revokeRefreshTokens: jest.fn().mockImplementation(async () => {
      callOrder.push('revokeRefreshTokens');
    }),
    updateUser: jest.fn().mockImplementation(async () => {
      callOrder.push('updateUser');
    }),
  };

  const batch = {
    set: jest.fn(),
    update: jest.fn(),
    commit: jest.fn().mockImplementation(async () => {
      callOrder.push('batch.commit');
    }),
  };

  const collectionMock = jest.fn((name: string) => ({
    doc: jest.fn((id?: string) => {
      const docId = id ?? 'generated-id';
      return {
        id: docId,
        get: jest.fn().mockResolvedValue({
          exists: name === 'staff' && docId in existingStaff,
          data: () => existingStaff[docId],
        }),
      };
    }),
  }));

  const firestoreMock = { collection: collectionMock, batch: jest.fn(() => batch) };

  const app = {
    auth: () => authMock,
    firestore: () => firestoreMock,
  } as unknown as admin.app.App;

  const auditLogService = { recordInBatch: jest.fn(), record: jest.fn() } as unknown as AuditLogService;

  const service = new StaffService(app, auditLogService);

  return { service, authMock, batch, auditLogService, callOrder };
}

function actor(role: AuthenticatedUser['role']): AuthenticatedUser {
  return { uid: 'actor-uid', role };
}

const createInput: CreateStaffDto = {
  name: 'Rahul',
  phone: '+91-9000000000',
  email: 'rahul@example.com',
  jobTitle: 'Technician',
  role: 'staff',
};

describe('StaffService.createStaff', () => {
  it('denies a Studio Manager from creating a Studio-Manager-tier account', async () => {
    const { service, authMock } = buildHarness();
    await expect(
      service.createStaff(actor('studio_manager'), { ...createInput, role: 'studio_manager' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(authMock.createUser).not.toHaveBeenCalled();
  });

  it('allows a Studio Manager to create a Staff-tier account, in the correct order', async () => {
    const { service, authMock, batch, auditLogService, callOrder } = buildHarness();
    const result = await service.createStaff(actor('studio_manager'), createInput);

    expect(result.permissionRole).toBe('staff');
    expect(authMock.createUser).toHaveBeenCalledWith({ email: createInput.email, displayName: createInput.name });
    expect(batch.set).toHaveBeenCalled();
    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({ action: 'staff.create', entityId: 'new-uid' }),
    );
    expect(authMock.setCustomUserClaims).toHaveBeenCalledWith('new-uid', { role: 'staff' });
    // The claim must be granted only AFTER the Firestore batch commits.
    expect(callOrder).toEqual(['createUser', 'batch.commit', 'setCustomUserClaims']);
  });

  it('allows an Owner/Admin to create a Studio-Manager-tier account', async () => {
    const { service } = buildHarness();
    await expect(
      service.createStaff(actor('owner_admin'), { ...createInput, role: 'studio_manager' }),
    ).resolves.toBeDefined();
  });

  it('maps an already-existing email to a ConflictException', async () => {
    const { service, authMock } = buildHarness();
    authMock.createUser.mockRejectedValueOnce({ code: 'auth/email-already-exists' });
    await expect(service.createStaff(actor('studio_manager'), createInput)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('deletes the orphaned Auth account if the Firestore batch fails, then rethrows', async () => {
    const { service, authMock, batch } = buildHarness();
    const firestoreError = new Error('firestore unavailable');
    batch.commit.mockRejectedValueOnce(firestoreError);

    await expect(service.createStaff(actor('studio_manager'), createInput)).rejects.toThrow(firestoreError);
    expect(authMock.deleteUser).toHaveBeenCalledWith('new-uid');
    expect(authMock.setCustomUserClaims).not.toHaveBeenCalled();
  });
});

describe('StaffService.deactivateStaff', () => {
  // 6. Existing self-deactivation and authorization behavior — unchanged.
  it('denies deactivating your own account', async () => {
    const { service, authMock } = buildHarness();
    await expect(service.deactivateStaff(actor('owner_admin'), 'actor-uid')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(authMock.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for a nonexistent target', async () => {
    const { service } = buildHarness({});
    await expect(service.deactivateStaff(actor('studio_manager'), 'ghost')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('denies a Studio Manager from deactivating a Studio-Manager-tier target', async () => {
    const { service } = buildHarness({ target: { permissionRole: 'studio_manager', active: true } });
    await expect(service.deactivateStaff(actor('studio_manager'), 'target')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  // 1. Normal successful deactivation.
  it('revokes sessions and disables the account BEFORE touching Firestore', async () => {
    const { service, callOrder } = buildHarness({ target: { permissionRole: 'staff', active: true } });
    await service.deactivateStaff(actor('studio_manager'), 'target');
    expect(callOrder).toEqual(['revokeRefreshTokens', 'updateUser', 'batch.commit']);
  });

  it('writes the success audit entry in the same batch as the Firestore update', async () => {
    const { service, batch, auditLogService } = buildHarness({
      target: { permissionRole: 'staff', active: true },
    });
    await service.deactivateStaff(actor('studio_manager'), 'target');
    expect(batch.update).toHaveBeenCalledWith(expect.anything(), { active: false });
    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      batch,
      expect.objectContaining({ action: 'staff.deactivate', entityId: 'target', before: { active: true } }),
    );
  });

  // 5. Audit accuracy when target.active is false (e.g. a repeated
  // deactivation) — the "before" value must reflect the real stored state,
  // never a hardcoded assumption.
  it('records the actual prior active value in the audit entry, not an assumed true', async () => {
    const { service, auditLogService } = buildHarness({
      target: { permissionRole: 'staff', active: false },
    });
    await service.deactivateStaff(actor('studio_manager'), 'target');
    expect(auditLogService.recordInBatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ before: { active: false } }),
    );
  });

  // 2. revokeRefreshTokens failure — full abort, nothing else attempted.
  it('aborts entirely if revokeRefreshTokens fails: no disable, no Firestore write, no audit', async () => {
    const { service, authMock, batch, auditLogService } = buildHarness({
      target: { permissionRole: 'staff', active: true },
    });
    const revokeError = new Error('revoke failed');
    authMock.revokeRefreshTokens.mockRejectedValueOnce(revokeError);

    await expect(service.deactivateStaff(actor('studio_manager'), 'target')).rejects.toThrow(revokeError);
    expect(authMock.updateUser).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
    expect(auditLogService.record).not.toHaveBeenCalled();
  });

  // 3. disableUser failure — sessions already revoked; must NOT claim
  // Firestore success, must NOT silently drop it, must still throw.
  it('records a staff.deactivate_failed audit entry and rethrows when disableUser fails after revoke succeeded', async () => {
    const { service, authMock, batch, auditLogService } = buildHarness({
      target: { permissionRole: 'staff', active: true },
    });
    const disableError = new Error('disable failed');
    authMock.updateUser.mockRejectedValueOnce(disableError);

    await expect(service.deactivateStaff(actor('studio_manager'), 'target')).rejects.toThrow(disableError);

    // Sessions were already revoked before the failure.
    expect(authMock.revokeRefreshTokens).toHaveBeenCalledWith('target');
    // Firestore must NOT be told the account is inactive — Auth doesn't
    // actually guarantee that yet.
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(auditLogService.recordInBatch).not.toHaveBeenCalled();
    // But the failure itself must be durably recorded, not swallowed.
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'staff.deactivate_failed',
        entityId: 'target',
        before: { active: true },
      }),
    );
  });

  it('still records staff.deactivate_failed with the accurate prior active value when the target was already inactive', async () => {
    const { service, authMock, auditLogService } = buildHarness({
      target: { permissionRole: 'staff', active: false },
    });
    authMock.updateUser.mockRejectedValueOnce(new Error('disable failed'));

    await expect(service.deactivateStaff(actor('studio_manager'), 'target')).rejects.toThrow();
    expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ before: { active: false } }));
  });

  // 4. Firestore batch failure AFTER successful Auth deactivation — Auth
  // is already genuinely locked out (fail-closed holds); the error still
  // propagates so the caller/operator knows to reconcile Firestore.
  it('rethrows when the Firestore batch fails after both Auth steps already succeeded', async () => {
    const { service, authMock, batch } = buildHarness({ target: { permissionRole: 'staff', active: true } });
    const firestoreError = new Error('firestore unavailable');
    batch.commit.mockRejectedValueOnce(firestoreError);

    await expect(service.deactivateStaff(actor('studio_manager'), 'target')).rejects.toThrow(firestoreError);
    // Both Auth-side steps already completed — the account IS locked out,
    // regardless of the Firestore failure.
    expect(authMock.revokeRefreshTokens).toHaveBeenCalledWith('target');
    expect(authMock.updateUser).toHaveBeenCalledWith('target', { disabled: true });
  });
});

describe('StaffService.changeStaffRole', () => {
  it('denies changing your own role', async () => {
    const { service } = buildHarness();
    await expect(service.changeStaffRole(actor('owner_admin'), 'actor-uid', 'staff')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies a Studio Manager from promoting a Staff-tier target to Studio Manager', async () => {
    const { service } = buildHarness({ target: { permissionRole: 'staff' } });
    await expect(
      service.changeStaffRole(actor('studio_manager'), 'target', 'studio_manager'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('revokes sessions before granting the new claim, before the Firestore write', async () => {
    const { service, callOrder } = buildHarness({ target: { permissionRole: 'staff' } });
    await service.changeStaffRole(actor('owner_admin'), 'target', 'studio_manager');
    expect(callOrder).toEqual(['revokeRefreshTokens', 'setCustomUserClaims', 'batch.commit']);
  });
});
