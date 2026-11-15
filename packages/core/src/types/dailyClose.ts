export type DailyCloseStatus = "CLOSED";

/**
 * End-of-day cash reconciliation for one studio and business date
 * (Asia/Kolkata). Document id is deterministic: tenantId__studioId__date.
 * Expected figures are computed server-side from completed payments and
 * recorded expenses; the admin enters the counted cash drawer total.
 */
export interface DailyClose {
  /** Separate actual service-return flows, never a rewrite of gross receipts. */
  serviceReturnsPaise?: number;
  cashServiceReturnsPaise?: number;
  onlineServiceReturnsPaise?: number;
  id: string;
  tenantId: string;
  studioId: string;
  date: string; // YYYY-MM-DD
  status: DailyCloseStatus;
  // Computed at close time
  expectedCashPaise: number; // gross cash receipts minus cash expenses and actual cash returns
  upiPaise: number;
  cardPaise: number;
  bankTransferPaise: number;
  totalRevenuePaise: number; // all completed payments that day
  expensesPaise: number; // all expenses recorded that day (any method)
  paymentCount: number;
  expenseCount: number;
  // Entered by the admin
  countedCashPaise: number;
  variancePaise: number; // countedCashPaise - expectedCashPaise
  notes: string | null;
  closedBy: string; // auth uid
  closedAt: string; // ISO
  closeCount: number; // 1 on first close, increments on each re-close
  updatedAt: string; // ISO
}
