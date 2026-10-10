import {readFileSync} from 'node:fs';import {describe,it,expect} from 'vitest';
const source=(p:string)=>readFileSync('src/'+p,'utf8');
describe('Round 2 safeguards',()=>{
 it('no missing size default and persists old vehicle size before confirmation',()=>{const s=source('app/(tabs)/book/[serviceId].tsx');expect(s).toContain('useState<VehicleCategory|null>(null)');expect(s).toContain('await ensureVehicleSize(selectedVehicle,selectedCategory,updateVehicle)');expect(s).toContain('!selectedVehicle.category');expect(s.indexOf('await ensureVehicleSize')).toBeLessThan(s.indexOf('router.push'));});
 it('keeps plate lookup owner scoped and exact normalized match',()=>{const s=source('lib/vehicle-service.ts');expect(s).toContain('where("ownerId", "==", uid)');expect(s).toContain('where("tenantId", "==", tenantId)');expect(s).toContain('normalizePlate(v.registrationNumber ?? "") === target');const f=source('app/(tabs)/garage/add.tsx');expect(f).toContain("submitSeq");});
 it('new document form excludes FASTAG and uses date picker',()=>{const s=source('app/(tabs)/garage/[id].tsx');expect(s).toContain('["RC", "INSURANCE", "PUC", "OTHER"]');expect(s).toContain('<DateField');expect(s).toContain('validateDocument(docForm.kind');});
 it('all file inputs are routed through the shared uploader',()=>{for(const p of ['app/(tabs)/garage/add.tsx','app/(tabs)/garage/[id].tsx','app/(tabs)/cars/sell.tsx']){expect(source(p)).toContain('<FileUploader');expect(source(p)).not.toContain('type: "file"');}});
});
describe('retained history routing contracts',()=>{
 it('global history does not require a garage car and shows orphan invoices',()=>{const s=source('app/(tabs)/garage/history.tsx');expect(s).toContain('listenToMyJobs');expect(s).toContain('listenToMyInvoices');expect(s).toContain('invoices.filter(inv=>!jobs.some');expect(s).not.toContain('if (!vehicleId || auth.status');});
 it('invoice uses immutable snapshots after vehicle removal',()=>{const s=source('app/(tabs)/bookings/invoice.tsx');expect(s).toContain('snapshots.vehicleSnapshot');expect(s).toContain('snapshots.customerSnapshot');});
 it('permanent delete is separate, confirmed and callable only',()=>{const s=source('app/(tabs)/garage/index.tsx');expect(s).toContain('if(!deleting)return');expect(s).toContain('await deleteVehicle(deleting.id)');expect(s).toContain('Past services and invoices remain');expect(s).toContain('Open bookings to cancel');});
});
