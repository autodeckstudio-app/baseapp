import type {Service,VehicleCategory} from '@autodeck/core';
import {calculateServicePrice} from './catalogue-service';
/** Read-only display preview. Mixed bays have no bookable combined slot or final settlement here. */
export async function previewSelectionPrice(services:Service[],category:VehicleCategory):Promise<{total:number;minutes:number}> {
 const first=services[0];if(!first)throw new Error('No services selected');
 const crossBay=new Set(services.map(s=>s.requiredBayType)).size>1;
 if(!crossBay){const r=await calculateServicePrice(first.id,category,services.slice(1).map(s=>s.id));return{total:r.breakdown.total,minutes:r.durationMinutes??first.estimatedDurationMinutes};}
 // Never sum a catalogue starting price, quote, or an incomplete set of responses.
 const prices=await Promise.all(services.map(s=>calculateServicePrice(s.id,category)));
 if(prices.some(p=>p.breakdown.currency!=='INR'||!Number.isSafeInteger(p.breakdown.total)||p.breakdown.total<0))throw new Error('Price unavailable');
 const total=prices.reduce((n,p)=>n+p.breakdown.total,0);
 if(!Number.isSafeInteger(total))throw new Error('Price unavailable');
 return{total,minutes:0};
}
