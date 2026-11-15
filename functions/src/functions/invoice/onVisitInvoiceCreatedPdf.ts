import{invoicePdfAfterCutover}from'../../lib/invoice-pdf-cutover.js';
import{createHash}from'node:crypto';
import {onDocumentCreated}from'firebase-functions/v2/firestore';import{getFirestore}from'firebase-admin/firestore';import{getStorage}from'firebase-admin/storage';import{renderVisitInvoicePdf,InvoicePdfReview}from'../../lib/invoice-pdf.js';
/** Inactive by default. No identity backfill, public token, overwrite or billing mutation. */
export const onVisitInvoiceCreatedPdf=onDocumentCreated({document:'visitInvoices/{invoiceId}',region:'asia-south1',retry:true},async event=>{
 if(!invoicePdfAfterCutover(event.data?.createTime))return;
 const snap=event.data;if(!snap)return;const inv:Record<string,any>={...snap.data()};if(!inv['tenantId']||inv['kind']!=='shared_visit_invoice'||inv['status']!=='issued')return;
 let pdf:Buffer;try{if(inv['id']!==snap.id)throw new InvoicePdfReview('Invoice identity differs from its issued record.');pdf=await renderVisitInvoicePdf(inv)}catch(e){if(!(e instanceof InvoicePdfReview))throw e;const reason=e.message;await snap.ref.update({pdfStatus:'needs_office_review',pdfError:reason});const id=`visit_invoice_pdf_${inv.id}`;await getFirestore().collection('staffAlerts').doc(id).set({id,tenantId:inv.tenantId,studioId:inv.studioId,kind:'visit_invoice_pdf_review',invoiceId:inv.id,reason,createdAt:new Date().toISOString()});return;}
 const digest=createHash('sha256').update(JSON.stringify(inv)).digest('hex');
 const path=`${inv.tenantId}/visit-invoices/${inv.id}/issued.pdf`;let matches=true;await getStorage().bucket().file(path).save(pdf,{resumable:false,contentType:'application/pdf',metadata:{metadata:{invoiceDigest:digest}},preconditionOpts:{ifGenerationMatch:0}}).catch(async e=>{if(e.code!==412)throw e;const[metadata]=await getStorage().bucket().file(path).getMetadata();if(metadata.metadata?.invoiceDigest!==digest){matches=false;const reason='Existing invoice PDF snapshot digest differs. Office review required.';await snap.ref.update({pdfStatus:'needs_office_review',pdfError:reason});await getFirestore().collection('staffAlerts').doc(`visit_invoice_pdf_${inv.id}`).set({id:`visit_invoice_pdf_${inv.id}`,tenantId:inv.tenantId,studioId:inv.studioId,kind:'visit_invoice_pdf_review',invoiceId:inv.id,reason,createdAt:new Date().toISOString()});}});
 if(!matches)return;
 await snap.ref.update({pdfStoragePath:path,pdfGeneratedAt:new Date().toISOString(),pdfStatus:'ready'});
});
