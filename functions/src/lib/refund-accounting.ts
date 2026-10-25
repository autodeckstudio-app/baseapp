// Refund arithmetic, verified before any projection is written. Pure: unit
// tested, no Firestore. A refund projection must always balance: what the
// customer got back plus what the studio retained equals what was captured.
// Inconsistent labels (e.g. "refunded" while money is still retained) are
// rejected instead of written — truthful state over convenient state.
export type RefundLabel = "completed" | "partially_refunded" | "refunded";

export function labelForRefund(capturedPaise: number, refundedPaise: number): RefundLabel {
  if (refundedPaise <= 0) return "completed";
  if (refundedPaise >= capturedPaise) return "refunded";
  return "partially_refunded";
}

export type AccountingCheck =
  | { ok: true; label: RefundLabel; retainedPaise: number }
  | { ok: false; reason: string };

export function verifyRefundAccounting(i: { capturedPaise: number; refundedPaise: number; label?: string }): AccountingCheck {
  const captured = i.capturedPaise;
  const refunded = i.refundedPaise;
  if (!Number.isInteger(captured) || !Number.isInteger(refunded)) return { ok: false, reason: "amounts must be integer paise" };
  if (captured < 0 || refunded < 0) return { ok: false, reason: "amounts must not be negative" };
  if (refunded > captured) return { ok: false, reason: `refunded ${refunded} exceeds captured ${captured}` };
  const label = labelForRefund(captured, refunded);
  if (i.label !== undefined && i.label !== label) {
    return { ok: false, reason: `label '${i.label}' inconsistent with refunded ${refunded} of ${captured} (expected '${label}')` };
  }
  return { ok: true, label, retainedPaise: captured - refunded };
}
