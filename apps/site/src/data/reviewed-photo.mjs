const PHOTO_ORIGIN='https://asia-south1-autodeck-studio.cloudfunctions.net';
export function reviewedPhotoUrl(value,id){
 if(typeof id!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(id)||typeof value!=='string')return undefined;
 const expected=PHOTO_ORIGIN+'/publicListingPhoto?listingId='+encodeURIComponent(id);
 return value===expected?value:undefined;
}
