import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';
import { FIREBASE_ADMIN_APP } from '../auth/firebase-admin.provider';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { AuditLogService } from '../audit/audit-log.service';
import { ServicesService } from '../services/services.service';
import type { PackageDefinitionRecord } from './package-definitions.types';
import type { CreatePackageDefinitionDto } from './dto/create-package-definition.dto';
import type { UpdatePackageDefinitionDto } from './dto/update-package-definition.dto';

/**
 * Package catalogue creation and update — the admin-defined "types" (e.g.
 * "10 Washes") customers later purchase. Studio-Manager-or-above only (see
 * `@Roles('studio_manager')` on the controller), matching the approved
 * product decisions ("Studio Manager: ...packages...", "Staff cannot:
 * ...define/edit packages...") and mirroring ServicesController's
 * identical elevated tier for pricing-catalogue control.
 *
 * `includedServiceId` is validated against the authoritative
 * `services/{id}` collection via `ServicesService.getServiceRecord` — a
 * package definition can never reference a service that doesn't exist.
 */
@Injectable()
export class PackageDefinitionsService {
  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly app: admin.app.App,
    private readonly auditLogService: AuditLogService,
    private readonly servicesService: ServicesService,
  ) {}

  /** Exposed for CustomerPackagesService, which must read a package
   * definition's authoritative quantity/price/validity before recording a
   * purchase — never to let a caller read arbitrary data through a side
   * channel. Mirrors ServicesService.getServiceRecord's existing role. */
  async getPackageDefinitionRecord(packageDefinitionId: string): Promise<PackageDefinitionRecord | null> {
    const snapshot = await this.app.firestore().collection('packageDefinitions').doc(packageDefinitionId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as PackageDefinitionRecord;
  }

  async createPackageDefinition(
    actor: AuthenticatedUser,
    input: CreatePackageDefinitionDto,
  ): Promise<PackageDefinitionRecord> {
    const service = await this.servicesService.getServiceRecord(input.includedServiceId);
    if (!service) {
      throw new NotFoundException('Service record not found');
    }

    const firestore = this.app.firestore();
    const docRef = firestore.collection('packageDefinitions').doc();
    const requestId = randomUUID();

    const record: PackageDefinitionRecord = {
      packageDefinitionId: docRef.id,
      name: input.name,
      includedServiceId: input.includedServiceId,
      quantity: input.quantity,
      price: input.price,
      validityDuration: input.validityDuration,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByStaffId: actor.uid,
    };

    const batch = firestore.batch();
    batch.set(docRef, record);
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'packageDefinition.create',
      entityType: 'packageDefinition',
      entityId: docRef.id,
      after: {
        name: input.name,
        includedServiceId: input.includedServiceId,
        quantity: input.quantity,
        price: input.price,
        validityDuration: input.validityDuration,
      },
      requestId,
    });
    await batch.commit();

    return record;
  }

  async updatePackageDefinition(
    actor: AuthenticatedUser,
    packageDefinitionId: string,
    input: UpdatePackageDefinitionDto,
  ): Promise<void> {
    const existing = await this.getPackageDefinitionRecord(packageDefinitionId);
    if (!existing) {
      throw new NotFoundException('Package definition record not found');
    }

    if (input.includedServiceId) {
      const service = await this.servicesService.getServiceRecord(input.includedServiceId);
      if (!service) {
        throw new NotFoundException('Service record not found');
      }
    }

    const requestId = randomUUID();
    const firestore = this.app.firestore();
    const batch = firestore.batch();
    batch.update(firestore.collection('packageDefinitions').doc(packageDefinitionId), { ...input });
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'packageDefinition.update',
      entityType: 'packageDefinition',
      entityId: packageDefinitionId,
      before: {
        name: existing.name,
        includedServiceId: existing.includedServiceId,
        quantity: existing.quantity,
        price: existing.price,
        validityDuration: existing.validityDuration,
      },
      after: { ...input },
      requestId,
    });
    await batch.commit();
  }
}
