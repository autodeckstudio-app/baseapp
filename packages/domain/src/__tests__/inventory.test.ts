import { computeStockAfterUsage, isLowStock } from '../inventory';

describe('computeStockAfterUsage', () => {
  it('deducts usage from current stock', () => {
    expect(computeStockAfterUsage(50, 5)).toBe(45);
  });

  it('allows deducting down to exactly zero', () => {
    expect(computeStockAfterUsage(5, 5)).toBe(0);
  });

  it('throws when usage exceeds current stock — never goes negative', () => {
    expect(() => computeStockAfterUsage(3, 5)).toThrow();
  });

  it('throws for a zero quantityUsed', () => {
    expect(() => computeStockAfterUsage(10, 0)).toThrow();
  });

  it('throws for a negative quantityUsed', () => {
    expect(() => computeStockAfterUsage(10, -1)).toThrow();
  });

  it('throws for a non-integer quantityUsed', () => {
    expect(() => computeStockAfterUsage(10, 1.5)).toThrow();
  });

  it('throws for a negative currentStock', () => {
    expect(() => computeStockAfterUsage(-1, 1)).toThrow();
  });
});

describe('isLowStock', () => {
  it('is true when stock is at the threshold', () => {
    expect(isLowStock(5, 5)).toBe(true);
  });

  it('is true when stock is below the threshold', () => {
    expect(isLowStock(2, 5)).toBe(true);
  });

  it('is false when stock is above the threshold', () => {
    expect(isLowStock(10, 5)).toBe(false);
  });
});
