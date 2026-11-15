import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SellInput } from './carsale-service';
const key=(owner:string)=>`autodeck.pendingListing.v1:${owner}`;
export async function readPendingListing(owner:string):Promise<SellInput|null>{
 const value=await AsyncStorage.getItem(key(owner));
 if(!value)return null;
 const data=JSON.parse(value);
 if(data.operationId!==undefined&&(typeof data.operationId!=='string'||! /^[A-Za-z0-9_-]{16,120}$/.test(data.operationId)))throw Error('Saved submission key needs review. Do not send again yet.');
 if(!Array.isArray(data.photoPaths)||data.photoPaths.length===0||typeof data.make!=='string')throw Error('Saved listing check is unavailable. Do not send again yet.');
 return data as SellInput;
}
export async function writePendingListing(owner:string,payload:SellInput){await AsyncStorage.setItem(key(owner),JSON.stringify(payload));}
export async function clearPendingListing(owner:string){await AsyncStorage.removeItem(key(owner));}
