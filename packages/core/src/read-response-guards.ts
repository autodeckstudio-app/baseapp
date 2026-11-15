// Runtime guards for untrusted read responses. Keep the value unknown until
// the corresponding field check has succeeded; never coerce money or IDs.
export const readRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export const readEnum=<T extends string>(value:unknown,values:readonly T[]):value is T=>typeof value==='string'&&values.some(v=>v===value);
export const readText=(value:unknown):value is string=>typeof value==='string'&&value.length>0;
export const readInteger=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value);
export const readMoney=(value:unknown):value is number=>readInteger(value)&&value>=0;
export const readMoneyFields=<K extends string>(value:Record<string,unknown>,keys:readonly K[]):value is Record<string,unknown>&Record<K,number>=>keys.every(k=>readMoney(value[k]));
export const readArray=<T>(value:unknown,guard:(v:unknown)=>v is T):value is T[]=>Array.isArray(value)&&value.every(guard);
