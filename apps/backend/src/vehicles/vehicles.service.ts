import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';
import { FIREBASE_ADMIN_APP } from '../auth/firebase-admin.provider';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { AuditLogService } from '../audit/audit-log.service';
import { CustomersService } from '../customers/customers.service';
import type { VehicleRecord } from './vehicles.types';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto';

/**
 * Vehicle creation and update, always scoped under an existing customer.
 * `ownerCustomerId` is the ONLY authorization-relevant field here and is
 * NEVER read from client input — it is always the `customerId` this method
 * receives as a parameter (the controller takes it from the URL, not the
 * body), and is only accepted after confirming that customer record exists.
 */
@Injectable()
export class VehiclesService {
  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly app: admin.app.App,
    private readonly auditLogService: AuditLogService,
    private readonly customersService: CustomersService,
  ) {}

  /** Exposed for BookingsService, which must confirm a vehicle exists and
   * belongs to the expected customer before creating a booking under it —
   * never to let a caller read arbitrary vehicle data through a side
   * channel. Mirrors CustomersService.getCustomerRecord's existing role. */
  async getVehicleRecord(vehicleId: string): Promise<VehicleRecord | null> {
    const snapshot = await this.app.firestore().collection('vehicles').doc(vehicleId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as VehicleRecord;
  }

  async createVehicle(
    actor: AuthenticatedUser,
    customerId: string,
    input: CreateVehicleDto,
  ): Promise<VehicleRecord> {
    const customer = await this.customersService.getCustomerRecord(customerId);
    if (!customer) {
      throw new NotFoundException('Customer record not found');
    }

    const firestore = this.app.firestore();
    const docRef = firestore.collection('vehicles').doc();
    const requestId = randomUUID();

    const record: VehicleRecord = {
      vehicleId: docRef.id,
      make: input.make,
      model: input.model,
      plate: input.plate,
      ownerCustomerId: customerId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByStaffId: actor.uid,
    };

    const batch = firestore.batch();
    batch.set(docRef, record);
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'vehicle.create',
      entityType: 'vehicle',
      entityId: docRef.id,
      after: { make: input.make, model: input.model, plate: input.plate, ownerCustomerId: customerId },
      requestId,
    });
    await batch.commit();

    return record;
  }

  async updateVehicle(actor: AuthenticatedUser, vehicleId: string, input: UpdateVehicleDto): Promise<void> {
    const existing = await this.getVehicleRecord(vehicleId);
    if (!existing) {
      throw new NotFoundException('Vehicle record not found');
    }

    const requestId = randomUUID();
    const firestore = this.app.firestore();
    const batch = firestore.batch();
    batch.update(firestore.collection('vehicles').doc(vehicleId), { ...input });
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'vehicle.update',
      entityType: 'vehicle',
      entityId: vehicleId,
      before: { make: existing.make, model: existing.model, plate: existing.plate },
      after: { ...input },
      requestId,
    });
    await batch.commit();
  }
}
