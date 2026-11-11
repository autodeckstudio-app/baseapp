import PDFDocument from 'pdfkit';
import {join} from 'node:path';
import {invoiceIssuerProblem,nearestRupeePaise,type Invoice} from '@autodeck/core';
const money=(n:number)=>`INR ${(n/100).toFixed(2)}`;
export class InvoicePdfReview extends Error {}
/** Issue-time snapshots only. Missing identity or inconsistent tax is held, never repaired from current data. */
export function assertInvoicePdfReady(inv:Invoice):void{
 const problem=invoiceIssuerProblem(inv.issuerSnapshot);if(problem)throw new InvoicePdfReview(problem);
 if(!['issued','paid'].includes(inv.status)||!inv.issuedAt||!Number.isFinite(Date.parse(inv.issuedAt)))throw new InvoicePdfReview('Invoice has no supported issued state.');
 if(!inv.customerSnapshot?.name||!inv.vehicleSnapshot)throw new InvoicePdfReview('Customer or vehicle snapshot is missing.');
 if(inv.currency!=='INR'||!inv.lineItems.length||inv.lineItems.some(l=>!Number.isSafeInteger(l.quantity)||l.quantity<=0||!Number.isSafeInteger(l.unitPrice)||l.unitPrice<0||!Number.isSafeInteger(l.total)||l.total!==l.quantity*l.unitPrice))throw new InvoicePdfReview('Invoice line snapshots are inconsistent.');
 if([inv.subtotal,inv.discount,inv.tax,inv.total].some(n=>!Number.isSafeInteger(n)||n<0)||inv.lineItems.reduce((s,l)=>s+l.total,0)!==inv.subtotal||inv.discount>inv.subtotal||inv.subtotal-inv.discount+inv.tax+(inv.roundOffPaise??0)!==inv.total||!Number.isSafeInteger(inv.roundOffPaise??0)||Math.abs(inv.roundOffPaise??0)>50)throw new InvoicePdfReview('Invoice amount snapshots are inconsistent.');
 if(inv.roundOffPaise!==undefined&&nearestRupeePaise(inv.subtotal-inv.discount+inv.tax)!==inv.total)throw new InvoicePdfReview('Invoice round-off snapshot is inconsistent.');
 if(inv.tax!==0||inv.taxRatePercent!==0||/gst/i.test(inv.taxDescription))throw new InvoicePdfReview('Unregistered issuer tax snapshot needs office review.');
}
export async function renderInvoicePdf(inv:Invoice):Promise<Buffer>{
 assertInvoicePdfReady(inv);
 return new Promise((resolve,reject)=>{
 const doc=new PDFDocument({size:'A4',margins:{top:46,left:46,right:46,bottom:64},bufferPages:true,info:{Title:inv.invoiceNumber,Author:inv.issuerSnapshot!.tradeName}}),chunks:Buffer[]=[];
 doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
 const assets=process.env['INVOICE_FONT_DIR']??join(__dirname,'invoice-assets');
 for(const[name,file]of[['regular','NotoSans-Regular.ttf'],['bold','NotoSans-Bold.ttf'],['gujarati','NotoSansGujarati-Regular.ttf'],['devanagari','NotoSansDevanagari-Regular.ttf']])doc.registerFont(name!,join(assets,file!));
 const text=(value:string,size=10,bold=false)=>{doc.font(/[\u0a80-\u0aff]/.test(value)?'gujarati':/[\u0900-\u097f]/.test(value)?'devanagari':bold?'bold':'regular').fontSize(size).fillColor('#252321').text(value,{width:503});};
 const issuer=inv.issuerSnapshot!;
 text(issuer.tradeName,20,true);doc.moveDown(.4);text('Invoice',28,true);text(inv.invoiceNumber,11,true);text(`Issued: ${new Date(inv.issuedAt!).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'})}`);
 text(`Status: ${inv.settlementKind==='membership_covered'?'Membership-covered':inv.status}`);doc.moveDown();text('Bill to',9,true);text(inv.customerSnapshot!.name,12,true);const v=inv.vehicleSnapshot!;text(`${v.make} ${v.model} | ${v.registrationNumber}`);doc.moveDown();
 for(const[i,l]of inv.lineItems.entries()){const description=`${i+1}. ${l.serviceName??l.description}`;doc.font('regular').fontSize(10);if(doc.y+doc.heightOfString(description,{width:503})+45>700)doc.addPage();doc.strokeColor('#dddcd5').moveTo(46,doc.y).lineTo(549,doc.y).stroke();doc.moveDown(.5);text(description);text(`${l.quantity} x ${money(l.unitPrice)} | ${money(l.total)}`);doc.moveDown(.5);}
 if(doc.y>565)doc.addPage();doc.moveDown();text(`Subtotal: ${money(inv.subtotal)}`);if(inv.discount)text(`Discount: ${money(inv.discount)}`);text(`Tax: ${money(inv.tax)}`);if(inv.roundOffPaise)text(`Round off: ${money(inv.roundOffPaise)}`);text(`Total: ${money(inv.total)}`,17,true);
 if(inv.settlementKind==='membership_covered'&&inv.membershipId)text('Settled by membership benefit. Amount due: INR 0.00',10,true);
 doc.moveDown();text('Amounts and customer/vehicle details are the issued snapshots.',8);text(issuer.legalName,9,true);text(issuer.address,8);text(`${issuer.phone} | ${issuer.email}`,8);text('Not registered under GST. No GST is charged on this invoice.',8);
 const pages=doc.bufferedPageRange();for(let i=pages.start;i<pages.start+pages.count;i++){doc.switchToPage(i);doc.page.margins.bottom=0;doc.font('regular').fontSize(8).fillColor('#73766e').text(`${inv.invoiceNumber} | Page ${i+1} of ${pages.count}`,46,795,{lineBreak:false,width:503,align:'right'});}doc.end();
 });
}
