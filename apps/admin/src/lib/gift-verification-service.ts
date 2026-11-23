"use client";
import {httpsCallable} from 'firebase/functions';
import {functions} from './firebase';
import {safeGiftResult,type SafeGiftResult} from '../experience/GiftVerification';
/** Existing lookupGift only. No redemption, customer lookup, balance or void API. */
export async function verifyEnteredGift(code:string):Promise<SafeGiftResult>{
 const response=await httpsCallable<{code:string},unknown>(functions,'lookupGift')({code});
 return safeGiftResult(response.data);
}
