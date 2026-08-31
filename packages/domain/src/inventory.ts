/**
 * Minimal V1 inventory logic: stock levels and usage deduction only, per
 * the approved specification. Recipes, suppliers, and reordering are
 * explicitly Later — no logic for any of that exists here.
 */

export function computeStockAfterUsage(currentStock: number, quantityUsed: number): number {
  if (!Number.isInteger(currentStock) || currentStock < 0) {
    throw new Error('currentStock must be a non-negative integer');
  }
  if (!Number.isInteger(quantityUsed) || quantityUsed <= 0) {
    throw new Error('quantityUsed must be a positive integer');
  }
  if (quantityUsed > currentStock) {
    throw new Error('quantityUsed cannot exceed currentStock');
  }
  return currentStock - quantityUsed;
}

export function isLowStock(currentStock: number, lowStockThreshold: number): boolean {
  return currentStock <= lowStockThreshold;
}
