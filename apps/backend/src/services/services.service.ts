import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';
import { FIREBASE_ADMIN_APP } from '../auth/firebase-admin.provider';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { AuditLogService } from '../audit/audit-log.service';
import type { ServiceRecord } from './services.types';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';

/**
 * Service catalogue creation and update. `basePrice` is only ever written
 * here, by a Studio-Manager-or-above caller (see `@Roles('studio_manager')`
 * on the controller) — there is no other write path anywhere in the
 * codebase, and no booking/mutation endpoint exists yet (that is Phase 2E)
 * that could accept a client-supplied price instead of reading this stored
 * value. This is what "the client can never arbitrarily set or override
 * pricing" resolves to for Phase 2D specifically: only a privileged,
 * server-verified role can touch `basePrice` at all, and only through this
 * service.
 *
 * There is no customer-facing write endpoint, matching every other Phase 2
 * module — a customer's own read access to the catalogue is already granted
 * directly against Firestore by the existing `services/{id}` rule
 * (`allow read: if isSignedIn()`), not through this API.
 */
@Injectable()
export class ServicesService {
  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly app: admin.app.App,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Exposed for BookingsService, which must confirm every referenced
   * service exists (and read its authoritative basePrice) before pricing a
   * booking — never to let a caller read arbitrary service data through a
   * side channel. Mirrors CustomersService.getCustomerRecord's existing
   * role. */
  async getServiceRecord(serviceId: string): Promise<ServiceRecord | null> {
    const snapshot = await this.app.firestore().collection('services').doc(serviceId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as ServiceRecord;
  }

  /**
   * `serviceId` is always a fresh, backend-generated Firestore document ID
   * — the DTO has no such field, so there is nothing for a client to
   * override even if it tried.
   */
  async createService(actor: AuthenticatedUser, input: CreateServiceDto): Promise<ServiceRecord> {
    const firestore = this.app.firestore();
    const docRef = firestore.collection('services').doc();
    const requestId = randomUUID();

    const record: ServiceRecord = {
      serviceId: docRef.id,
      name: input.name,
      basePrice: input.basePrice,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByStaffId: actor.uid,
    };

    const batch = firestore.batch();
    batch.set(docRef, record);
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'service.create',
      entityType: 'service',
      entityId: docRef.id,
      after: { name: input.name, basePrice: input.basePrice },
      requestId,
    });
    await batch.commit();

    return record;
  }

  async updateService(actor: AuthenticatedUser, serviceId: string, input: UpdateServiceDto): Promise<void> {
    const existing = await this.getServiceRecord(serviceId);
    if (!existing) {
      throw new NotFoundException('Service record not found');
    }

    const requestId = randomUUID();
    const firestore = this.app.firestore();
    const batch = firestore.batch();
    batch.update(firestore.collection('services').doc(serviceId), { ...input });
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'service.update',
      entityType: 'service',
      entityId: serviceId,
      before: { name: existing.name, basePrice: existing.basePrice },
      after: { ...input },
      requestId,
    });
    await batch.commit();
  }
}
