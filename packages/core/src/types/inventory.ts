export type InventoryCategory = "PPF_FILM" | "CERAMIC" | "WASH" | "INTERIOR" | "OTHER";
export type InventoryUnit = "ML" | "FT" | "PCS" | "GM";

/** A stockable consumable or material at a studio. */
export interface InventoryItem {
  id: string;
  tenantId: string;
  studioId: string;
  name: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  stockQty: number;
  lowStockThreshold: number;
  costPerUnit: number; // paise per unit
  active: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export type InventoryTxnType = "PURCHASE" | "USAGE" | "ADJUSTMENT" | "WASTAGE";

/**
 * One stock movement. Written only inside recordInventoryTxn's transaction,
 * which also updates the item's stockQty — the txn log is the audit trail
 * for every quantity change.
 */
export interface InventoryTxn {
  id: string;
  tenantId: string;
  studioId: string;
  itemId: string;
  type: InventoryTxnType;
  qtyDelta: number; // positive = stock in, negative = stock out
  refType: "job" | "invoice" | "none";
  refId: string | null;
  notes: string | null;
  createdBy: string; // auth uid
  createdAt: string; // ISO
}
