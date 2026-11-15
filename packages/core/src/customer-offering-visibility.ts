import visibility from './customer-offering-visibility.json';
// Explicit product confirmation and ordinary-service scope. Missing product confirmation fails closed.
const visibleIds = new Set([...visibility.confirmedProductIds, ...visibility.ordinaryServiceIds]);
const enquiryKeys = new Set<string>(visibility.confirmedEnquiryKeys);
export function customerOfferingVisible(row: { id?: string; key?: string; active?: boolean; brand?: string | null; customerMenu?: {home:string;family:string} }): boolean {
  if (row.active === false || row.brand === 'Keramik') return false;
  if(row.id&&row.customerMenu&&['paint','detailing','washing','garage','modifications'].includes(row.customerMenu.home)&&row.customerMenu.family.trim())return true;
  return typeof row.id === 'string' ? visibleIds.has(row.id) : typeof row.key === 'string' && enquiryKeys.has(row.key);
}
