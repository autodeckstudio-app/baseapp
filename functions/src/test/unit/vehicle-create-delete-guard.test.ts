import {describe,it,expect} from 'vitest';import {readFileSync} from 'node:fs';
describe('creation coordinates with hard deletion',()=>{
 it.each(['booking/createBooking.ts','job/createWalkinJob.ts'])('%s reads vehicle inside transaction before visit writes',p=>{const s=readFileSync('src/functions/'+p,'utf8');const transaction=s.slice(s.indexOf('db.runTransaction'));expect(transaction).toContain('await tx.get(db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId))');expect(transaction).toContain('if(!currentVehicleSnap.exists)');expect(transaction).toContain('currentVehicle.deletedAt');expect(transaction.indexOf('currentVehicleSnap')).toBeLessThan(transaction.indexOf('tx.set('));});
});
