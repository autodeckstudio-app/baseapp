/** Received money is not the invoice total. This allocation never changes a
 * service price, creates store credit or sends a refund. All values are paise. */
export function allocateOfflineReceipt(totalPaise:number, appliedPaise:number, receivedPaise:number) {
 for (const n of [totalPaise, appliedPaise, receivedPaise])
  if (!Number.isSafeInteger(n) || n < 0) throw Error('Invalid offline receipt amount');
 if (appliedPaise > totalPaise || receivedPaise === 0) throw Error('Invalid offline receipt balance');
 const appliedNowPaise=Math.min(receivedPaise,totalPaise-appliedPaise);
 return {appliedNowPaise,balanceDuePaise:totalPaise-appliedPaise-appliedNowPaise,officeReturnDuePaise:receivedPaise-appliedNowPaise};
}
