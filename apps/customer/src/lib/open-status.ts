import {studioOpenStatus} from '@autodeck/core';
import type {LiveStudioInfo} from './studio-info';
/** No zone means no open/closed claim. Caller must use the public studio config. */
export function openStatus(hours:LiveStudioInfo['operatingHours']|null|undefined,holidays:string[]=[],now:Date=new Date(),timezone?:string|null){
 return studioOpenStatus(hours as Parameters<typeof studioOpenStatus>[0],holidays,timezone,now);
}
