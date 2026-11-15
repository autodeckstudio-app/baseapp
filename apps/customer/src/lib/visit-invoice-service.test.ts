import {it,expect,vi,afterEach} from 'vitest';
const h=vi.hoisted(()=>({invoke:vi.fn(),call:vi.fn()}));
vi.mock('firebase/functions',()=>({httpsCallable:h.call}));vi.mock('./firebase',()=>({functions:{}}));
import {getVisitInvoicePdf} from './visit-invoice-service';
const id='vi_vr_'+'a'.repeat(64);
afterEach(()=>vi.clearAllMocks());
it('uses exact invoice and read callable, never generates a new invoice',async()=>{h.call.mockReturnValue(h.invoke);h.invoke.mockResolvedValue({data:{url:'https://storage.example.test/original.pdf',expiresInSeconds:600}});expect(await getVisitInvoicePdf(id)).toBe('https://storage.example.test/original.pdf');expect(h.call).toHaveBeenCalledWith({},'getVisitInvoicePdfUrl',{timeout:15000});expect(h.invoke).toHaveBeenCalledWith({invoiceId:id})});
it('invalid invoice never calls server',async()=>{await expect(getVisitInvoicePdf('../other')).rejects.toThrow();expect(h.call).not.toHaveBeenCalled()});
it.each([{url:'http://example.test/a',expiresInSeconds:600},{url:'javascript:alert(1)',expiresInSeconds:600},{url:'https://name:secret@example.test/a',expiresInSeconds:600},{url:'https://example.test/a',expiresInSeconds:601},null])('rejects malformed or unexpected lifetime result %j',async data=>{h.call.mockReturnValue(h.invoke);h.invoke.mockResolvedValue({data});await expect(getVisitInvoicePdf(id)).rejects.toThrow()});
