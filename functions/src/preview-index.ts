/** Dedicated read-only emulator entrypoint. Never production's build target.
 * No automatic source-mutating Firestore triggers are registered here. */
import{initializeApp}from'firebase-admin/app';initializeApp();
export{getRetainedTransportList}from'./functions/visit/getRetainedTransportList.js';
export{getMyVisit,getStaffVisit}from'./functions/visit/getVisit.js';
export{getMyVisitBill,getStaffVisitBill}from'./functions/visit/getVisitBill.js';
export{getVisitInvoice,listStaffVisitInvoices,getVisitInvoicePdfUrl}from'./functions/visit/getVisitInvoice.js';
export{getCustomerJobs}from'./functions/customer/getCustomerJobs.js';
export{getPublicCatalogue}from'./functions/service/getPublicCatalogue.js';
