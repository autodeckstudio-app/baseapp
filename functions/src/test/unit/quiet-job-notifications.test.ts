import {describe,it,expect} from 'vitest';
import {buildNotification} from '../../lib/notification-events.js';
import {visitNotification} from '../../lib/visit-notification.js';
import {fakeFirestore} from './fake-firestore.js';

describe('quiet job-stage notifications',()=>{
 it.each(['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK','DELIVERED','CANCELLED',undefined])('%s is app-only without any recipient/data reads',async status=>{
  const noReads={collection:()=>{throw Error('unexpected read')},runTransaction:()=>{throw Error('unexpected transaction')}} as never;
  expect(await buildNotification(noReads,{action:'job.status_advanced',entityId:'j',after:{status}} as never)).toBeNull();
  expect(await visitNotification(noReads,{} as never,String(status),'Car')).toBeNull();
 });
 it('keeps the ready notification and its booking target',async()=>{
  const {db}=fakeFirestore({jobs:{j:{customerId:'c',vehicleId:'v',bookingId:'b',status:'READY_FOR_DELIVERY'}},vehicles:{v:{model:'Nexon'}}});
  expect(await buildNotification(db,{action:'job.status_advanced',entityId:'j',after:{status:'READY_FOR_DELIVERY'}} as never)).toMatchObject({type:'job_completed',userId:'c',entityType:'Booking',entityId:'b'});
 });
 it('keeps unrelated bill notifications',async()=>{
  const {db}=fakeFirestore({invoices:{i:{id:'i',customerId:'c',invoiceNumber:'1',total:100}}});
  expect(await buildNotification(db,{action:'invoice.issued',entityId:'i'} as never)).toMatchObject({type:'invoice_issued'});
 });
});
