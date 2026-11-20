import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Booking terms call link has an explicit gap without changing contact or policy',()=>{
 const html=readFileSync(new URL('../src/data/redesign/terms.html',import.meta.url),'utf8');
 assert.match(html,/<a style="margin-top:24px;display:inline-flex" class="outline" href="tel:\+919898679711">Call the studio<\/a>/);
 assert.match(html,/please contact AutoDeck before confirming your booking/);
});
