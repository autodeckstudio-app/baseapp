import {
  PackageDefinitionSchema,
  isPackageUsageEligible,
  consumePackageUsage,
  calculatePackageExpiryDate,
} from '../packages';

describe('PackageDefinitionSchema', () => {
  it('accepts a valid package definition', () => {
    const parsed = PackageDefinitionSchema.parse({
      packageDefinitionId: 'pkg-10-wash',
      name: '10 Washes',
      includedServiceId: 'wash',
      quantity: 10,
      price: 450_000, // ₹4,500
      validityDuration: { unit: 'month', value: 12 },
    });
    expect(parsed.quantity).toBe(10);
  });

  it('rejects a zero or negative quantity', () => {
    expect(() =>
      PackageDefinitionSchema.parse({
        packageDefinitionId: 'pkg-x',
        name: 'X',
        includedServiceId: 'wash',
        quantity: 0,
        price: 100,
        validityDuration: { unit: 'month', value: 12 },
      })
    ).toThrow();
  });

  it('rejects a missing validityDuration', () => {
    expect(() =>
      PackageDefinitionSchema.parse({
        packageDefinitionId: 'pkg-x',
        name: 'X',
        includedServiceId: 'wash',
        quantity: 10,
        price: 100,
      })
    ).toThrow();
  });

  it('rejects an unrecognized validity unit', () => {
    expect(() =>
      PackageDefinitionSchema.parse({
        packageDefinitionId: 'pkg-x',
        name: 'X',
        includedServiceId: 'wash',
        quantity: 10,
        price: 100,
        validityDuration: { unit: 'week', value: 4 },
      })
    ).toThrow();
  });
});

describe('calculatePackageExpiryDate', () => {
  it('adds exactly N calendar days for a day-unit duration', () => {
    const purchaseDate = new Date('2026-06-01T10:00:00Z');
    const expiresAt = calculatePackageExpiryDate(purchaseDate, { unit: 'day', value: 30 });
    expect(expiresAt.toISOString()).toBe('2026-07-01T10:00:00.000Z');
  });

  it('adds calendar months for a straightforward month-unit duration', () => {
    const purchaseDate = new Date('2026-01-15T00:00:00Z');
    const expiresAt = calculatePackageExpiryDate(purchaseDate, { unit: 'month', value: 1 });
    expect(expiresAt.toISOString()).toBe('2026-02-15T00:00:00.000Z');
  });

  it('clamps day-of-month overflow: Jan 31 + 1 month lands on Feb 28 in a non-leap year', () => {
    const purchaseDate = new Date('2026-01-31T00:00:00Z'); // 2026 is not a leap year
    const expiresAt = calculatePackageExpiryDate(purchaseDate, { unit: 'month', value: 1 });
    expect(expiresAt.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('clamps day-of-month overflow to Feb 29 in a leap year', () => {
    const purchaseDate = new Date('2024-01-31T00:00:00Z'); // 2024 is a leap year
    const expiresAt = calculatePackageExpiryDate(purchaseDate, { unit: 'month', value: 1 });
    expect(expiresAt.toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });

  it('handles a multi-month duration spanning a year boundary', () => {
    const purchaseDate = new Date('2026-11-15T00:00:00Z');
    const expiresAt = calculatePackageExpiryDate(purchaseDate, { unit: 'month', value: 3 });
    expect(expiresAt.toISOString()).toBe('2027-02-15T00:00:00.000Z');
  });

  it('adds calendar years for a straightforward year-unit duration', () => {
    const purchaseDate = new Date('2026-06-01T00:00:00Z');
    const expiresAt = calculatePackageExpiryDate(purchaseDate, { unit: 'year', value: 1 });
    expect(expiresAt.toISOString()).toBe('2027-06-01T00:00:00.000Z');
  });

  it('clamps Feb 29 + 1 year to Feb 28 when the target year is not a leap year', () => {
    const purchaseDate = new Date('2024-02-29T00:00:00Z'); // 2024 leap year
    const expiresAt = calculatePackageExpiryDate(purchaseDate, { unit: 'year', value: 1 }); // 2025 not leap
    expect(expiresAt.toISOString()).toBe('2025-02-28T00:00:00.000Z');
  });

  it('handles a multi-year duration', () => {
    const purchaseDate = new Date('2026-03-10T00:00:00Z');
    const expiresAt = calculatePackageExpiryDate(purchaseDate, { unit: 'year', value: 2 });
    expect(expiresAt.toISOString()).toBe('2028-03-10T00:00:00.000Z');
  });
});

describe('isPackageUsageEligible', () => {
  it('is eligible when there is remaining quantity and it is not yet expired', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const expiresAt = new Date('2026-12-01T00:00:00Z');
    expect(isPackageUsageEligible({ remainingQty: 3, expiresAt }, now)).toBe(true);
  });

  it('is not eligible when remainingQty is zero, even if not expired', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const expiresAt = new Date('2026-12-01T00:00:00Z');
    expect(isPackageUsageEligible({ remainingQty: 0, expiresAt }, now)).toBe(false);
  });

  it('is not eligible once expired, even with remaining quantity', () => {
    const now = new Date('2027-01-01T00:00:00Z');
    const expiresAt = new Date('2026-12-01T00:00:00Z');
    expect(isPackageUsageEligible({ remainingQty: 5, expiresAt }, now)).toBe(false);
  });

  it('is eligible at the exact expiry instant (boundary is inclusive)', () => {
    const expiresAt = new Date('2026-12-01T00:00:00Z');
    expect(isPackageUsageEligible({ remainingQty: 1, expiresAt }, expiresAt)).toBe(true);
  });
});

describe('consumePackageUsage', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  const expiresAt = new Date('2026-12-01T00:00:00Z');

  it('decrements remainingQty and increments usedQty by exactly one', () => {
    const result = consumePackageUsage({ totalQty: 10, usedQty: 3, remainingQty: 7 }, expiresAt, now);
    expect(result).toEqual({ usedQty: 4, remainingQty: 6 });
  });

  it('throws when there is no remaining quantity — never goes negative', () => {
    expect(() =>
      consumePackageUsage({ totalQty: 10, usedQty: 10, remainingQty: 0 }, expiresAt, now)
    ).toThrow();
  });

  it('throws when the package has expired', () => {
    const expired = new Date('2026-01-01T00:00:00Z');
    expect(() =>
      consumePackageUsage({ totalQty: 10, usedQty: 3, remainingQty: 7 }, expired, now)
    ).toThrow();
  });

  it('freezes the returned result', () => {
    const result = consumePackageUsage({ totalQty: 10, usedQty: 3, remainingQty: 7 }, expiresAt, now);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
