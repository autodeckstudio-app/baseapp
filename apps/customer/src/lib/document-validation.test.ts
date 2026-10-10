import {describe,it,expect} from 'vitest';
import {validateDocument,documentReference,isDateOnly} from './document-validation';
describe('document rules',()=>{
 it('RC applies only the requested plate rule',()=>{expect(validateDocument('RC','mh-02 ab 1234','2026-10-10')).toBeNull();expect(documentReference('RC','mh-02 ab 1234')).toBe('MH02AB1234');expect(validateDocument('RC','PUC2026MH123456','')).not.toBeNull();});
 it('insurance and PUC are free-entry numbers',()=>{for(const kind of ['INSURANCE','PUC'])for(const value of ['MH/2026/12345','PUC2026MH123456','ABC'])expect(validateDocument(kind,value,'')).toBeNull();});
 it('validates real date-only calendar days without timezone conversion',()=>{expect(isDateOnly('2028-02-29')).toBe(true);for(const value of ['22-22-2026','2026-02-29','2026-04-31','2026-13-01','2026-00-00'])expect(isDateOnly(value)).toBe(false);expect(validateDocument('PUC','ABC','2026-02-29')).toContain('calendar');});
});
