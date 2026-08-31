import { computePriceSnapshot, ADVANCE_THRESHOLD_PAISE } from '../pricing';

describe('computePriceSnapshot', () => {
  it('requires no advance for a service priced below ₹10,000', () => {
    const snapshot = computePriceSnapshot([{ serviceId: 'wash', basePrice: 500_000 }]); // ₹5,000
    expect(snapshot.total).toBe(500_000);
    expect(snapshot.advanceRequired).toBe(false);
    expect(snapshot.advanceAmount).toBe(0);
  });

  it('requires no advance for a total exactly at the ₹10,000 boundary', () => {
    const snapshot = computePriceSnapshot([{ serviceId: 'svc', basePrice: ADVANCE_THRESHOLD_PAISE }]);
    expect(snapshot.total).toBe(ADVANCE_THRESHOLD_PAISE);
    expect(snapshot.advanceRequired).toBe(false);
    expect(snapshot.advanceAmount).toBe(0);
  });

  it('requires a 40% advance for a total just above ₹10,000', () => {
    const snapshot = computePriceSnapshot([{ serviceId: 'coating', basePrice: ADVANCE_THRESHOLD_PAISE + 1 }]);
    expect(snapshot.advanceRequired).toBe(true);
    expect(snapshot.advanceAmount).toBe(Math.round((ADVANCE_THRESHOLD_PAISE + 1) * 0.4));
  });

  it('requires a 40% advance for a realistic ₹15,000 ceramic coating', () => {
    const snapshot = computePriceSnapshot([{ serviceId: 'ceramic', basePrice: 1_500_000 }]); // ₹15,000
    expect(snapshot.advanceRequired).toBe(true);
    expect(snapshot.advanceAmount).toBe(600_000); // ₹6,000
  });

  it('sums multiple selected services into one snapshot', () => {
    const snapshot = computePriceSnapshot([
      { serviceId: 'wash', basePrice: 500_000 },
      { serviceId: 'wax', basePrice: 700_000 },
    ]);
    expect(snapshot.lineItems).toHaveLength(2);
    expect(snapshot.subtotal).toBe(1_200_000);
    expect(snapshot.total).toBe(1_200_000);
    expect(snapshot.advanceRequired).toBe(true);
  });

  it('throws when no services are selected', () => {
    expect(() => computePriceSnapshot([])).toThrow();
  });

  it('freezes the returned snapshot so it cannot be mutated after the fact', () => {
    const snapshot = computePriceSnapshot([{ serviceId: 'wash', basePrice: 500_000 }]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(() => {
      // @ts-expect-error — intentionally attempting an illegal mutation
      snapshot.total = 1;
    }).toThrow();
  });
});
