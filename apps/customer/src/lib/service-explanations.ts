import type {Service} from '@autodeck/core';
/** Managed service copy stays canonical; unlike product summaries, show every line. */
export function serviceExplanation(service:Pick<Service,'description'|'customerMenu'>):string[]{
 const home=service.customerMenu?.home;
 return home&&['washing','garage','modifications'].includes(home)?service.description.split('\n').map(line=>line.trim()).filter(Boolean):[];
}
