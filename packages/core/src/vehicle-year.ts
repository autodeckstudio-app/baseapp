/** AutoDeck's year boundary follows its studio timezone, not the device/server local zone.
 * Compute at validation time so a long-lived process cannot freeze last year's limit. */
export function currentVehicleYear(now:Date=new Date()):number{
 if(!Number.isFinite(now.getTime()))throw Error('Current date is unavailable.');
 return Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric'}).format(now));
}
