import { it, expect } from 'vitest';
import { customerTurnaround } from './customer-turnaround';
it('separates customer turnaround from immutable bay-hour input',()=>{
 for(const [category,minutes,value] of [['ceramic',300,'1-2 days'],['ppf',480,'2-3 days']] as const){const service={category,estimatedDurationMinutes:minutes,priceOnRequest:false};expect(customerTurnaround(service).value).toBe(value);expect(service.estimatedDurationMinutes).toBe(minutes)}
});
it('leaves inspection-first and other services unchanged',()=>{expect(customerTurnaround({category:'ceramic',priceOnRequest:true,estimatedDurationMinutes:0}).accessible).toBe('Studio inspection');expect(customerTurnaround({category:'washing',priceOnRequest:false,estimatedDurationMinutes:60}).value).toBe('1h')});
