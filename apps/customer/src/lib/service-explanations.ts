import type {Service} from '@autodeck/core';
import {presentationScope} from './service-presentation';
/** Included scope only; callers show limits in Details. */
export function serviceExplanation(service:Pick<Service,'description'|'customerMenu'> & Partial<Pick<Service,'id'|'name'>>):string[]{
 return presentationScope(service).included;
}
