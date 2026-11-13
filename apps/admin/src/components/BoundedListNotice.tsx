/** Explicit scope for live but bounded office feeds. This is not an exhaustive lookup. */
export function BoundedListNotice({kind,limit}:{kind:'bookings'|'payments';limit:number}){
 return <p role="note" className="ax-note">{kind==='bookings'
 ?`This view loads up to ${limit} bookings, newest scheduled slot first. Counts, date filters and search cover only those loaded bookings, not the full history.`
 :`This view loads up to ${limit} payments, newest created first. Filters and figures cover only those loaded payments, not a complete ledger or historical balance.`}</p>;
}
