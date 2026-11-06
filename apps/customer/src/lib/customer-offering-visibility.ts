/** Temporarily held from customer discovery pending brand confirmation. Records and history stay intact. */
export function customerOfferingVisible(row: { id?: string; brand?: string | null }): boolean {
  return row.id !== 'svc_852ed684301e188f572797265d7b106e' && row.brand !== 'Keramik';
}
