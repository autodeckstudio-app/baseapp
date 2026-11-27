import {FIRST_STUDIO_ID,type Service,type VehicleCategory} from '@autodeck/core';
import {calculateServicePrice} from './catalogue-service';
/** Read-only display preview: the server prices the whole cart as one booking, including services that need different
 *  bay types (one booking; each stage holds its own bay). Never sums separate quotes or starting prices. */
export async function previewSelectionPrice(services:Service[],category:VehicleCategory):Promise<{total:number;minutes:number}> {
 const first=services[0];if(!first)throw new Error('No services selected');
 // One combined server calculation for the whole cart at the booking studio: the same extras, tax and currency rules
 // createBooking stores (membership, gift, quote and transport options are chosen later, at confirmation).
 const r=await calculateServicePrice(first.id,category,services.slice(1).map(s=>s.id),FIRST_STUDIO_ID);
 if(r.breakdown.currency!=='INR'||!Number.isSafeInteger(r.breakdown.total)||r.breakdown.total<0)throw new Error('Price unavailable');
 return{total:r.breakdown.total,minutes:r.durationMinutes??first.estimatedDurationMinutes};
}
