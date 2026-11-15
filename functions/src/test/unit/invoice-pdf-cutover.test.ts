import{it,expect}from'vitest';import{invoicePdfAfterCutover as check}from'../../lib/invoice-pdf-cutover.js';
const cutoff='2026-11-16T00:00:00.000Z',ms=Date.parse(cutoff),time=(n:number)=>({toMillis:()=>n}),env={INVOICE_PDF_ENABLED:'true',INVOICE_PDF_FROM:cutoff};
it.each([undefined,'','false','TRUE'])('disabled flag %s',v=>expect(check(time(ms),{...env,INVOICE_PDF_ENABLED:v})).toBe(false));
it.each([undefined,'','invalid','2026-11-16','2026-11-16T00:00:00Z','2026-02-30T00:00:00.000Z'])('invalid cutover %s fails closed',v=>expect(check(time(ms),{...env,INVOICE_PDF_FROM:v})).toBe(false));
it.each([undefined,null,{},'2026-11-16T00:00:00.000Z',{toMillis:0},time(NaN),time(Infinity)])('missing immutable creation timestamp %#',t=>expect(check(t,env)).toBe(false));
it('old replay denied; exact boundary/new create allowed independent of invoice issuedAt',()=>{expect(check(time(ms-1),env)).toBe(false);expect(check(time(ms),env)).toBe(true);expect(check(time(ms+1),env)).toBe(true)});
