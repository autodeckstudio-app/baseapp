// PRODUCT display only. Match the admin formatter's finite guard without importing its app bundle.
function formatPaise(paise: number): string {
  if (typeof paise !== "number" || !Number.isFinite(paise)) return "-";
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 === 0 ? 0 : 2, maximumFractionDigits: paise % 100 === 0 ? 0 : 2 })}`;
}
export function manualRefundNotice(booking: { status: string; manualRefundDuePaise?: unknown }) {
  const due = booking.manualRefundDuePaise;
  if (booking.status !== "CANCELLED" || typeof due !== "number" || !Number.isSafeInteger(due) || due <= 0) return null;
  return { title: "Refund owed by the studio", body: `The studio owes you ${formatPaise(due)}. It has not been recorded as returned. Contact the studio to arrange the return.` };
}
