import { normaliseGiftCode } from '@autodeck/core';
/** Feedback only. The shared core remains the source of valid-code semantics. */
export function giftCodeProblem(input:string):string|null {
 if(normaliseGiftCode(input))return null;
 const value=input.toUpperCase().replace(/[\s-]/g,'');
 if(!value.startsWith('GW'))return 'Gift codes start with GW.';
 if(value.slice(2).length!==8)return 'Enter 8 characters after GW.';
 if(/[01IO]/.test(value.slice(2)))return 'Gift codes do not use 0, 1, I or O.';
 return 'Use only letters and numbers from your gift code.';
}
