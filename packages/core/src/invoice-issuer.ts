/** Configured identity is copied at issuance. Legacy invoices are never backfilled. */
export interface InvoiceIssuer {
 tradeName:string;legalName:string;address:string;phone:string;email:string;
 gstRegistered:boolean;gstin:string|null;
}
export function invoiceIssuerProblem(value:InvoiceIssuer|undefined):string|null{
 if(!value||['tradeName','legalName','address','phone','email'].some(k=>typeof (value as unknown as Record<string,unknown>)[k]!=='string'||!(value as unknown as Record<string,string>)[k]?.trim()))return 'Issuer identity is incomplete.';
 if(value.gstRegistered!==false)return 'GST invoice particulars need accountant review before PDF generation.';
 if(value.gstin)return 'Unregistered issuer cannot carry a GSTIN.';
 return null;
}
