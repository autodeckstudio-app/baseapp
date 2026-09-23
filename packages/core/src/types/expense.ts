/** Expense categories for studio operating costs. */
export type ExpenseCategory =
  | "SUPPLIES"
  | "EQUIPMENT"
  | "RENT"
  | "UTILITIES"
  | "SALARY_ADVANCE"
  | "MAINTENANCE"
  | "MARKETING"
  | "OTHER";

export type ExpensePaidVia = "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "OTHER";

/**
 * One studio operating expense. Admin-written only; feeds Daily Close cash
 * reconciliation and Office reports. `month` (YYYY-MM, Asia/Kolkata) is
 * denormalized from `date` so monthly reads are a single where().
 */
export interface Expense {
  id: string;
  tenantId: string;
  studioId: string;
  amount: number; // paise
  category: ExpenseCategory;
  paidVia: ExpensePaidVia;
  vendor: string | null;
  date: string; // YYYY-MM-DD (Asia/Kolkata business date)
  month: string; // YYYY-MM, denormalized from date
  notes: string | null;
  createdBy: string; // auth uid of the admin who recorded it
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
