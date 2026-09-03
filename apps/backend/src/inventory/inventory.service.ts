import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';
import { computeStockAfterUsage, isLowStock } from '@autodeck/domain';
import { FIREBASE_ADMIN_APP } from '../auth/firebase-admin.provider';
import type { AuthenticatedUser } from '../auth/firebase-auth.guard';
import { AuditLogService } from '../audit/audit-log.service';
import type { InventoryItemRecord, InventoryUsageRecord } from './inventory.types';
import type { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import type { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import type { RestockInventoryItemDto } from './dto/restock-inventory-item.dto';
import type { RecordInventoryUsageDto } from './dto/record-inventory-usage.dto';

/**
 * Minimal V1 inventory: item definitions, restocking, and usage recording.
 * No recipes, no supplier management, no reordering workflows, and no
 * linkage to Services/Bookings/Visits/Packages — none of that is required
 * by the approved product decisions ("Minimal inventory in V1... Advanced
 * recipes, supplier management, and reordering workflows are Later"), and
 * none is prepared for here.
 *
 * `currentStock` is a contested counter, exactly like Phase 2H's
 * `customerPackages/{id}.remainingQty`: `restock` and `recordUsage` both
 * run inside a real Firestore `Transaction` (never a `WriteBatch`) to
 * prevent two concurrent mutations from both reading the same
 * `currentStock` and both succeeding. `createInventoryItem` and
 * `updateInventoryItem` use a plain `WriteBatch`, matching every other
 * creation/update endpoint in this codebase, since neither touches
 * `currentStock` at all (creation sets it once, uncontested; update
 * excludes it entirely — see update-inventory-item.dto.ts).
 *
 * There is no "add stock" domain function in `packages/domain` — only
 * `computeStockAfterUsage` (deduction) exists there, because deduction has
 * a real invariant worth a reusable pure function (never goes negative);
 * plain addition has none, so `restock`'s arithmetic is inline here rather
 * than adding a trivial function to a Phase 2A file for no functional
 * reason. There is also no `inventoryReceipts`/movement-history
 * collection: only `inventory` and `inventoryUsage` are approved in
 * `firebase/firestore.rules`, so a restock event's history lives in the
 * append-only `auditLogs` collection, exactly like every other mutation's
 * history in this codebase — not a bespoke new collection.
 */
@Injectable()
export class InventoryService {
  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly app: admin.app.App,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async getInventoryItemRecord(inventoryItemId: string): Promise<InventoryItemRecord | null> {
    const snapshot = await this.app.firestore().collection('inventory').doc(inventoryItemId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as InventoryItemRecord;
  }

  async createInventoryItem(actor: AuthenticatedUser, input: CreateInventoryItemDto): Promise<InventoryItemRecord> {
    const firestore = this.app.firestore();
    const docRef = firestore.collection('inventory').doc();
    const requestId = randomUUID();

    const record: InventoryItemRecord = {
      inventoryItemId: docRef.id,
      name: input.name,
      currentStock: input.currentStock,
      lowStockThreshold: input.lowStockThreshold,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByStaffId: actor.uid,
    };

    const batch = firestore.batch();
    batch.set(docRef, record);
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'inventoryItem.create',
      entityType: 'inventoryItem',
      entityId: docRef.id,
      after: { name: input.name, currentStock: input.currentStock, lowStockThreshold: input.lowStockThreshold },
      requestId,
    });
    await batch.commit();

    return record;
  }

  async updateInventoryItem(
    actor: AuthenticatedUser,
    inventoryItemId: string,
    input: UpdateInventoryItemDto,
  ): Promise<void> {
    const existing = await this.getInventoryItemRecord(inventoryItemId);
    if (!existing) {
      throw new NotFoundException('Inventory item record not found');
    }

    const requestId = randomUUID();
    const firestore = this.app.firestore();
    const batch = firestore.batch();
    batch.update(firestore.collection('inventory').doc(inventoryItemId), { ...input });
    this.auditLogService.recordInBatch(batch, {
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'inventoryItem.update',
      entityType: 'inventoryItem',
      entityId: inventoryItemId,
      before: { name: existing.name, lowStockThreshold: existing.lowStockThreshold },
      after: { ...input },
      requestId,
    });
    await batch.commit();
  }

  /** Adds received stock. Transaction-protected against a concurrent
   * restock or usage-recording call racing on the same `currentStock`. */
  async restock(
    actor: AuthenticatedUser,
    inventoryItemId: string,
    input: RestockInventoryItemDto,
  ): Promise<{ currentStock: number; isLowStock: boolean }> {
    const firestore = this.app.firestore();
    const itemRef = firestore.collection('inventory').doc(inventoryItemId);
    const requestId = randomUUID();

    return firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(itemRef);
      if (!snapshot.exists) {
        throw new NotFoundException('Inventory item record not found');
      }
      const item = snapshot.data() as InventoryItemRecord;
      const newStock = item.currentStock + input.quantityReceived;

      transaction.update(itemRef, { currentStock: newStock });
      this.auditLogService.recordInTransaction(transaction, {
        actorId: actor.uid,
        actorRole: actor.role,
        action: 'inventoryItem.restock',
        entityType: 'inventoryItem',
        entityId: inventoryItemId,
        before: { currentStock: item.currentStock },
        after: { currentStock: newStock },
        requestId,
      });

      return { currentStock: newStock, isLowStock: isLowStock(newStock, item.lowStockThreshold) };
    });
  }

  /** Deducts used stock via the existing `computeStockAfterUsage` domain
   * function — never reimplemented. Transaction-protected for the same
   * reason as `restock`: `currentStock` is a shared, contested counter. */
  async recordUsage(
    actor: AuthenticatedUser,
    inventoryItemId: string,
    input: RecordInventoryUsageDto,
  ): Promise<InventoryUsageRecord> {
    const firestore = this.app.firestore();
    const itemRef = firestore.collection('inventory').doc(inventoryItemId);
    const usageRef = firestore.collection('inventoryUsage').doc();
    const requestId = randomUUID();

    return firestore.runTransaction(async (transaction): Promise<InventoryUsageRecord> => {
      const snapshot = await transaction.get(itemRef);
      if (!snapshot.exists) {
        throw new NotFoundException('Inventory item record not found');
      }
      const item = snapshot.data() as InventoryItemRecord;

      let newStock: number;
      try {
        newStock = computeStockAfterUsage(item.currentStock, input.quantityUsed);
      } catch (error) {
        throw new ConflictException(
          error instanceof Error ? error.message : 'Cannot record this usage against current stock',
        );
      }

      transaction.update(itemRef, { currentStock: newStock });

      const record: InventoryUsageRecord = {
        inventoryUsageId: usageRef.id,
        inventoryItemId,
        quantityUsed: input.quantityUsed,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
        usedByStaffId: actor.uid,
      };
      transaction.set(usageRef, record);

      this.auditLogService.recordInTransaction(transaction, {
        actorId: actor.uid,
        actorRole: actor.role,
        action: 'inventoryUsage.record',
        entityType: 'inventoryUsage',
        entityId: usageRef.id,
        after: {
          inventoryItemId,
          quantityUsed: input.quantityUsed,
          remainingStock: newStock,
          isLowStock: isLowStock(newStock, item.lowStockThreshold),
        },
        requestId,
      });

      return record;
    });
  }
}
