import {it,expect} from 'vitest';
import {invoiceIssuerProblem,type InvoiceIssuer} from './invoice-issuer';
const issuer=():InvoiceIssuer=>({tradeName:'Local seller fixture',address:'Fixture address',phone:'+910000000000',gstRegistered:false,gstin:null});
it('accepts the explicit seller/address/customer-care-phone contract without inventing private contact fields',()=>{const i=issuer(),before=structuredClone(i);expect(invoiceIssuerProblem(i)).toBe(null);expect(i).toEqual(before);expect(i).not.toHaveProperty('legalName');expect(i).not.toHaveProperty('email')});
it('still supports a legacy original without changing it',()=>{const i={...issuer(),legalName:'Private fixture',email:'private@example.invalid'},before=structuredClone(i);expect(invoiceIssuerProblem(i)).toBe(null);expect(i).toEqual(before)});
it.each(['tradeName','address','phone'])('holds a missing required %s',key=>{expect(invoiceIssuerProblem({...issuer(),[key]:''})).toBeTruthy()});
it.each([null,22,''])('holds malformed optional legacy fields %s',value=>{expect(invoiceIssuerProblem({...issuer(),legalName:value} as unknown as InvoiceIssuer)).toBeTruthy()});
it('keeps registered/GST and absent issuer holds intact',()=>{expect(invoiceIssuerProblem(undefined)).toBeTruthy();expect(invoiceIssuerProblem({...issuer(),gstRegistered:true,gstin:'TEST'})).toContain('accountant');expect(invoiceIssuerProblem({...issuer(),gstin:'TEST'})).toBeTruthy()});
