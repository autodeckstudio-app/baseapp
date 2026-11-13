import {isDateOnly} from './document-validation';
/** Date fields retain their recorded calendar day. ISO instants retain the
 * existing viewer-local display contract; never truncate an event timestamp. */
export function formatGarageDate(value:string):string{
 const options:Intl.DateTimeFormatOptions={day:'numeric',month:'short',year:'numeric'};
 if(isDateOnly(value))return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-IN',{...options,timeZone:'UTC'});
 return new Date(value).toLocaleDateString('en-IN',options);
}
