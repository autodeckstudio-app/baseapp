/** Configured identity is copied at issuance. Legacy invoices are never backfilled. */
export interface InvoiceIssuer {
 tradeName:string;address:string;phone:string;
 /** Legacy optional fields are retained in stored originals, never customer display defaults. */
 legalName?:string;email?:string;
 gstRegistered:boolean;gstin:string|null;
}
export function invoiceIssuerProblem(value:InvoiceIssuer|undefined):string|null{
 if(!value||['tradeName','address','phone'].some(k=>typeof (value as unknown as Record<string,unknown>)[k]!=='string'||!(value as unknown as Record<string,string>)[k]?.trim()))return 'Issuer identity is incomplete.';
 if(['legalName','email'].some(k=>{const v=(value as unknown as Record<string,unknown>)[k];return v!==undefined&&(typeof v!=='string'||!v.trim());}))return 'Optional issuer details are invalid.';
 if(value.gstRegistered!==false)return 'GST invoice particulars need accountant review before PDF generation.';
 if(value.gstin)return 'Unregistered issuer cannot carry a GSTIN.';
 return null;
}
