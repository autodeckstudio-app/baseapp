"use client";

import { useEffect, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import type { InventoryItem, InventoryTxn, InventoryTxnType } from "@autodeck/core";
import {
  listenToInventory,
  listenToItemTxns,
  addInventoryItem,
  recordInventoryTxn,
  setInventoryItemActive,
} from "../../../lib/inventory-service";
import { useAdminAuth } from "../../../lib/auth-context";
import { InventoryView } from "../../../experience/InventoryView";

export default function InventoryPage() {
  const { claims } = useAdminAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [txns, setTxns] = useState<InventoryTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const studioId = claims?.studioId ?? FIRST_STUDIO_ID;

  useEffect(() => {
    if (!claims) return;
    const unsub = listenToInventory(
      claims.tenantId,
      studioId,
      (rows) => { setItems(rows); setLoading(false); },
      () => { setError("Couldn't load inventory."); setLoading(false); },
    );
    return unsub;
  }, [claims, studioId]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    if (!claims || !selectedId) { setTxns([]); return; }
    const unsub = listenToItemTxns(
      claims.tenantId,
      selectedId,
      setTxns,
      () => setError("Couldn't load the movement log."),
    );
    return unsub;
  }, [claims, selectedId]);

  async function run(action: () => Promise<unknown>, ok: string, fail: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(ok);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : fail);
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = claims?.role === "admin" || claims?.role === "superadmin";

  return (
    <InventoryView
      items={items}
      selected={selected}
      txns={txns}
      isAdmin={isAdmin}
      loading={loading}
      busy={busy}
      error={error}
      message={message}
      onSelect={(item) => setSelectedId(item?.id ?? null)}
      onAdd={(input) =>
        void run(
          () =>
            addInventoryItem({
              studioId,
              name: input.name,
              category: input.category,
              unit: input.unit,
              stockQty: input.stockQty,
              lowStockThreshold: input.lowStockThreshold,
              costPerUnit: input.costPerUnitPaise,
            }),
          "Item added.",
          "Couldn't add the item.",
        )
      }
      onTxn={(item, type: InventoryTxnType, qtyDelta, notes) =>
        void run(
          () =>
            recordInventoryTxn({
              itemId: item.id,
              type,
              qtyDelta,
              ...(notes ? { notes } : {}),
            }).then((r) => r),
          "Movement recorded.",
          "Couldn't record the movement.",
        )
      }
      onDeactivate={(item) => void run(() => setInventoryItemActive(item.id, false).then(() => setSelectedId(null)), "Item deactivated.", "Couldn't deactivate the item.")}
    />
  );
}
