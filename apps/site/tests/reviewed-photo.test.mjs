import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedPhotoUrl} from '../src/data/reviewed-photo.mjs';
const id='7mk03dXLpfdfL5fBMn5w',url='https://asia-south1-autodeck-studio.cloudfunctions.net/publicListingPhoto?listingId='+id;
test('only exact reviewed photo endpoint for the current listing passes',()=>{assert.equal(reviewedPhotoUrl(url,id),url);for(const v of [null,undefined,'',url+'&extra=1',url+'#x',url.replace('https:','http:'),url.replace('.net','.net.evil.test'),url.replace('publicListingPhoto','listPublicCarListings'),url.replace(id,'other'),url.replace('listingId=','x='),'//evil.test/a','data:image/png;base64,x','https://storage.googleapis.com/private.jpg'])assert.equal(reviewedPhotoUrl(v,id),undefined)});
test('unsafe/missing listing identifiers cannot authorize images',()=>{for(const id of [undefined,null,'','a&b','../private','a/b','x'.repeat(129)])assert.equal(reviewedPhotoUrl(url,id),undefined)});
