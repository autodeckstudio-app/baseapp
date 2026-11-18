import {describe,it,expect} from 'vitest';
import {applyCustomerGlacier} from './customer-glacier';
import {lightColors,nightColors,contrastRatio} from '@autodeck/ui/theme';
describe('approved Glacier text contrast',()=>{
 applyCustomerGlacier();
 for(const [name,c] of [['day',lightColors],['night',nightColors]] as const){
  for(const surface of ['canvas','canvasDeep','surface','surfaceElevated'] as const){
   for(const text of ['textPrimary','textSecondary','textTertiary','accentStrong'] as const){
    it(`${name} ${text} on ${surface} meets AA`,()=>expect(contrastRatio(c[text],c[surface])).toBeGreaterThanOrEqual(4.5));
   }
  }
 }
});
