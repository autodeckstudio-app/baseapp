/** ₹ display helper — paise to a tabular-figure-ready rupee string. Mirrors customer-mobile's identical helper. */
export function formatPaiseAsRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}
