"use client";

import { collection, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { InventoryCategory, InventoryItem, InventoryTxn, InventoryTxnType, InventoryUnit } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

/** Live item feed for one studio (active items only). */
export function listenToInventory(
  tenantId: string,
  studioId: string,
  onData: (items: InventoryItem[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.inventoryItems()),
    where("tenantId", "==", tenantId),
    where("studioId", "==", studioId),
    where("active", "==", true),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as InventoryItem).sort((a, b) => a.name.localeCompare(b.name))),
    onError,
  );
}

/** Live movement log for one item, newest first (client-sorted, capped). */
export function listenToItemTxns(
  tenantId: string,
  itemId: string,
  onData: (txns: InventoryTxn[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.inventoryTxns()),
    where("tenantId", "==", tenantId),
    where("itemId", "==", itemId),
  );
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs
          .map((d) => d.data() as InventoryTxn)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 50),
      ),
    onError,
  );
}

export async function addInventoryItem(input: {
  studioId: string;
  name: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  stockQty?: number;
  lowStockThreshold?: number;
  costPerUnit?: number;
}): Promise<{ id: string }> {
  const fn = httpsCallable<typeof input, { id: string }>(functions, "addInventoryItem");
  return (await fn(input)).data;
}

export async function recordInventoryTxn(input: {
  itemId: string;
  type: InventoryTxnType;
  qtyDelta: number;
  notes?: string;
}): Promise<{ id: string; stockQty: number }> {
  const fn = httpsCallable<typeof input, { id: string; stockQty: number }>(functions, "recordInventoryTxn");
  return (await fn(input)).data;
}

export async function setInventoryItemActive(itemId: string, active: boolean): Promise<void> {
  const fn = httpsCallable<{ itemId: string; active: boolean }, { id: string }>(functions, "updateInventoryItem");
  await fn({ itemId, active });
}
