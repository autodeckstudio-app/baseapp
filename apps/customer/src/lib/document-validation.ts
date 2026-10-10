export function isDateOnly(value:string):boolean {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [year,month,day]=value.split('-').map(Number);if(!year||year<1900||year>2200||!month||!day)return false;
 const d=new Date(Date.UTC(year!,month!-1,day));return d.getUTCFullYear()===year&&d.getUTCMonth()+1===month&&d.getUTCDate()===day;
}
export function validateDocument(kind:string,reference:string,expiresOn:string):string|null {
 if(!reference.trim())return 'Enter the document or policy number.';
 if(kind==='RC'&&!/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/.test(reference.toUpperCase().replace(/[\s\-_./]+/g,'')))return 'Use 2 state letters, 2 RTO digits, 1-2 series letters and 4 digits, e.g. MH02AB1234.';
 if(expiresOn&&!isDateOnly(expiresOn))return 'Choose a valid expiry date from the calendar.';
 return null;
}
export function documentReference(kind:string,value:string):string {return kind==='RC'?value.toUpperCase().replace(/[\s\-_./]+/g,''):value.trim();}
