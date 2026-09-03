import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';
import { calculatePackageExpiryDate, consumePackageUsage, isPackageUsageEligible } from '@autodeck/domain';
import { FIREBASE_ADMIN_APP } from '../auth/firebase-admin.provider';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { AuditLogService } from '../audit/audit-log.service';
import { CustomersService } from '../customers/customers.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { PackageDefinitionsService } from './package-definitions.service';
import type { CustomerPackageRecord, PackageUsageRecord } from './customer-packages.types';
import type { CreateCustomerPackageDto } from './dto/create-customer-package.dto';
import type { ConsumePackageUsageDto } from './dto/consume-package-usage.dto';

/**
 * Package purchase and usage consumption.
 *
 * Purchase (`createCustomerPackage`) mirrors every other creation endpoint
 * in this codebase: a plain Firestore `WriteBatch`, since there is no
 * contested counter involved yet. Payment is explicitly out of scope here
 * — per the approved product decisions, packages are "100% upfront,"
 * but actually collecting that payment is Phase 2J's job, once Razorpay
 * integration exists; this method only records the sale as authoritative,
 * exactly like Phase 2E's BookingsService.createBooking never collects the
 * advance it computes.
 *
 * `totalQty`, `pricePaid`, and `expiresAt` are snapshotted once here from
 * the referenced package definition — see customer-packages.types.ts.
 *
 * Consumption (`consumeUsage`) is the one place in this entire backend that
 * uses a real Firestore `Transaction` instead of a `WriteBatch` — required
 * because `firebase/firestore.rules`' own comment on `packageUsage/{id}`
 * says so explicitly ("the atomic consume transaction runs via the Admin
 * SDK"), and `consumePackageUsage`'s own doc comment
 * (packages/domain/src/packages.ts, Phase 2A) says the same: "the eventual
 * caller... is responsible for calling this inside a real Firestore
 * `runTransaction` against a freshly-read, consistent snapshot" — to
 * prevent two concurrent consume calls from both reading the same
 * `remainingQty` and both succeeding (a double-spend). The vehicle
 * ownership check is read beforehand, outside the transaction: it is not a
 * contested resource, so pre-validating it keeps the transaction itself
 * focused only on the customer package's own contested counters.
 */
@Injectable()
export class CustomerPackagesService {
  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly app: admin.app.App,
    private readonly auditLogService: AuditLogService,
    private readonly customersService: CustomersService,
    private readonly vehiclesService: VehiclesService,
    private readonly packageDefinitionsService: PackageDefinitionsService,
  ) {}

  private async getCustomerPackageRecord(customerPackageId: string): Promise<CustomerPackageRecord | null> {
    const snapshot = await this.app.firestore().collection('customerPackages').doc(customerPackageId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as CustomerPackageRecord;
  }

  /**
   * `customerId` is the validated `:customerId` route parameter (see
   * CustomerPackagesController), never client body input.
   */
  async createCustomerPackage(
    actor: AuthenticatedUser,
    customerId: string,
    input: CreateCustomerPackageDto,
  ): Promise<CustomerPackageRecord> {
    const customer = await this.customersService.getCustomerRecord(customerId);
    if (!customer) {
      throw new NotFoundException('Customer record not found');
    }

    const packageDefinition = await this.packageDefinitionsService.getPackageDefinitionRecord(
      input.packageDefinitionId,
    );
    if (!packageDefinition) {
      throw new NotFoundException('Package definition record not found');
    }

    const firestore = this.app.firestore();
    const docRef = firestore.collection('customerPackages').doc();
    const requestId = randomUUID();
    const now = new Date();
    const expiresAt = calculatePackageExpiryDate(now, packageDefinition.validityDuration);

    const record: CustomerPackageRecord = {
      customerPackageId: docRef.id,
      customerId,
      packageDefinitionId: input.packageDefinitionId,
      totalQty: packageDefinition.quantity,
      usedQty: 0,
      remainingQty: packageDefinition.quantity,
      pricePaid: packageDefinition.price,
      purchaseDate: admin.firestore.Timestamp.fromDate(now),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByStaffId: actor.uid,
    };

    const batch = firestore.batch();
    batch.set(docRef, record);
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'customerPackage.create',
      entityType: 'customerPackage',
      entityId: docRef.id,
      after: {
        customerId,
        packageDefinitionId: input.packageDefinitionId,
        totalQty: packageDefinition.quantity,
        pricePaid: packageDefinition.price,
      },
      requestId,
    });
    await batch.commit();

    return record;
  }

  /**
   * Consumes exactly one unit of a customer package against a specific
   * vehicle. The vehicle must belong to the SAME customer who owns the
   * package (checked against the package's own authoritative `customerId`,
   * read inside the transaction — never trusted from the client).
   */
  async consumeUsage(
    actor: AuthenticatedUser,
    customerPackageId: string,
    input: ConsumePackageUsageDto,
  ): Promise<PackageUsageRecord> {
    const vehicle = await this.vehiclesService.getVehicleRecord(input.vehicleId);
    if (!vehicle) {
      throw new NotFoundException('Vehicle record not found');
    }

    const firestore = this.app.firestore();
    const customerPackageRef = firestore.collection('customerPackages').doc(customerPackageId);
    const usageRef = firestore.collection('packageUsage').doc();
    const requestId = randomUUID();
    const now = new Date();

    return firestore.runTransaction(async (transaction): Promise<PackageUsageRecord> => {
      const snapshot = await transaction.get(customerPackageRef);
      if (!snapshot.exists) {
        throw new NotFoundException('Customer package record not found');
      }
      const customerPackage = snapshot.data() as CustomerPackageRecord;

      if (vehicle.ownerCustomerId !== customerPackage.customerId) {
        throw new BadRequestException('Vehicle does not belong to the package owner');
      }

      const expiresAt = customerPackage.expiresAt.toDate();
      if (!isPackageUsageEligible({ remainingQty: customerPackage.remainingQty, expiresAt }, now)) {
        throw new ConflictException('Package is not eligible for use (no remaining quantity, or expired)');
      }

      const result = consumePackageUsage(
        { totalQty: customerPackage.totalQty, usedQty: customerPackage.usedQty, remainingQty: customerPackage.remainingQty },
        expiresAt,
        now,
      );

      transaction.update(customerPackageRef, { usedQty: result.usedQty, remainingQty: result.remainingQty });

      const record: PackageUsageRecord = {
        packageUsageId: usageRef.id,
        customerPackageId,
        customerId: customerPackage.customerId,
        vehicleId: input.vehicleId,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
        usedByStaffId: actor.uid,
      };
      transaction.set(usageRef, record);

      this.auditLogService.recordInTransaction(transaction, {
        actorId: actor.uid,
        actorRole: actor.role,
        action: 'packageUsage.consume',
        entityType: 'packageUsage',
        entityId: usageRef.id,
        after: {
          customerPackageId,
          vehicleId: input.vehicleId,
          remainingQty: result.remainingQty,
        },
        requestId,
      });

      return record;
    });
  }
}
