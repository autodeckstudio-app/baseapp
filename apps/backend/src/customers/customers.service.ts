import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';
import { FIREBASE_ADMIN_APP } from '../auth/firebase-admin.provider';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { AuditLogService } from '../audit/audit-log.service';
import type { CustomerRecord } from './customers.types';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

/**
 * Customer profile creation and update. Staff-tier and above only (per
 * @Roles('staff') on the controller) — there is no customer-facing write
 * endpoint here or anywhere else; a customer's own read access is already
 * granted directly against Firestore by the existing `customers/{id}` rule,
 * not through this API.
 */
@Injectable()
export class CustomersService {
  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly app: admin.app.App,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Exposed for VehiclesService, which must confirm a customer exists before
   * creating a vehicle under it — never to let a caller read arbitrary
   * customer data through a side channel. */
  async getCustomerRecord(customerId: string): Promise<CustomerRecord | null> {
    const snapshot = await this.app.firestore().collection('customers').doc(customerId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as CustomerRecord;
  }

  /**
   * `customerId` is always a fresh, backend-generated Firestore document ID
   * — the DTO has no such field, so there is nothing for a client to
   * override even if it tried.
   */
  async createCustomer(actor: AuthenticatedUser, input: CreateCustomerDto): Promise<CustomerRecord> {
    const firestore = this.app.firestore();
    const docRef = firestore.collection('customers').doc();
    const requestId = randomUUID();

    const record: CustomerRecord = {
      customerId: docRef.id,
      name: input.name,
      phone: input.phone,
      email: input.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByStaffId: actor.uid,
    };

    const batch = firestore.batch();
    batch.set(docRef, record);
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'customer.create',
      entityType: 'customer',
      entityId: docRef.id,
      after: { name: input.name, phone: input.phone, email: input.email },
      requestId,
    });
    await batch.commit();

    return record;
  }

  async updateCustomer(actor: AuthenticatedUser, customerId: string, input: UpdateCustomerDto): Promise<void> {
    const existing = await this.getCustomerRecord(customerId);
    if (!existing) {
      throw new NotFoundException('Customer record not found');
    }

    const requestId = randomUUID();
    const firestore = this.app.firestore();
    const batch = firestore.batch();
    batch.update(firestore.collection('customers').doc(customerId), { ...input });
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'customer.update',
      entityType: 'customer',
      entityId: customerId,
      before: { name: existing.name, phone: existing.phone, email: existing.email },
      after: { ...input },
      requestId,
    });
    await batch.commit();
  }
}
