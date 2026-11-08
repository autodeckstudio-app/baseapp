import{createHash}from'node:crypto';
import {onDocumentCreated}from'firebase-functions/v2/firestore';import{getFirestore}from'firebase-admin/firestore';import{getStorage}from'firebase-admin/storage';import type{Invoice}from'@autodeck/core';import{renderInvoicePdf,InvoicePdfReview}from'../../lib/invoice-pdf.js';
/** Inactive by default. No identity backfill, public token, overwrite or billing mutation. */
export const onInvoiceCreatedPdf=onDocumentCreated({document:'invoices/{invoiceId}',region:'asia-south1',retry:true},async event=>{
 if(process.env['INVOICE_PDF_ENABLED']!=='true')return;
 const snap=event.data;if(!snap)return;const inv={...snap.data(),id:snap.id}as Invoice;if(!inv.tenantId||!['issued','paid'].includes(inv.status))return;
 let pdf:Buffer;try{pdf=await renderInvoicePdf(inv)}catch(e){if(!(e instanceof InvoicePdfReview))throw e;const reason=e.message;await snap.ref.update({pdfStatus:'needs_office_review',pdfError:reason});const id=`invoice_pdf_${inv.id}`;await getFirestore().collection('staffAlerts').doc(id).set({id,tenantId:inv.tenantId,studioId:inv.studioId,kind:'invoice_pdf_review',invoiceId:inv.id,reason,createdAt:new Date().toISOString()});return;}
 const digest=createHash('sha256').update(JSON.stringify(inv)).digest('hex');
 const path=`${inv.tenantId}/invoices/${inv.id}/issued.pdf`;let matches=true;await getStorage().bucket().file(path).save(pdf,{resumable:false,contentType:'application/pdf',metadata:{metadata:{invoiceDigest:digest}},preconditionOpts:{ifGenerationMatch:0}}).catch(async e=>{if(e.code!==412)throw e;const[metadata]=await getStorage().bucket().file(path).getMetadata();if(metadata.metadata?.invoiceDigest!==digest){matches=false;const reason='Existing invoice PDF snapshot digest differs. Office review required.';await snap.ref.update({pdfStatus:'needs_office_review',pdfError:reason});await getFirestore().collection('staffAlerts').doc(`invoice_pdf_${inv.id}`).set({id:`invoice_pdf_${inv.id}`,tenantId:inv.tenantId,studioId:inv.studioId,kind:'invoice_pdf_review',invoiceId:inv.id,reason,createdAt:new Date().toISOString()});}});
 if(!matches)return;
 await snap.ref.update({pdfStoragePath:path,pdfGeneratedAt:new Date().toISOString(),pdfStatus:'ready'});
});
