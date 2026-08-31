import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';
import { FIREBASE_ADMIN_APP } from '../auth/firebase-admin.provider';
import { canManageTargetRole, type PermissionRole } from '../auth/role.type';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { AuditLogService } from '../audit/audit-log.service';
import type { StaffRecord } from './staff.types';
import type { CreateStaffDto } from './dto/create-staff.dto';

/**
 * Staff account provisioning, role assignment, and deactivation.
 *
 * Firebase Auth and Firestore are separate systems and are never claimed
 * to be atomic with each other — only same-system Firestore writes (the
 * `staff` document + its audit entry) are committed as one real
 * `WriteBatch`. See the method-level comments for the exact, deliberate
 * ordering used to fail closed across the two systems.
 */
@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly app: admin.app.App,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async getStaffRecord(staffId: string): Promise<StaffRecord | null> {
    const snapshot = await this.app.firestore().collection('staff').doc(staffId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as StaffRecord;
  }

  /**
   * Order: create the Auth account -> write the Firestore record + audit
   * entry atomically -> grant the custom claim LAST. No real authority is
   * ever granted before the Firestore record durably exists. If the
   * Firestore batch fails, the just-created Auth account is deleted
   * (best-effort compensation) so no orphaned, claim-less account is left
   * behind.
   */
  async createStaff(actor: AuthenticatedUser, input: CreateStaffDto): Promise<StaffRecord> {
    if (!canManageTargetRole(actor.role, input.role)) {
      throw new ForbiddenException(
        `Role "${actor.role}" is not permitted to create an account with role "${input.role}"`,
      );
    }

    let uid: string;
    try {
      const userRecord = await this.app.auth().createUser({
        email: input.email,
        displayName: input.name,
      });
      uid = userRecord.uid;
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/email-already-exists') {
        throw new ConflictException('A staff account with this email already exists');
      }
      throw error;
    }

    const requestId = randomUUID();
    const record: StaffRecord = {
      staffId: uid,
      name: input.name,
      phone: input.phone,
      email: input.email,
      jobTitle: input.jobTitle,
      permissionRole: input.role,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByStaffId: actor.uid,
    };

    try {
      const firestore = this.app.firestore();
      const batch = firestore.batch();
      batch.set(firestore.collection('staff').doc(uid), record);
      this.auditLogService.recordInBatch(batch, {
        actorId: actor.uid,
        actorRole: actor.role,
        action: 'staff.create',
        entityType: 'staff',
        entityId: uid,
        after: { name: input.name, jobTitle: input.jobTitle, permissionRole: input.role },
        requestId,
      });
      await batch.commit();
    } catch (error) {
      this.logger.error(
        `Firestore write failed while creating staff ${uid}; deleting the orphaned Auth account`,
        error instanceof Error ? error.stack : String(error),
      );
      try {
        await this.app.auth().deleteUser(uid);
      } catch (cleanupError) {
        this.logger.error(
          `Failed to clean up orphaned Auth account ${uid} after a failed staff creation`,
          cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
        );
      }
      throw error;
    }

    // Granted last: only once the Firestore record durably exists. If this
    // throws, the account has no valid role claim yet — FirebaseAuthGuard
    // rejects any token from it (fails closed), recoverable by retrying
    // just this step.
    await this.app.auth().setCustomUserClaims(uid, { role: input.role });

    return record;
  }

  /**
   * Order: revoke sessions -> disable the Auth account -> update the
   * Firestore record + audit entry atomically, as one batch.
   *
   * The actually-enforced deactivation is the Auth-side steps: revoking
   * refresh tokens invalidates already-issued ID tokens (FirebaseAuthGuard
   * already checks this — no guard change needed), and disabling the
   * account blocks any future sign-in. Firestore's `active: false` is a
   * denormalized record for display/admin purposes — no guard reads it.
   * The two Auth calls are themselves not atomic with each other, so each
   * failure mode below is handled deliberately rather than assumed away:
   *
   *  - `revokeRefreshTokens` fails: abort entirely, nothing has changed —
   *    the safest possible outcome, no special handling needed.
   *  - `updateUser(disabled)` fails AFTER revoke succeeded: sessions are
   *    dead, but the account can still be signed into FRESH with its
   *    unchanged privileges — deactivation only partially took effect.
   *    Firestore must NOT be set to `active: false` here (that would
   *    overstate what Auth actually enforced), and this must not be
   *    silently dropped either — a `staff.deactivate_failed` audit entry
   *    records exactly this partial state, then the original error is
   *    rethrown so the caller never sees a false success.
   *  - The final Firestore batch fails AFTER both Auth steps succeeded:
   *    the account is already genuinely, fully locked out — fail-closed
   *    already holds. Only the Firestore display record and audit trail
   *    go stale; this is logged clearly (no compensating action exists or
   *    is needed) and the error is rethrown.
   */
  async deactivateStaff(actor: AuthenticatedUser, targetStaffId: string): Promise<void> {
    if (targetStaffId === actor.uid) {
      throw new ForbiddenException('Cannot deactivate your own account');
    }

    const target = await this.getStaffRecord(targetStaffId);
    if (!target) {
      throw new NotFoundException('Staff record not found');
    }
    if (!canManageTargetRole(actor.role, target.permissionRole)) {
      throw new ForbiddenException(
        `Role "${actor.role}" is not permitted to deactivate an account with role "${target.permissionRole}"`,
      );
    }

    const requestId = randomUUID();

    // Step 1: revoke existing sessions. If this throws, nothing further
    // runs — the method simply rethrows, and no state has changed anywhere.
    await this.app.auth().revokeRefreshTokens(targetStaffId);

    // Step 2: disable the account so no FUTURE sign-in can succeed either.
    try {
      await this.app.auth().updateUser(targetStaffId, { disabled: true });
    } catch (disableError) {
      this.logger.error(
        `Deactivation of staff ${targetStaffId} only partially completed: sessions were revoked but ` +
          `the account could not be disabled. Firestore was NOT updated (active remains ${target.active}). ` +
          'This account can still be signed into fresh with its existing privileges until this is retried.',
        disableError instanceof Error ? disableError.stack : String(disableError),
      );
      try {
        await this.auditLogService.record({
          actorId: actor.uid,
          actorRole: actor.role,
          action: 'staff.deactivate_failed',
          entityType: 'staff',
          entityId: targetStaffId,
          before: { active: target.active },
          metadata: {
            reason: 'revokeRefreshTokens succeeded but disableUser failed',
            error: disableError instanceof Error ? disableError.message : String(disableError),
          },
          requestId,
        });
      } catch (auditError) {
        this.logger.error(
          `Failed to write the staff.deactivate_failed audit entry for ${targetStaffId}`,
          auditError instanceof Error ? auditError.stack : String(auditError),
        );
      }
      throw disableError;
    }

    // Both Auth-side steps succeeded — the account is now genuinely,
    // fully locked out regardless of what happens next.
    try {
      const firestore = this.app.firestore();
      const batch = firestore.batch();
      batch.update(firestore.collection('staff').doc(targetStaffId), { active: false });
      this.auditLogService.recordInBatch(batch, {
        actorId: actor.uid,
        actorRole: actor.role,
        action: 'staff.deactivate',
        entityType: 'staff',
        entityId: targetStaffId,
        before: { active: target.active },
        after: { active: false },
        requestId,
      });
      await batch.commit();
    } catch (firestoreError) {
      this.logger.error(
        `Staff ${targetStaffId} was fully deactivated in Firebase Auth (sessions revoked, account ` +
          'disabled), but the Firestore record/audit write failed. The account is genuinely locked out; ' +
          'only the Firestore display record and audit trail are stale and need manual reconciliation.',
        firestoreError instanceof Error ? firestoreError.stack : String(firestoreError),
      );
      throw firestoreError;
    }
  }

  /**
   * Order: revoke sessions FIRST (uniformly, for both promotions and
   * demotions — this closes the "stale elevated/stale-privilege token"
   * window in either direction rather than reasoning about the two
   * directions differently) -> grant the new claim -> update Firestore +
   * audit atomically LAST.
   */
  async changeStaffRole(
    actor: AuthenticatedUser,
    targetStaffId: string,
    newRole: PermissionRole,
  ): Promise<void> {
    if (targetStaffId === actor.uid) {
      throw new ForbiddenException('Cannot change your own role');
    }

    const target = await this.getStaffRecord(targetStaffId);
    if (!target) {
      throw new NotFoundException('Staff record not found');
    }
    if (!canManageTargetRole(actor.role, target.permissionRole) || !canManageTargetRole(actor.role, newRole)) {
      throw new ForbiddenException(
        `Role "${actor.role}" is not permitted to change this account's role to "${newRole}"`,
      );
    }

    await this.app.auth().revokeRefreshTokens(targetStaffId);
    await this.app.auth().setCustomUserClaims(targetStaffId, { role: newRole });

    const requestId = randomUUID();
    const firestore = this.app.firestore();
    const batch = firestore.batch();
    batch.update(firestore.collection('staff').doc(targetStaffId), { permissionRole: newRole });
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'staff.role_change',
      entityType: 'staff',
      entityId: targetStaffId,
      before: { permissionRole: target.permissionRole },
      after: { permissionRole: newRole },
      requestId,
    });
    await batch.commit();
  }
}
