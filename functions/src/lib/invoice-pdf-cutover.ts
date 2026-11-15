/** Prospective-only activation. Invalid/missing cutover or creation time fails closed.
 * Uses the immutable Firestore snapshot createTime, never an editable invoice date.
 * Acknowledged disabled/old events are not a backfill queue.
 */
export function invoicePdfAfterCutover(createdAt:unknown,env:NodeJS.ProcessEnv=process.env):boolean{
 if(env['INVOICE_PDF_ENABLED']!=='true')return false;
 const cutoff=env['INVOICE_PDF_FROM'];
 if(!cutoff||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cutoff))return false;
 const ms=Date.parse(cutoff);if(!Number.isFinite(ms)||new Date(ms).toISOString()!==cutoff)return false;
 if(!createdAt||typeof(createdAt as {toMillis?:unknown}).toMillis!=='function')return false;
 const created=(createdAt as {toMillis:()=>number}).toMillis();
 return Number.isFinite(created)&&created>=ms;
}
